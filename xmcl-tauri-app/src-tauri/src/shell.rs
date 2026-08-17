//! The command channel from the Node sidecar to this shell.
//!
//! The bridge server lives inside the sidecar, so it can only answer the
//! webview. Window, tray and lifecycle operations travel the other way: the
//! sidecar prints one JSON line per command on stdout prefixed with
//! [`MARKER`], and the shell answers with [`ShellEvent`] lines on its stdin.
//! Keep this file in sync with `bridge/shell.ts`.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::window::{ProgressBarState, ProgressBarStatus};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::sidecar::Sidecar;

/// Prefix of a command line on the sidecar's stdout.
pub const MARKER: &str = "@@XMCL_SHELL@@";

const TRAY_ID: &str = "xmcl-tray";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSpec {
  pub label: String,
  pub url: String,
  pub title: String,
  pub width: f64,
  pub height: f64,
  pub min_width: Option<f64>,
  pub min_height: Option<f64>,
  pub x: Option<f64>,
  pub y: Option<f64>,
  #[serde(default)]
  pub maximized: bool,
  pub decorations: bool,
  #[serde(default)]
  pub transparent: bool,
  pub resizable: Option<bool>,
  #[serde(default)]
  pub hide_on_close: bool,
  pub background_color: Option<String>,
  /// Navigations starting with this prefix are cancelled and reported to the
  /// sidecar instead: how the OAuth redirect is captured without a preload.
  pub navigate_intercept: Option<String>,
  /// Which renderer bridge to inject: `"index"` (default) for the launcher
  /// windows, `"browse"` for the app browser, `"none"` for third-party pages
  /// such as the Microsoft sign-in flow, which must not see the bridge.
  pub preload: Option<String>,
}

#[derive(Deserialize)]
pub struct TrayMenuItem {
  pub id: String,
  pub label: String,
  pub enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ShellCommand {
  OpenWindow {
    spec: WindowSpec,
  },
  CloseWindow {
    label: String,
  },
  FocusWindow {
    label: String,
  },
  ShowWindow {
    label: String,
  },
  Quit,
  Exit {
    code: i32,
  },
  Relaunch {
    args: Option<Vec<String>>,
  },
  SetTray {
    tooltip: Option<String>,
    icon: Option<String>,
    menu: Option<Vec<TrayMenuItem>>,
  },
  SetProgress {
    label: String,
    progress: f64,
  },
  FlashFrame {
    label: String,
    flash: bool,
  },
  RegisterProtocol {
    protocol: String,
  },
  CheckUpdate,
  DownloadUpdate,
  InstallUpdate,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ShellEvent {
  WindowClosed {
    label: String,
  },
  WindowAllClosed,
  Navigate {
    label: String,
    url: String,
  },
  SecondInstance {
    argv: Vec<String>,
  },
  DeepLink {
    url: String,
  },
  TrayClick {
    id: String,
  },
  UpdateAvailable {
    version: String,
    notes: Option<String>,
    date: Option<String>,
  },
  UpdateNotAvailable,
  UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
  },
  UpdateDownloaded,
  UpdateError {
    message: String,
  },
}

/// The initialization scripts a window can get, by [`WindowSpec::preload`]
/// name: the bridge endpoint plus the matching compiled renderer shim. Windows
/// are created on demand by the sidecar, so the scripts have to outlive
/// `setup`.
pub struct Preload(pub HashMap<String, String>);

/// Windows the sidecar asked to keep alive when closed.
#[derive(Default)]
pub struct HiddenOnClose(pub Mutex<Vec<String>>);

/// Apply a command. Must run on the main thread: window and tray creation are
/// main-thread only on Linux and macOS.
pub fn apply<R: Runtime>(app: &AppHandle<R>, command: ShellCommand) {
  match command {
    ShellCommand::OpenWindow { spec } => open_window(app, spec),
    ShellCommand::CloseWindow { label } => {
      if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
      }
    }
    ShellCommand::FocusWindow { label } => {
      if let Some(window) = app.get_webview_window(&label) {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }
    ShellCommand::ShowWindow { label } => {
      if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
      }
    }
    ShellCommand::Quit => app.exit(0),
    ShellCommand::Exit { code } => app.exit(code),
    ShellCommand::Relaunch { args } => {
      // `restart` never returns, so the sidecar is stopped first to avoid
      // leaving an orphan holding the game data lock.
      if let Some(sidecar) = app.try_state::<Sidecar>() {
        sidecar.shutdown();
      }
      if let Some(args) = args {
        if !args.is_empty() {
          eprintln!("[shell] relaunch arguments are not forwarded yet: {args:?}");
        }
      }
      app.restart();
    }
    ShellCommand::SetTray {
      tooltip,
      icon,
      menu,
    } => set_tray(app, tooltip, icon, menu),
    ShellCommand::SetProgress { label, progress } => {
      if let Some(window) = app.get_webview_window(&label) {
        let state = if progress < 0.0 {
          ProgressBarState {
            status: Some(ProgressBarStatus::None),
            progress: None,
          }
        } else {
          ProgressBarState {
            status: Some(ProgressBarStatus::Normal),
            progress: Some((progress.clamp(0.0, 1.0) * 100.0) as u64),
          }
        };
        let _ = window.set_progress_bar(state);
      }
    }
    ShellCommand::FlashFrame { label, flash } => {
      if let Some(window) = app.get_webview_window(&label) {
        let _ = window.request_user_attention(flash.then_some(tauri::UserAttentionType::Informational));
      }
    }
    ShellCommand::RegisterProtocol { protocol } => {
      // The bundle declares the scheme, and the deep-link plugin owns the
      // runtime registration; log it so a missing declaration is visible.
      println!("[shell] sidecar requested the '{protocol}' scheme");
    }
    ShellCommand::CheckUpdate => crate::updater::check(app),
    ShellCommand::DownloadUpdate => crate::updater::download(app),
    ShellCommand::InstallUpdate => crate::updater::install(app),
  }
}

