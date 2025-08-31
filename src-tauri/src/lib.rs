// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::{
    fs::{remove_file, File, OpenOptions},
    io::{BufReader, BufWriter},
    thread::{sleep, spawn},
    time::Duration,
};

use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle, Emitter};

#[derive(Serialize, Deserialize, Default)]
struct ClipboardHistory {
    items: Vec<String>,
}

#[tauri::command]
fn wipe_all() {
    let _ = remove_file(PATH);
}

#[tauri::command]
fn copy(data: String) {
    let mut clipboard = Clipboard::new().unwrap();
    clipboard.set_text(data).unwrap();
}

fn load_history() -> Result<ClipboardHistory, std::io::Error> {
    let file = File::open(PATH)?;
    let reader = BufReader::new(file);
    let history = serde_json::from_reader(reader)?;
    Ok(history)
}

fn save_history(history: &ClipboardHistory) -> Result<(), std::io::Error> {
    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(PATH)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, history)?;

    Ok(())
}

#[tauri::command]
fn load_last_n_entries(n: usize) -> Vec<String> {
    let Ok(history) = load_history() else {
        return vec![];
    };
    history.items.into_iter().rev().take(n).collect()
}

#[tauri::command]
fn init_with_channel(on_event: Channel<String>) {
    spawn(move || {
        let mut clipboard = Clipboard::new().unwrap();

        loop {
            match clipboard.get_text() {
                Ok(data) => {
                    let mut history = load_history().unwrap_or_default();
                    if history
                        .items
                        .last()
                        .map(|last| last != &data)
                        .unwrap_or(true)
                    {
                        history.items.push(data.clone());
                        save_history(&history).unwrap();
                        on_event.send(data).unwrap();
                    }
                }
                Err(err) => println!("Error: {}", err),
            }
            sleep(Duration::from_secs(2))
        }
    });
}

#[tauri::command]
fn init_with_emit(app: AppHandle) {
    spawn(move || {
        let mut clipboard = Clipboard::new().unwrap();

        loop {
            match clipboard.get_text() {
                Ok(data) => {
                    let mut history = load_history().unwrap_or_default();
                    if history
                        .items
                        .last()
                        .map(|last| last != &data)
                        .unwrap_or(true)
                    {
                        history.items.push(data.clone());
                        save_history(&history).unwrap();

                        // 使用 emit 发送事件
                        app.emit("clipboard-updated", &data).unwrap();
                    }
                }
                Err(err) => println!("Error: {}", err),
            }
            sleep(Duration::from_secs(2))
        }
    });
}

const PATH: &str = "C:\\Users\\22758\\Desktop\\clipboard-history.json";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            wipe_all,
            copy,
            load_last_n_entries,
            init_with_channel,
            init_with_emit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
