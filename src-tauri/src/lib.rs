use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use ssh2::{Session, Sftp};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::async_runtime;
use tauri::{AppHandle, Emitter, State, Window};
use thiserror::Error;
use tracing::{error, info, warn};
use tracing_subscriber::FmtSubscriber;
use uuid::Uuid;

pub struct SessionState {
    pub channel: Arc<Mutex<ssh2::Channel>>,
    pub session: Arc<Mutex<Session>>,
    pub sftp: Arc<Mutex<Option<Sftp>>>,
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

#[derive(Debug, Clone, Serialize)]
pub struct SftpFile {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: String,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionDetails {
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub password: Option<String>,
    #[serde(rename = "private_key_path")]
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    #[serde(rename = "authMethod")]
    #[allow(dead_code)]
    pub auth_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedHost {
    pub id: String,
    pub name: String,
    pub details: ConnectionDetails,
}

#[derive(Debug, Clone, Serialize)]
struct TerminalOutputPayload {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
struct TransferProgressPayload {
    session_id: String,
    file_path: String,
    transferred_bytes: u64,
    total_bytes: u64,
}

#[derive(Debug, Error)]
enum TransferError {
    #[error("Session not found")]
    SessionMissing,
    #[error("SFTP session not initialized")]
    SftpNotInitialized,
    #[error("Invalid session identifier")]
    InvalidSessionId,
    #[error("{0}")]
    Io(String),
}

impl From<std::io::Error> for TransferError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<uuid::Error> for TransferError {
    fn from(_: uuid::Error) -> Self {
        Self::InvalidSessionId
    }
}

#[tauri::command]
async fn connect_ssh(
    details: ConnectionDetails,
    state: State<'_, AppState>,
    window: Window,
) -> Result<String, String> {
    let sessions = state.sessions.clone();
    let window_clone = window.clone();

    async_runtime::spawn_blocking(move || {
        info!(target = "connect_ssh", host = %details.host, "Starting SSH connection");
        let session_id = Uuid::new_v4();
        let host = details.host;
        let port = details.port.unwrap_or(22);
        let addr = format!("{}:{}", host, port);

        info!(target = "connect_ssh", %addr, "Connecting TCP");
        let tcp = TcpStream::connect(&addr).map_err(|e| {
            error!(target = "connect_ssh", error = %e, "TCP connect failed");
            e.to_string()
        })?;
        info!(target = "connect_ssh", "TCP connected");
        let mut sess = Session::new().map_err(|e| e.to_string())?;
        sess.set_tcp_stream(tcp);

        info!(target = "connect_ssh", "Performing SSH handshake");
        sess.handshake().map_err(|e| {
            error!(target = "connect_ssh", error = %e, "Handshake failed");
            e.to_string()
        })?;
        info!(target = "connect_ssh", "Handshake complete");

        if let Some(key_path) = details.private_key_path {
            info!(target = "connect_ssh", "Authenticating with key");
            sess.userauth_pubkey_file(
                &details.username,
                None,
                Path::new(&key_path),
                details.passphrase.as_deref(),
            )
            .map_err(|e| {
                error!(target = "connect_ssh", error = %e, "Key authentication failed");
                format!("Key authentication failed: {}", e)
            })?;
        } else if let Some(password) = details.password {
            info!(target = "connect_ssh", "Authenticating with password");
            sess.userauth_password(&details.username, &password)
                .map_err(|e| {
                    error!(target = "connect_ssh", error = %e, "Password authentication failed");
                    format!("Password authentication failed: {}", e)
                })?;
        } else {
            return Err("No password or private key provided".to_string());
        }

        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }

        info!(target = "connect_ssh", "Opening channel session");
        let mut channel = sess.channel_session().map_err(|e| {
            error!(target = "connect_ssh", error = %e, "Channel creation failed");
            e.to_string()
        })?;
        channel
            .request_pty("xterm-256color", None, None)
            .map_err(|e| {
                error!(target = "connect_ssh", error = %e, "PTY request failed");
                e.to_string()
            })?;
        channel.shell().map_err(|e| {
            error!(target = "connect_ssh", error = %e, "Shell start failed");
            e.to_string()
        })?;
        info!(target = "connect_ssh", "Channel ready");

        let channel_arc = Arc::new(Mutex::new(channel));
        sess.set_blocking(false);
        let session_arc = Arc::new(Mutex::new(sess));

        sessions.insert(
            session_id,
            SessionState {
                channel: channel_arc.clone(),
                session: session_arc.clone(),
                sftp: Arc::new(Mutex::new(None)),
            },
        );

        let reader_window = window_clone.clone();
        let reader_session_id = session_id.to_string();
        thread::spawn(move || {
            let mut buffer = [0; 4096];
            loop {
                match channel_arc.lock() {
                    Ok(mut channel_lock) => {
                        match channel_lock.read(&mut buffer) {
                            Ok(bytes_read) => {
                                if bytes_read == 0 {
                                    info!(target = "connect_ssh", session = %reader_session_id, "SSH stream closed");
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
                                if e.kind() == std::io::ErrorKind::WouldBlock {
                                    drop(channel_lock);
                                    thread::sleep(Duration::from_millis(10));
                                    continue;
                                }
                                warn!(target = "connect_ssh", session = %reader_session_id, error = %e, "Error reading SSH stream");
                                break;
                            }
                        }
                    },
                    Err(e) => {
                        warn!(target = "connect_ssh", session = %reader_session_id, error = %e, "Channel lock poisoned");
                        break;
                    }
                }
            }
        });

        info!(target = "connect_ssh", session = %session_id, "SSH connection established");
        Ok(session_id.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
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

#[tauri::command]
fn close_session(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    
    if let Some((_, session)) = state.sessions.remove(&uuid) {
        let mut channel = session.channel.lock().unwrap();
        if let Err(e) = channel.send_eof() {
            eprintln!("Failed to send EOF for session {}: {}", session_id, e);
        }
        if let Err(e) = channel.close() {
            eprintln!("Failed to close channel for session {}: {}", session_id, e);
        }
        if let Err(e) = channel.wait_close() {
            eprintln!("Failed to wait for channel close for session {}: {}", session_id, e);
        }
        println!("Closed and removed session {}", session_id);
    } else {
        println!("Attempted to close non-existent session {}", session_id);
    }
    Ok(())
}

#[tauri::command]
fn update_host(
    updated_host: SavedHost,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut hosts = load_saved_hosts(app_handle.clone())?;
    
    if let Some(pos) = hosts.iter().position(|h| h.id == updated_host.id) {
        hosts[pos] = updated_host;
    } else {
        return Err("Host to update not found".to_string());
    }

    let path = get_connections_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_host(host_id: String, app_handle: AppHandle) -> Result<(), String> {
    let mut hosts = load_saved_hosts(app_handle.clone())?;
    
    hosts.retain(|h| h.id != host_id);

    let path = get_connections_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&hosts).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn list_directory(session_id: String, path: String, state: State<'_, AppState>) -> Result<Vec<SftpFile>, String> {
    let uuid = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    
    if let Some(session_state) = state.sessions.get(&uuid) {
        // Check if SFTP is already initialized
        let mut sftp_lock = session_state.sftp.lock().unwrap();
        
        // Lazy initialization: create SFTP if it doesn't exist
        if sftp_lock.is_none() {
            let session_lock = session_state.session.lock().unwrap();
            match session_lock.sftp() {
                Ok(sftp) => {
                    *sftp_lock = Some(sftp);
                }
                Err(e) => {
                    return Err(format!("Failed to initialize SFTP: {}", e));
                }
            }
        }
        
        if let Some(sftp) = &*sftp_lock {
            let entries = sftp.readdir(PathBuf::from(&path).as_path()).map_err(|e| e.to_string())?;
            
            let mut files: Vec<SftpFile> = entries.into_iter().map(|(entry_path, stat)| {
                let name = entry_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                
                let permissions = stat
                    .perm
                    .map(|p| format!("{:03o}", p))
                    .unwrap_or_else(|| "---------".to_string());
                
                SftpFile {
                    name,
                    is_dir: stat.is_dir(),
                    size: stat.size.unwrap_or(0),
                    modified: stat.mtime.unwrap_or(0),
                    permissions,
                }
            }).collect();

            files.sort_by(|a, b| {
                if a.is_dir != b.is_dir {
                    return b.is_dir.cmp(&a.is_dir);
                }
                a.name.cmp(&b.name)
            });

            Ok(files)
        } else {
            Err("SFTP session not available".to_string())
        }
    } else {
        Err("Session not found".to_string())
    }
}

fn ensure_sftp(session_state: &SessionState) -> Result<(), TransferError> {
    let mut sftp_lock = session_state.sftp.lock().unwrap();

    if sftp_lock.is_none() {
        let session_lock = session_state.session.lock().unwrap();
        let sftp = session_lock
            .sftp()
            .map_err(|e| TransferError::Io(format!("Failed to initialize SFTP: {}", e)))?;
        info!(target = "sftp", "Initialized SFTP session");
        *sftp_lock = Some(sftp);
    }

    Ok(())
}

fn emit_transfer_progress(window: &Window, payload: TransferProgressPayload) {
    let _ = window.emit("transfer-progress", payload);
}

#[tauri::command]
async fn download_file(
    session_id: String,
    remote_path: String,
    local_path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sessions = state.sessions.clone();
    let window_clone = window.clone();

    async_runtime::spawn_blocking(move || {
        let uuid = Uuid::parse_str(&session_id).map_err(TransferError::from)?;
        let session_entry = sessions
            .get(&uuid)
            .ok_or(TransferError::SessionMissing)?;
        let session_state = session_entry.value();

        ensure_sftp(session_state)?;
        info!(target = "sftp_upload", session = %session_id, local = %local_path, remote = %remote_path, "Starting upload");
        info!(target = "sftp_download", session = %session_id, remote = %remote_path, local = %local_path, "Starting download");

        let remote_path_buf = PathBuf::from(&remote_path);
        let mut remote_file = {
            let sftp_lock = session_state.sftp.lock().unwrap();
            let sftp = sftp_lock
                .as_ref()
                .ok_or(TransferError::SftpNotInitialized)?;
            sftp.open(&remote_path_buf)
                .map_err(|e| TransferError::Io(e.to_string()))?
        };

        let mut local_file = File::create(&local_path).map_err(TransferError::from)?;

        let total_bytes = remote_file
            .stat()
            .ok()
            .and_then(|s| s.size)
            .unwrap_or(0);
        let mut transferred_bytes = 0u64;
        let mut buffer = [0u8; 32 * 1024];

        loop {
            let bytes_read = remote_file
                .read(&mut buffer)
                .map_err(|e| TransferError::Io(e.to_string()))?;

            if bytes_read == 0 {
                break;
            }

            local_file
                .write_all(&buffer[..bytes_read])
                .map_err(TransferError::from)?;

            transferred_bytes += bytes_read as u64;

            emit_transfer_progress(
                &window_clone,
                TransferProgressPayload {
                    session_id: session_id.clone(),
                    file_path: remote_path_buf.to_string_lossy().into_owned(),
                    transferred_bytes,
                    total_bytes,
                },
            );
        }

        info!(target = "sftp_download", session = %session_id, "Download complete");
        info!(target = "sftp_upload", session = %session_id, "Upload complete");
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: TransferError| e.to_string())
}

#[tauri::command]
async fn upload_file(
    session_id: String,
    local_path: String,
    remote_path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sessions = state.sessions.clone();
    let window_clone = window.clone();

    async_runtime::spawn_blocking(move || {
        let uuid = Uuid::parse_str(&session_id).map_err(TransferError::from)?;
        let session_entry = sessions
            .get(&uuid)
            .ok_or(TransferError::SessionMissing)?;
        let session_state = session_entry.value();

        ensure_sftp(session_state)?;

        let remote_path_buf = PathBuf::from(&remote_path);
        let mut remote_file = {
            let sftp_lock = session_state.sftp.lock().unwrap();
            let sftp = sftp_lock
                .as_ref()
                .ok_or(TransferError::SftpNotInitialized)?;
            sftp.create(&remote_path_buf)
                .map_err(|e| TransferError::Io(e.to_string()))?
        };

        let mut local_file = File::open(&local_path).map_err(TransferError::from)?;

        let total_bytes = local_file.metadata().map(|meta| meta.len()).unwrap_or(0);
        let mut transferred_bytes = 0u64;
        let mut buffer = [0u8; 32 * 1024];

        loop {
            let bytes_read = local_file
                .read(&mut buffer)
                .map_err(TransferError::from)?;

            if bytes_read == 0 {
                break;
            }

            remote_file
                .write_all(&buffer[..bytes_read])
                .map_err(|e| TransferError::Io(e.to_string()))?;

            transferred_bytes += bytes_read as u64;

            emit_transfer_progress(
                &window_clone,
                TransferProgressPayload {
                    session_id: session_id.clone(),
                    file_path: local_path.clone(),
                    transferred_bytes,
                    total_bytes,
                },
            );
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: TransferError| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(tracing::Level::INFO)
        .finish();
    let _ = tracing::subscriber::set_global_default(subscriber);

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
            save_new_host,
            close_session,
            update_host,
            delete_host,
            list_directory,
            download_file,
            upload_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
