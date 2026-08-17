//! Tauri shell of X Minecraft Launcher.
//!
//! The shell owns windows and OS integration only. `xmcl-runtime` keeps
//! running on Node as a supervised sidecar (see `sidecar.rs`), and the webview
//! reaches it through the loopback bridge whose port and token are injected by
//! [`initialization_script`]. Windows are not created here: the runtime decides
//! which app manifest to activate and asks for them over the shell channel
//! (see `shell.rs`), exactly as it drove `BrowserWindow` under Electron.

mod commands;
mod shell;
mod sidecar;

use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::channel;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, WindowEvent};

use tauri_plugin_deep_link::DeepLinkExt;

use shell::{HiddenOnClose, Preload, ShellEvent};

#[derive(Serialize)]
struct BridgeConfig {
  port: u16,
  token: String,
  dev: bool,
}

fn is_dev() -> bool {
  cfg!(debug_assertions) || std::env::var_os("XMCL_DEV_SERVER").is_some()
}

/// Build the script injected before any page script: the bridge endpoint plus
/// the compiled renderer shim that re-creates the preload globals.
fn initialization_script(preload: &str, config: &BridgeConfig) -> String {
  format!(
    "globalThis.__XMCL_BRIDGE__ = {};\n{}",
    serde_json::to_string(config).expect("bridge config is serializable"),
    preload
  )
}

/// Read every renderer bridge the sidecar can ask a window for. The names match
/// the preloads of the Electron target: `index` for the launcher windows and
/// `browse` for the app browser, which also gets `appsHost`.
fn read_preloads(dist: &Path, config: &BridgeConfig) -> Result<HashMap<String, String>, String> {
  [("index", "preload.js"), ("browse", "preload-browse.js")]
    .into_iter()
    .map(|(name, file)| {
      let path = dist.join(file);
      let script = std::fs::read_to_string(&path)
        .map_err(|e| format!("cannot read the renderer bridge at {}: {e}", path.display()))?;
      Ok((name.to_owned(), initialization_script(&script, config)))
    })
    .collect()
}

/// Deliver an event to the renderer bridge, standing in for the
/// `webContents.send` calls of `ElectronController`.
fn emit_native<R: Runtime>(window: &WebviewWindow<R>, channel: &str, payload: &serde_json::Value) {
  let script = format!(
    "globalThis.__XMCL_NATIVE_EVENT__?.({}, {})",
    serde_json::Value::String(channel.to_owned()),
    payload
  );
  if let Err(e) = window.eval(&script) {
    eprintln!("[shell] cannot deliver '{channel}' to the renderer: {e}");
  }
}

/// Subscribe to the events every launcher window needs: the maximized state the
/// UI mirrors in the titlebar it draws itself, the dropped paths WebKitGTK hides
/// from `File`, and the close/destroy notifications the runtime listens to.
pub fn watch_window<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
  let label = window.label().to_owned();
  let handle = app.clone();
  window.on_window_event(move |event| {
    shell::on_window_event(&handle, &label, event);
    let Some(window) = handle.get_webview_window(&label) else {
      return;
    };
    match event {
      WindowEvent::Resized(_) => {
        if let Ok(maximized) = window.is_maximized() {
          emit_native(&window, "maximize", &serde_json::Value::Bool(maximized));
        }
      }
      WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
        let paths = serde_json::Value::Array(
          paths
            .iter()
            .map(|p| serde_json::Value::String(p.to_string_lossy().to_string()))
            .collect(),
        );
        emit_native(&window, "drop-paths", &paths);
      }
      _ => {}
    }
  });
}

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      // The runtime decides what a second launch means: a deep link to handle,
      // a CLI command to run, or just a window to raise.
      shell::send(app, &ShellEvent::SecondInstance { argv });
    }))
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      commands::control,
      commands::focus,
      commands::flash_frame,
      commands::get_monitors,
      commands::query_audio_permission,
      commands::set_translucent,
      commands::write_clipboard,
      commands::write_clipboard_image,
    ])
    .setup(|app| {
      let dist = sidecar::resolve_dist_dir(app.path().resource_dir().ok());
      // The sidecar serves the renderer bundle itself, because the runtime has
      // to intercept its requests to inject the API credentials the way
      // `ElectronSession` did.
      if std::env::var_os("XMCL_RENDERER_DIST").is_none() {
        std::env::set_var("XMCL_RENDERER_DIST", dist.join("renderer"));
      }

      let (tx, rx) = channel::<String>();
      let sidecar = sidecar::start(&dist, tx)?;
      println!("[shell] bridge listening on 127.0.0.1:{}", sidecar.port);

      app.manage(Preload(read_preloads(
        &dist,
        &BridgeConfig {
          port: sidecar.port,
          token: sidecar.token.clone(),
          dev: is_dev(),
        },
      )?));
      app.manage(HiddenOnClose::default());
      app.manage(sidecar);

      // On Linux and Windows a link arrives as a second launch, which the
      // single-instance plugin already forwards; macOS delivers it here.
      let deep_link_handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
          shell::send(
            &deep_link_handle,
            &ShellEvent::DeepLink {
              url: url.to_string(),
            },
          );
        }
      });

      let handle = app.handle().clone();
      std::thread::spawn(move || {
        for line in rx {
          match serde_json::from_str::<shell::ShellCommand>(&line) {
            Ok(command) => {
              let handle = handle.clone();
              // Windows and the tray are main-thread only outside Windows.
              if let Err(e) = handle
                .clone()
                .run_on_main_thread(move || shell::apply(&handle, command))
              {
                eprintln!("[shell] cannot apply a sidecar command: {e}");
              }
            }
            Err(e) => eprintln!("[shell] cannot parse the sidecar command '{line}': {e}"),
          }
        }
      });

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building the XMCL shell")
    .run(|app, event| match event {
      tauri::RunEvent::Exit => app.state::<sidecar::Sidecar>().shutdown(),
      // The runtime owns the lifecycle: losing every window must not end the
      // process by itself, the sidecar decides (and then asks for an exit code).
      tauri::RunEvent::ExitRequested { api, code, .. } => {
        if code.is_none() {
          api.prevent_exit();
        }
      }
      _ => {}
    });
}