fn open_window<R: Runtime>(app: &AppHandle<R>, spec: WindowSpec) {
  if let Some(existing) = app.get_webview_window(&spec.label) {
    let _ = existing.show();
    let _ = existing.set_focus();
    return;
  }
  let url = match spec.url.parse() {
    Ok(url) => WebviewUrl::External(url),
    Err(e) => {
      eprintln!("[shell] window '{}' has an invalid url: {e}", spec.label);
      return;
    }
  };
  let mut builder = WebviewWindowBuilder::new(app, spec.label.clone(), url)
    .title(spec.title)
    .inner_size(spec.width, spec.height)
    .decorations(spec.decorations)
    .transparent(spec.transparent)
    .visible(false);
  let preload = spec.preload.as_deref().unwrap_or("index");
  if preload != "none" {
    match app
      .try_state::<Preload>()
      .and_then(|p| p.0.get(preload).cloned())
    {
      Some(script) => builder = builder.initialization_script(&script),
      None => eprintln!(
        "[shell] window '{}' asked for the unknown '{preload}' bridge",
        spec.label
      ),
    }
  }
  if let Some(prefix) = spec.navigate_intercept.clone() {
    let handle = app.clone();
    let label = spec.label.clone();
    builder = builder.on_navigation(move |url| {
      let url = url.to_string();
      if !url.starts_with(&prefix) {
        return true;
      }
      send(
        &handle,
        &ShellEvent::Navigate {
          label: label.clone(),
          url,
        },
      );
      false
    });
  }
  if let (Some(w), Some(h)) = (spec.min_width, spec.min_height) {
    builder = builder.min_inner_size(w, h);
  }
  if let (Some(x), Some(y)) = (spec.x, spec.y) {
    builder = builder.position(x, y);
  }
  if let Some(resizable) = spec.resizable {
    builder = builder.resizable(resizable);
  }
  if let Some(color) = spec.background_color.as_deref().and_then(parse_color) {
    builder = builder.background_color(color);
  }
  if spec.maximized {
    builder = builder.maximized(true);
  }

  let window = match builder.build() {
    Ok(window) => window,
    Err(e) => {
      eprintln!("[shell] cannot create window '{}': {e}", spec.label);
      return;
    }
  };
  if spec.hide_on_close {
    if let Some(hidden) = app.try_state::<HiddenOnClose>() {
      hidden.0.lock().unwrap().push(spec.label.clone());
    }
  }
  let _ = window.show();
  crate::watch_window(app, &window);
}

