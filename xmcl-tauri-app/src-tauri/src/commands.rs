//! Native channels of the renderer bridge.
//!
//! The webview keeps talking the same channel names the Electron preload uses
//! (`control`, `get-monitors`, `dialog:showOpenDialog`, ...). Runtime channels
//! go to the Node sidecar over the WebSocket bridge; the ones below are the
//! window/OS half, which lives here instead of in `ElectronController`.

use serde::Serialize;
use tauri::image::Image;
use tauri::{PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Mirrors `xmcl-electron-app/preload/controller.ts`'s `Operation`.
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(try_from = "u8")]
pub enum Operation {
  Minimize,
  Maximize,
  Hide,
  Show,
  Close,
}

impl TryFrom<u8> for Operation {
  type Error = String;

  fn try_from(value: u8) -> Result<Self, Self::Error> {
    match value {
      0 => Ok(Operation::Minimize),
      1 => Ok(Operation::Maximize),
      2 => Ok(Operation::Hide),
      3 => Ok(Operation::Show),
      4 => Ok(Operation::Close),
      other => Err(format!("unknown window operation {other}")),
    }
  }
}

#[derive(Serialize)]
pub struct Monitor {
  name: Option<String>,
  scale_factor: f64,
  size: PhysicalSize<u32>,
  position: PhysicalPosition<i32>,
  primary: bool,
}

#[tauri::command]
pub async fn control<R: Runtime>(window: WebviewWindow<R>, operation: Operation) -> Result<(), String> {
  let result = match operation {
    Operation::Minimize => window.minimize(),
    // The UI uses `maximize` as a toggle (see `AppSystemBar.vue`).
    Operation::Maximize => match window.is_maximized() {
      Ok(true) => window.unmaximize(),
      _ => window.maximize(),
    },
    Operation::Hide => window.hide(),
    Operation::Show => window.show(),
    Operation::Close => window.close(),
  };
  result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn focus<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
  window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn flash_frame<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
  window
    .request_user_attention(Some(tauri::UserAttentionType::Informational))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_monitors<R: Runtime>(window: WebviewWindow<R>) -> Result<Vec<Monitor>, String> {
  let primary = window
    .primary_monitor()
    .map_err(|e| e.to_string())?
    .and_then(|m| m.name().cloned());
  let monitors = window
    .available_monitors()
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|monitor| Monitor {
      primary: primary.is_some() && primary.as_deref() == monitor.name().map(|n| n.as_str()),
      name: monitor.name().cloned(),
      scale_factor: monitor.scale_factor(),
      size: *monitor.size(),
      position: *monitor.position(),
    })
    .collect();
  Ok(monitors)
}

/// Electron reports whether the renderer may capture audio. WebKitGTK has no
/// equivalent permission gate, so the capability is simply present.
#[tauri::command]
pub async fn query_audio_permission() -> bool {
  true
}

/// Window translucency (macOS vibrancy / Windows mica) needs the platform
/// specific effects the shell does not set up yet; the UI treats the call as
/// best-effort, so acknowledge it instead of failing the renderer.
#[tauri::command]
pub async fn set_translucent(enable: bool) {
  println!("[shell] set-translucent({enable}) is not implemented yet");
}

#[tauri::command]
pub async fn write_clipboard<R: Runtime>(
  window: WebviewWindow<R>,
  text: String,
) -> Result<(), String> {
  window.clipboard().write_text(text).map_err(|e| e.to_string())
}

/// The renderer rasterizes the image it wants to copy — WebKitGTK is the only
/// component able to decode every URL the UI may hand over — and passes the
/// raw pixels here.
#[tauri::command]
pub async fn write_clipboard_image<R: Runtime>(
  window: WebviewWindow<R>,
  rgba: Vec<u8>,
  width: u32,
  height: u32,
) -> Result<(), String> {
  let expected = (width as usize) * (height as usize) * 4;
  if rgba.len() != expected {
    return Err(format!("expected {expected} bytes of RGBA, got {}", rgba.len()));
  }
  window
    .clipboard()
    .write_image(&Image::new(&rgba, width, height))
    .map_err(|e| e.to_string())
}
