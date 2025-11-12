use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::io::Read;
use std::io::Write;
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{Manager, State, Window};
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

#[derive(Debug, Deserialize)]
struct ConnectionDetails {
    host: String,
    port: Option<u16>,
    username: String,
    password: Option<String>,
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
    let mut sess = Session::new().ok_or("Failed to create session")?;
    sess.set_tcp_stream(tcp);

    sess.handshake().map_err(|e| e.to_string())?;

    if let Some(password) = details.password {
        sess.userauth_password(&details.username, &password)
            .map_err(|e| e.to_string())?;
    } else {
        return Err("Password is required for now".to_string());
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
                Ok(mut channel_lock) => {
                    match channel_lock.read(&mut buffer) {
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
                            eprintln!("Error reading from SSH stream for session {}: {}", reader_session_id, e);
                            break;
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error acquiring lock for session {}: {}", reader_session_id, e);
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
        channel.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        channel.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![connect_ssh, send_terminal_input])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
