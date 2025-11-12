use dashmap::DashMap;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub sessions: Arc<DashMap<Uuid, String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(DashMap::new()),
        }
    }
}

#[tauri::command]
fn create_new_session(state: State<AppState>) -> Result<String, String> {
    let session_id = Uuid::new_v4();
    state.sessions.insert(session_id, "pending".to_string());
    println!("Created new session with ID: {}", session_id);
    Ok(session_id.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![create_new_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
