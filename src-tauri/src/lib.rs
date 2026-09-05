mod db;
mod history;
mod storage;
mod videos;

use std::path::PathBuf;
use tauri_plugin_opener::{open_path};
use uuid::Uuid;

use crate::{
    db::WatchedHistoryEntry,
    storage::{PROJECTS_DIR, data_root, list_datasets, DatasetMetadata, DatasetStatus, DatasetStorage},
    videos::{fetch_local_videos, fetch_videos, LocalVideosResponse, VideoEntry},
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn backend_health_check() -> String {
    "ok".to_string()
}

#[tauri::command]
fn settings_location() -> String {
    data_root().join("settings.json").to_string_lossy().into_owned()
}

#[tauri::command]
fn open_location(id: Option<String>) -> String {
    let mut path = data_root().to_path_buf();
    if let Some(id) = id {
        path = path.join(PROJECTS_DIR).join(id);
    }
    match open_path(path, None::<&str>) {
        Ok(()) => "ok".to_string(),
        Err(e) => format!("error: {e}"),
    }
}

#[tauri::command]
fn get_datasets() -> Result<Vec<DatasetMetadata>, String> {
    list_datasets().map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_dataset(id: String) -> Result<(), String> {
    Uuid::parse_str(&id).map_err(|_| "Invalid dataset id".to_string())?;

    let storage = DatasetStorage::open(&id).ok_or_else(|| "Dataset not found".to_string())?;

    storage.delete().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_watch_history(path: String, name: Option<String>) -> Result<DatasetMetadata, String> {
    let src = PathBuf::from(&path);

    let name = name
        .filter(|n| !n.trim().is_empty())
        .or_else(|| src.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "watch-history".into());

    let storage = DatasetStorage::create(&src, name).map_err(|e| e.to_string())?;
    storage.begin_parse().map_err(|e| e.to_string())?;
    storage.load_metadata().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_dataset(id: String) -> Result<DatasetMetadata, String> {
    let storage = DatasetStorage::open(&id).ok_or("Dataset not found")?;
    storage.load_metadata().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_dataset_status(id: String) -> Result<DatasetStatus, String> {
    let storage = DatasetStorage::open(&id).ok_or("Dataset not found")?;
    Ok(storage.load_metadata().map_err(|e| e.to_string())?.status)
}

#[tauri::command]
fn get_dataset_history(id: String) -> Result<Vec<WatchedHistoryEntry>, String> {
    let storage = DatasetStorage::open(&id).ok_or("Dataset not found")?;
    let db_path = storage.dir.join("database.sqlite");

    if !db_path.exists() {
        return Err("Database for this dataset is missing or has not finished parsing".into());
    }

    db::get_watched_history(&db_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_local_videos(ids: Vec<String>) -> Result<LocalVideosResponse, String> {
    fetch_local_videos(&ids).await
}

#[tauri::command]
async fn get_videos(ids: Vec<String>, api_key: String) -> Result<Vec<VideoEntry>, String> {
    fetch_videos(&ids, &api_key).await
}
#[cfg(target_os = "linux")]
fn prefers_no_titlebar() -> bool {
    const TILING: &[&str] = &[ "hyprland", "sway", "i3", "river", "bspwm", "dwm", "awesome", "xmonad", "qtile", "niri", "wayfire", "herbstluftwm", "spectrwm", "leftwm" ];

    ["XDG_CURRENT_DESKTOP", "XDG_SESSION_DESKTOP", "DESKTOP_SESSION"]
        .iter()
        .filter_map(|key| std::env::var(key).ok())
        .any(|value| {
            value
                .to_ascii_lowercase()
                .split(':')
                .any(|part| TILING.contains(&part.trim()))
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if prefers_no_titlebar() {
                    if let Some(window) = _app.get_webview_window("main") {
                        let _ = window.set_decorations(false);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_health_check,
            open_location,
            settings_location,
            get_dataset,
            get_datasets,
            delete_dataset,
            import_watch_history,
            get_dataset_status,
            get_dataset_history,
            get_local_videos,
            get_videos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
