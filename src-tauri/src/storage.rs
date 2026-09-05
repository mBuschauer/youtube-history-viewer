use crate::{db, history};
use chrono::{SecondsFormat, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use uuid::Uuid;

pub const PROJECTS_DIR: &str = "projects";

pub fn data_root() -> &'static Path {
    static DATA_ROOT: OnceLock<PathBuf> = OnceLock::new();
    DATA_ROOT.get_or_init(|| {
        let root = ProjectDirs::from("", "", "youtube-history-viewer")
            .expect("could not determine a platform data directory (no valid home directory?)")
            .data_dir()
            .to_path_buf();
        fs::create_dir_all(&root)
            .unwrap_or_else(|e| panic!("failed to create data directory {}: {e}", root.display()));
        root
    })
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DatasetType {
    YoutubeHistory,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DatasetStatus {
    Failed,
    Uploaded,
    Parsing,
    Parsed,
    Complete,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Clone)]
#[serde(rename_all = "snake_case")]
pub enum RawType {
    Json,
    Html,
}

impl RawType {
    pub fn file_name(&self) -> &'static str {
        match self {
            RawType::Html => "watch-history.html",
            RawType::Json => "watch-history.json",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatasetMetadata {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub dataset_type: DatasetType,
    pub raw_type: RawType,
    pub raw_path: String,
    pub db_path: Option<String>,
    pub created_at: String,
    pub status: DatasetStatus,
    #[serde(default)]
    pub error: Option<String>,
}

pub fn list_datasets() -> std::io::Result<Vec<DatasetMetadata>> {
    let root = data_root().join(PROJECTS_DIR);

    let entries = match fs::read_dir(&root) {
        Ok(entries) => entries,
        // Nothing uploaded yet is an empty list, not an error
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };

    let mut datasets: Vec<DatasetMetadata> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            let id = entry.file_name().to_string_lossy().to_string();
            // Skip dirs with missing or corrupt metadata rather than failing the whole list
            DatasetStorage::open(&id)?.load_metadata().ok()
        })
        .collect();

    datasets.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(datasets)
}

#[derive(Clone)]
pub struct DatasetStorage {
    pub id: String,
    pub dir: PathBuf,
}

impl DatasetStorage {
    pub fn create(src: impl AsRef<Path>, name: impl Into<String>) -> std::io::Result<Self> {
        let src = src.as_ref();
        let raw_type = raw_type_for(src)?;
        let file_name = raw_type.file_name();

        let id = Uuid::new_v4().to_string();
        let dir = data_root().join(PROJECTS_DIR).join(&id);
        fs::create_dir_all(&dir)?;

        let tmp = dir.join(format!(".{file_name}.part"));
        fs::copy(src, &tmp)?;
        fs::rename(&tmp, dir.join(file_name))?;

        let storage = Self {
            id: id.clone(),
            dir,
        };
        storage.save_metadata(&DatasetMetadata {
            id,
            name: name.into(),
            dataset_type: DatasetType::YoutubeHistory,
            raw_type,
            raw_path: file_name.to_string(),
            db_path: None,
            created_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
            status: DatasetStatus::Uploaded,
            error: None,
        })?;

        Ok(storage)
    }

    pub fn open(id: &str) -> Option<Self> {
        let dir = data_root().join(PROJECTS_DIR).join(id);
        if dir.exists() && dir.is_dir() {
            Some(Self {
                id: id.to_string(),
                dir,
            })
        } else {
            None
        }
    }

    pub fn set_failed(&self, reason: impl Into<String>) -> std::io::Result<()> {
        let mut m = self.load_metadata()?;
        m.status = DatasetStatus::Failed;
        m.error = Some(reason.into());
        self.save_metadata(&m)
    }

    pub fn begin_parse(&self) -> std::io::Result<()> {
        // Fall back to the conventional location inside the dataset dir if the
        // stored path is missing or stale (e.g. after the data dir migrated).
        let raw_path = self.raw_path()?;
        if !raw_path.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Raw file is missing from the dataset directory",
            ));
        }
        let db_path = self.dir.join("database.sqlite");
        let storage = self.clone();

        let raw_type = self.load_metadata()?.raw_type;

        tauri::async_runtime::spawn_blocking(move || {
            let process = || -> Result<(), String> {
                let entries = history::parse_watch_history_file(raw_type, &raw_path).ok_or_else(|| {
                    format!("Failed to parse watch history file at {:?}", raw_path)
                })?;

                db::save_history_to_db(&entries, &db_path)
                    .map_err(|e| format!("Failed to save to database: {}", e))?;

                Ok(())
            };

            match process() {
                Ok(_) => {
                    if let Err(e) = storage.update_metadata(|m| {
                        m.status = DatasetStatus::Parsed;
                        m.db_path = Some("database.sqlite".to_string());
                    }) {
                        eprintln!("Failed to update metadata: {e}");
                    }
                }
                Err(e) => {
                    eprintln!("Error processing history: {e}");
                    if let Err(e2) = storage.set_failed(e) {
                        eprintln!("Failed to record failure: {e2}");
                    }
                }
            }
        });

        Ok(())
    }

    fn raw_path(&self) -> std::io::Result<PathBuf> {
        let metadata = self.load_metadata()?;
        Ok(self.dir.join(metadata.raw_path))
    }

    fn db_path(&self) -> std::io::Result<Option<PathBuf>> {
        Ok(self.load_metadata()?.db_path.map(|p| self.dir.join(p)))
    }

    pub fn metadata_path(&self) -> PathBuf {
        self.dir.join("metadata.json")
    }

    pub fn save_metadata(&self, metadata: &DatasetMetadata) -> std::io::Result<()> {
        let tmp = self.dir.join(".metadata.json.tmp");
        {
            let file = fs::File::create(&tmp)?;
            serde_json::to_writer_pretty(&file, metadata)?;
            file.sync_all()?;
        }
        fs::rename(&tmp, self.metadata_path())
    }

    pub fn load_metadata(&self) -> std::io::Result<DatasetMetadata> {
        let file = fs::File::open(self.metadata_path())?;
        let metadata = serde_json::from_reader(file)?;
        Ok(metadata)
    }


    pub async fn delete(&self) -> std::io::Result<()> {
        fs::remove_dir_all(&self.dir)
    }

    pub fn update_metadata<F>(&self, update_fn: F) -> std::io::Result<()>
    where
        F: FnOnce(&mut DatasetMetadata),
    {
        let mut metadata = self.load_metadata()?;
        let old_status = metadata.status.clone();

        update_fn(&mut metadata);

        // Ensure status only upgrades
        if metadata.status < old_status {
            metadata.status = old_status;
        }

        self.save_metadata(&metadata)
    }
}

fn raw_type_for(path: &Path) -> std::io::Result<RawType> {
    match path.extension().and_then(|e| e.to_str()) {
        Some(e) if e.eq_ignore_ascii_case("html") => Ok(RawType::Html),
        Some(e) if e.eq_ignore_ascii_case("json") => Ok(RawType::Json),
        _ => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Unsupported file type.",
        )),
    }
}
