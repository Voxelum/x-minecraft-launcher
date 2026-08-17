//! In-place updates, the counterpart of `electron-updater`.
//!
//! The runtime keeps owning the update *policy* (when to check, what the user
//! agreed to, the pending-update flag it persists); this module only performs
//! the operations Electron did for it, driven from the shell channel and
//! reported back with [`ShellEvent`] lines. The Electron target is untouched and
//! keeps using `electron-updater`.
//!
//! Everything is delegated to `tauri-plugin-updater`, so an update is only
//! installed when it is signed with the key declared in `tauri.conf.json`. A
//! build without an endpoint or a public key (a development build, or a fork
//! that publishes no manifest) fails the check, which the sidecar reports as a
//! manual update, exactly as before.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::shell::{self, ShellEvent};
use crate::sidecar::Sidecar;

/// The update the runtime accepted, kept between the check, the download and
/// the install, because each one is a separate command.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Option<Vec<u8>>)>>);

fn fail<R: Runtime>(app: &AppHandle<R>, message: String) {
  shell::send(app, &ShellEvent::UpdateError { message });
}

fn take<R: Runtime>(app: &AppHandle<R>) -> Option<(Update, Option<Vec<u8>>)> {
  app
    .state::<PendingUpdate>()
    .0
    .lock()
    .ok()
    .and_then(|mut pending| pending.take())
}

fn keep<R: Runtime>(app: &AppHandle<R>, update: Update, bytes: Option<Vec<u8>>) {
  if let Ok(mut pending) = app.state::<PendingUpdate>().0.lock() {
    *pending = Some((update, bytes));
  }
}

/// Ask the endpoint for a newer release, reporting `update-available` or
/// `update-not-available`.
pub fn check<R: Runtime>(app: &AppHandle<R>) {
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let updater = match app.updater() {
      Ok(updater) => updater,
      Err(e) => return fail(&app, format!("this build has no update endpoint: {e}")),
    };
    match updater.check().await {
      Ok(Some(update)) => {
        shell::send(
          &app,
          &ShellEvent::UpdateAvailable {
            version: update.version.clone(),
            notes: update.body.clone(),
            date: update.date.map(|date| date.to_string()),
          },
        );
        keep(&app, update, None);
      }
      Ok(None) => shell::send(&app, &ShellEvent::UpdateNotAvailable),
      Err(e) => fail(&app, e.to_string()),
    }
  });
}

/// Download the checked update, streaming `update-progress` so the runtime can
/// drive the same progress UI it drove with `electron-updater`.
pub fn download<R: Runtime>(app: &AppHandle<R>) {
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let Some((update, _)) = take(&app) else {
      return fail(&app, "no update has been checked yet".to_owned());
    };
    let downloaded = Arc::new(AtomicU64::new(0));
    let progress = (app.clone(), downloaded.clone());
    let result = update
      .download(
        move |chunk, total| {
          let (app, downloaded) = &progress;
          let downloaded = downloaded.fetch_add(chunk as u64, Ordering::Relaxed) + chunk as u64;
          shell::send(app, &ShellEvent::UpdateProgress { downloaded, total });
        },
        || {},
      )
      .await;
    match result {
      Ok(bytes) => {
        keep(&app, update, Some(bytes));
        shell::send(&app, &ShellEvent::UpdateDownloaded);
      }
      Err(e) => {
        keep(&app, update, None);
        fail(&app, e.to_string());
      }
    }
  });
}

/// Install the downloaded update and relaunch.
///
/// The sidecar is stopped first: it holds the game data lock, and on Windows the
/// installer cannot replace files still mapped by a live process.
pub fn install<R: Runtime>(app: &AppHandle<R>) {
  let Some((update, Some(bytes))) = take(&app) else {
    return fail(&app, "the update has not been downloaded yet".to_owned());
  };
  if let Some(sidecar) = app.try_state::<Sidecar>() {
    sidecar.shutdown();
  }
  match update.install(bytes) {
    // The installer restarts the app on Windows; elsewhere it swapped the
    // bundle in place, so the shell has to relaunch itself.
    Ok(()) => app.restart(),
    Err(e) => fail(app, e.to_string()),
  }
}

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R, tauri_plugin_updater::Config> {
  tauri_plugin_updater::Builder::new().build()
}
