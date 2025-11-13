use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::fs;
use std::io::Read;
use std::io::Write;
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State, Window};
use uuid::Uuid;

pub struct SessionState {
    channel: Arc<Mutex<ssh2::Channel>>,
}

pub struct AppState {
    pub sessions: Arc<DashMap<Uuid, SessionState>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(DashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionDetails {
    host: String,
    port: Option<u16>,
    username: String,
    password: Option<String>,
    #[serde(rename = "private_key_path")]
    private_key_path: Option<String>,
    passphrase: Option<String>,
    #[serde(rename = "authMethod")]
    #[allow(dead_code)]
    auth_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SavedHost {
    id: String,
    name: String,
    details: ConnectionDetails,
}

#[derive(Debug, Clone, Serialize)]
struct TerminalOutputPayload {
    session_id: String,
    data: Vec<u8>,
}

#[tauri::command]
fn connect_ssh(
    details: ConnectionDetails,
    state: State<'_, AppState>,
    window: Window,
) -> Result<String, String> {
    let session_id = Uuid::new_v4();
    let host = details.host;
    let port = details.port.unwrap_or(22);
    let addr = format!("{}:{}", host, port);

    let tcp = TcpStream::connect(&addr).map_err(|e| e.to_string())?;
    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(tcp);

    sess.handshake().map_err(|e| e.to_string())?;

    // Authenticate with key or password
    if let Some(key_path) = details.private_key_path {
        sess.userauth_pubkey_file(
            &details.username,
            None,
            Path::new(&key_path),
            details.passphrase.as_deref(),
        )
        .map_err(|e| format!("Key authentication failed: {}", e))?;
    } else if let Some(password) = details.password {
        sess.userauth_password(&details.username, &password)
            .map_err(|e| format!("Password authentication failed: {}", e))?;
    } else {
        return Err("No password or private key provided".to_string());
    }

    if !sess.authenticated() {
        return Err("Authentication failed".to_string());
    }

    let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
    channel
        .request_pty("xterm-256color", None, None)
        .map_err(|e| e.to_string())?;
    channel.shell().map_err(|e| e.to_string())?;

    let channel_arc = Arc::new(Mutex::new(channel));
    state.sessions.insert(
        session_id,
        SessionState {
            channel: channel_arc.clone(),
        },
    );

    let reader_window = window.clone();
    let reader_session_id = session_id.to_string();
    thread::spawn(move || {
        let mut buffer = [0; 4096];
        loop {
            match channel_arc.lock() {
                Ok(mut channel_lock) => match channel_lock.read(&mut buffer) {
                    Ok(bytes_read) => {
                        if bytes_read == 0 {
                            println!("SSH stream closed for session {}", reader_session_id);
                            break;
                        }
                        let data = buffer[..bytes_read].to_vec();
                        let _ = reader_window.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                session_id: reader_session_id.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        eprintln!(
                            "Error reading from SSH stream for session {}: {}",
                            reader_session_id, e
                        );
                        break;
                    }
                },
                Err(e) => {
                    eprintln!(
                        "Error acquiring lock for session {}: {}",
                        reader_session_id, e
                    );
                    break;
                }
            }
        }
    });

    println!("Successfully connected session {}", session_id);
    Ok(session_id.to_string())
}

#[tauri::command]
fn send_terminal_input(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    if let Some(session) = state.sessions.get(&uuid) {
        let mut channel = session.value().channel.lock().map_err(|e| e.to_string())?;
        channel
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        channel.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[tauri::command]
fn resize_terminal(
    session_id: String,
    rows: u32,
    cols: u32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    if let Some(session) = state.sessions.get(&uuid) {
        let mut channel = session.value().channel.lock().map_err(|e| e.to_string())?;
        channel
            .request_pty_size(cols, rows, None, None)
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Ok(())
    }
}

fn get_connections_path(_app_handle: &AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = std::env::var("HOME")
        .map(|h| std::path::PathBuf::from(h).join(".config/terminoda"))
        .unwrap_or_else(|_| {
            std::path::PathBuf::from(
                std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string())
            )
        });

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    Ok(config_dir.join("connections.json"))
}

#[tauri::command]
fn load_saved_hosts(app_handle: AppHandle) -> Result<Vec<SavedHost>, String> {
    let path = get_connections_path(&app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let hosts: Vec<SavedHost> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(hosts)
}

#[tauri::command]
fn save_new_host(
    name: String,
    details: ConnectionDetails,
    app_handle: AppHandle,
) -> Result<SavedHost, String> {
    let mut hosts = load_saved_hosts(app_handle.clone())?;

    let new_host = SavedHost {
        id: Uuid::new_v4().to_string(),
        name,
        details,
    };

    hosts.push(new_host.clone());

    let path = get_connections_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;

    Ok(new_host)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            connect_ssh,
            send_terminal_input,
            resize_terminal,
            load_saved_hosts,
            save_new_host
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
