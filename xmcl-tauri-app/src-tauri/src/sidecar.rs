//! Supervision of the Node sidecar hosting `xmcl-runtime`.
//!
//! The Rust shell owns no launcher logic: it starts `node dist/sidecar.js`,
//! waits until the sidecar reports the port of its local bridge server, and
//! restarts the process on the *same* port and token if it dies, so the
//! webview's reconnecting bridge client re-attaches without a reload.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::shell;

/// Printed by the sidecar on stdout once the bridge server accepts
/// connections. Keep in sync with `sidecar/index.ts`.
const READY_MARKER: &str = "@@XMCL_SIDECAR_READY@@";

/// How long the shell waits for the first successful boot before giving up.
const BOOT_TIMEOUT: Duration = Duration::from_secs(60);

/// A crash loop is a bug, not something to paper over: give up after this
/// many restarts and let the app quit with a diagnostic.
const MAX_RESTARTS: u32 = 5;

pub struct Sidecar {
  /// Loopback port of the bridge server.
  pub port: u16,
  /// Random per-launch token the webview must present to the bridge.
  pub token: String,
  child: Arc<Mutex<Option<Child>>>,
  stdin: Arc<Mutex<Option<ChildStdin>>>,
  shutting_down: Arc<AtomicBool>,
}

impl Sidecar {
  /// Kill the sidecar without triggering the restart policy.
  pub fn shutdown(&self) {
    self.shutting_down.store(true, Ordering::SeqCst);
    let _ = self.stdin.lock().unwrap().take();
    if let Some(mut child) = self.child.lock().unwrap().take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }

  /// Write one event line on the sidecar's stdin.
  pub fn send_line(&self, line: &str) {
    let mut guard = self.stdin.lock().unwrap();
    let Some(stdin) = guard.as_mut() else {
      return;
    };
    if writeln!(stdin, "{line}").and_then(|_| stdin.flush()).is_err() {
      // The sidecar is gone or restarting; the supervisor replaces the handle.
      *guard = None;
    }
  }
}

#[derive(Clone)]
struct Launch {
  node: PathBuf,
  script: PathBuf,
  token: String,
  port: u16,
  /// Command lines the sidecar prints for the shell, without the marker.
  commands: Sender<String>,
  stdin: Arc<Mutex<Option<ChildStdin>>>,
}

/// Reserve a free loopback port. The sidecar binds it for real; the race
/// window is acceptable for a desktop app and buys us a stable port across
/// sidecar restarts, which is what keeps the webview connection transparent.
fn reserve_port() -> std::io::Result<u16> {
  let listener = TcpListener::bind("127.0.0.1:0")?;
  let port = listener.local_addr()?.port();
  drop(listener);
  Ok(port)
}

/// Resolve the Node runtime that hosts the sidecar.
///
/// Installers pack one next to the bundle (see `build.ts`), because a user's
/// machine is not expected to have Node — it is the counterpart of the Electron
/// binary the Electron target ships. `XMCL_NODE` overrides it, and a
/// development checkout falls back to the Node on `PATH`.
fn node_binary(dist_dir: &Path) -> PathBuf {
  if let Some(path) = std::env::var_os("XMCL_NODE") {
    return PathBuf::from(path);
  }
  let name = if cfg!(windows) { "node.exe" } else { "node" };
  let packed = dist_dir.join(name);
  if packed.exists() {
    return packed;
  }
  PathBuf::from(name)
}

/// Resolve the directory holding `sidecar.js` / `preload.js`.
///
/// * `XMCL_SIDECAR_DIST` wins, which is how `dev.ts` points the shell at the
///   esbuild watch output.
/// * Then the bundled resource directory (`dist/` next to the executable).
/// * Then `../dist` relative to the crate, for a bare `cargo run`.
pub fn resolve_dist_dir(resource_dir: Option<PathBuf>) -> PathBuf {
  if let Some(dir) = std::env::var_os("XMCL_SIDECAR_DIST") {
    return PathBuf::from(dir);
  }
  if let Some(dir) = resource_dir {
    let bundled = dir.join("dist");
    if bundled.join("sidecar.js").exists() {
      return bundled;
    }
  }
  Path::new(env!("CARGO_MANIFEST_DIR")).join("../dist")
}

fn spawn_process(launch: &Launch) -> std::io::Result<Child> {
  let mut command = Command::new(&launch.node);
  command
    .arg(&launch.script)
    .env("XMCL_BRIDGE_PORT", launch.port.to_string())
    .env("XMCL_BRIDGE_TOKEN", &launch.token)
    .env("XMCL_TAURI", "true")
    // `process.resourcesPath` does not exist outside Electron, so the sidecar
    // reads its packaged assets (agent documents) from here instead.
    .env(
      "XMCL_RESOURCES_PATH",
      launch.script.parent().unwrap_or(Path::new(".")),
    )
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  if let Some(dir) = launch.script.parent() {
    command.current_dir(dir);
  }
  command.spawn()
}

