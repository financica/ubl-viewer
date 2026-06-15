//! Native shell for UBL Viewer.
//!
//! The native side's only real job is file entry (§6): capture the file the app
//! was launched with (double-click association / CLI), and forward any
//! subsequent launches to the running instance instead of spawning a new one.
//! Everything else — decoding, parsing, rendering, printing — happens in the
//! webview, on-device, with no network (§11).

use std::sync::Mutex;

use tauri::{Manager, State};

/// Holds the file path the app was launched with (if any), until the frontend
/// picks it up exactly once via [`take_launch_file`].
struct LaunchFile(Mutex<Option<String>>);

/// Returns the first argument that looks like a file path (skips the executable
/// and any `-`/`--` flags). Matches the activation argv that MSIX file-type
/// associations pass on the command line (§7b).
fn file_arg(argv: &[String]) -> Option<String> {
    argv.iter().skip(1).find(|a| !a.starts_with('-')).cloned()
}

/// The frontend calls this once on startup to pick up a launch-time file.
#[tauri::command]
fn take_launch_file(state: State<LaunchFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single instance must be the first plugin registered (Tauri requirement).
    // Desktop-only: on mobile there is no second-process launch to forward.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::Emitter;
            if let Some(path) = file_arg(&argv) {
                let _ = app.emit("open-file", path);
            }
            // Bring the existing window forward for the new request.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .setup(|app| {
            // First launch: the file (if any) is in this process's argv.
            let path = file_arg(&std::env::args().collect::<Vec<_>>());
            app.manage(LaunchFile(Mutex::new(path)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![take_launch_file])
        .run(tauri::generate_context!())
        .expect("error while running UBL Viewer");
}

#[cfg(test)]
mod tests {
    use super::file_arg;

    fn argv(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn picks_first_non_flag_argument() {
        let a = argv(&["ubl-viewer.exe", "C:/Users/me/invoice.xml"]);
        assert_eq!(file_arg(&a).as_deref(), Some("C:/Users/me/invoice.xml"));
    }

    #[test]
    fn skips_flags() {
        let a = argv(&["ubl-viewer", "--flag", "/home/me/credit-note.xml"]);
        assert_eq!(file_arg(&a).as_deref(), Some("/home/me/credit-note.xml"));
    }

    #[test]
    fn none_when_no_file() {
        let a = argv(&["ubl-viewer"]);
        assert_eq!(file_arg(&a), None);
    }
}