/// `0x424242` and `#424242` both appear in the app manifests.
fn parse_color(value: &str) -> Option<tauri::window::Color> {
  let hex = value
    .trim()
    .trim_start_matches('#')
    .trim_start_matches("0x")
    .trim_start_matches("0X");
  if hex.len() != 6 && hex.len() != 8 {
    return None;
  }
  let bytes = (0..hex.len() / 2)
    .map(|i| u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16))
    .collect::<Result<Vec<_>, _>>()
    .ok()?;
  Some(tauri::window::Color(
    bytes[0],
    bytes[1],
    bytes[2],
    *bytes.get(3).unwrap_or(&255),
  ))
}

fn set_tray<R: Runtime>(
  app: &AppHandle<R>,
  tooltip: Option<String>,
  icon: Option<String>,
  items: Option<Vec<TrayMenuItem>>,
) {
  let id = TrayIconId::new(TRAY_ID);
  let existing = app.tray_by_id(&id);
  let mut builder = TrayIconBuilder::with_id(id.clone());
  if let Some(tooltip) = tooltip.clone() {
    builder = builder.tooltip(tooltip);
  }
  if let Some(path) = icon.clone() {
    match tauri::image::Image::from_path(&path) {
      Ok(image) => builder = builder.icon(image),
      Err(e) => eprintln!("[shell] cannot read the tray icon {path}: {e}"),
    }
  }
  if let Some(items) = items {
    let mut menu = MenuBuilder::new(app);
    for item in items {
      match MenuItemBuilder::with_id(item.id, item.label)
        .enabled(item.enabled.unwrap_or(true))
        .build(app)
      {
        Ok(entry) => menu = menu.item(&entry),
        Err(e) => eprintln!("[shell] cannot build a tray entry: {e}"),
      }
    }
    match menu.build() {
      Ok(menu) => builder = builder.menu(&menu),
      Err(e) => eprintln!("[shell] cannot build the tray menu: {e}"),
    }
  }

  let handle = app.clone();
  builder = builder
    .on_menu_event(move |app, event| {
      send(app, &ShellEvent::TrayClick { id: event.id().0.clone() });
    })
    .on_tray_icon_event(move |_, event| {
      if let TrayIconEvent::Click { .. } = event {
        send(&handle, &ShellEvent::TrayClick { id: "__click__".to_owned() });
      }
    });

  // Tauri keeps one tray per id; rebuilding it is how the runtime updates the
  // icon or the menu.
  if existing.is_some() {
    app.remove_tray_by_id(&TrayIconId::new(TRAY_ID));
  }
  if let Err(e) = builder.build(app) {
    eprintln!("[shell] cannot create the tray icon: {e}");
  }
}

/// Send an event to the sidecar, ignoring it when the sidecar is restarting.
pub fn send<R: Runtime>(app: &AppHandle<R>, event: &ShellEvent) {
  let Some(sidecar) = app.try_state::<Sidecar>() else {
    return;
  };
  let Ok(line) = serde_json::to_string(event) else {
    return;
  };
  sidecar.send_line(&line);
}

/// React to a window closing: tell the sidecar, and keep the windows the
/// runtime marked as hide-on-close alive.
pub fn on_window_event<R: Runtime>(app: &AppHandle<R>, label: &str, event: &WindowEvent) {
  if let WindowEvent::CloseRequested { api, .. } = event {
    let hidden = app
      .try_state::<HiddenOnClose>()
      .map(|h| h.0.lock().unwrap().iter().any(|l| l == label))
      .unwrap_or(false);
    if hidden {
      api.prevent_close();
      if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
      }
      return;
    }
  }
  if let WindowEvent::Destroyed = event {
    send(
      app,
      &ShellEvent::WindowClosed {
        label: label.to_owned(),
      },
    );
    // The window being destroyed can still be listed here.
    if app.webview_windows().keys().all(|l| l == label) {
      send(app, &ShellEvent::WindowAllClosed);
    }
  }
}