/// Forward a sidecar stream to the shell's stdout/stderr, reporting the ready
/// marker through `ready` the first time it shows up.
fn pipe<R: std::io::Read + Send + 'static>(
  stream: R,
  label: &'static str,
  ready: Option<Sender<u16>>,
  commands: Option<Sender<String>>,
) {
  thread::spawn(move || {
    let reader = BufReader::new(stream);
    for line in reader.lines() {
      let Ok(line) = line else { break };
      if let Some(rest) = line.strip_prefix(READY_MARKER) {
        if let Some(ready) = &ready {
          let port = serde_json::from_str::<serde_json::Value>(rest)
            .ok()
            .and_then(|v| v.get("port").and_then(|p| p.as_u64()))
            .unwrap_or(0) as u16;
          let _ = ready.send(port);
        }
        continue;
      }
      if let Some(rest) = line.strip_prefix(shell::MARKER) {
        if let Some(commands) = &commands {
          let _ = commands.send(rest.to_owned());
        }
        continue;
      }
      println!("[sidecar:{label}] {line}");
    }
  });
}

/// Start the sidecar and block until its bridge server is listening.
pub fn start(dist_dir: &Path, commands: Sender<String>) -> Result<Sidecar, String> {
  let script = dist_dir.join("sidecar.js");
  if !script.exists() {
    return Err(format!(
      "sidecar bundle not found at {}. Run `pnpm --prefix=xmcl-tauri-app compile` first.",
      script.display()
    ));
  }
  let launch = Launch {
    node: node_binary(dist_dir),
    script,
    token: uuid::Uuid::new_v4().to_string(),
    port: reserve_port().map_err(|e| format!("cannot reserve a loopback port: {e}"))?,
    commands,
    stdin: Arc::new(Mutex::new(None)),
  };

  let (ready_tx, ready_rx) = channel();
  let child = spawn_and_pipe(&launch, Some(ready_tx))
    .map_err(|e| format!("cannot spawn `{}`: {e}", launch.node.display()))?;
  let child = Arc::new(Mutex::new(Some(child)));
  let shutting_down = Arc::new(AtomicBool::new(false));

  let port = wait_ready(&ready_rx, &child)?;
  let token = launch.token.clone();
  let stdin = launch.stdin.clone();

  supervise(launch, child.clone(), shutting_down.clone());

  Ok(Sidecar {
    port,
    token,
    child,
    stdin,
    shutting_down,
  })
}

fn spawn_and_pipe(launch: &Launch, ready: Option<Sender<u16>>) -> std::io::Result<Child> {
  let mut child = spawn_process(launch)?;
  if let Some(out) = child.stdout.take() {
    pipe(out, "out", ready, Some(launch.commands.clone()));
  }
  if let Some(err) = child.stderr.take() {
    pipe(err, "err", None, None);
  }
  *launch.stdin.lock().unwrap() = child.stdin.take();
  Ok(child)
}

fn wait_ready(ready_rx: &Receiver<u16>, child: &Arc<Mutex<Option<Child>>>) -> Result<u16, String> {
  match ready_rx.recv_timeout(BOOT_TIMEOUT) {
    Ok(port) if port != 0 => Ok(port),
    Ok(_) => Err("sidecar reported an invalid bridge port".to_owned()),
    Err(RecvTimeoutError::Timeout) => {
      if let Some(mut child) = child.lock().unwrap().take() {
        let _ = child.kill();
      }
      Err("sidecar did not become ready in time".to_owned())
    }
    Err(RecvTimeoutError::Disconnected) => Err("sidecar exited before becoming ready".to_owned()),
  }
}

/// Restart the sidecar on the same port/token when it dies unexpectedly.
fn supervise(launch: Launch, child: Arc<Mutex<Option<Child>>>, shutting_down: Arc<AtomicBool>) {
  thread::spawn(move || {
    let mut restarts = 0u32;
    loop {
      // Poll rather than `wait()` so `shutdown()` can take the lock and kill
      // the process without deadlocking against this thread.
      let exit = loop {
        if shutting_down.load(Ordering::SeqCst) {
          return;
        }
        let polled = {
          let mut guard = child.lock().unwrap();
          match guard.as_mut() {
            Some(process) => process.try_wait(),
            None => return,
          }
        };
        match polled {
          Ok(Some(status)) => break Some(status),
          Ok(None) => thread::sleep(Duration::from_millis(200)),
          Err(_) => break None,
        }
      };
      if shutting_down.load(Ordering::SeqCst) {
        return;
      }
      let code = exit.and_then(|s| s.code()).unwrap_or(-1);
      restarts += 1;
      if restarts > MAX_RESTARTS {
        eprintln!("[sidecar] exited with {code} and exceeded {MAX_RESTARTS} restarts; giving up");
        std::process::exit(1);
      }
      eprintln!("[sidecar] exited with {code}; restarting ({restarts}/{MAX_RESTARTS})");
      thread::sleep(Duration::from_millis(500));
      match spawn_and_pipe(&launch, None) {
        Ok(process) => *child.lock().unwrap() = Some(process),
        Err(e) => {
          eprintln!("[sidecar] restart failed: {e}");
          std::process::exit(1);
        }
      }
    }
  });
}
