/**
 * Control channel from the Node sidecar back to the Rust shell.
 *
 * The bridge (`bridge/protocol.ts`) is a server inside the sidecar, so it can
 * only answer the webview; window/tray/lifecycle operations have to travel the
 * other way. They are emitted as one JSON line per command on the sidecar's
 * stdout, prefixed with {@link SHELL_MARKER}, and parsed by `src-tauri/src/shell.rs`.
 * Keep this file in sync with the `ShellCommand` enum on the Rust side.
 */

export const SHELL_MARKER = '@@XMCL_SHELL@@'

/** Geometry and chrome of a native window, mirroring `BrowserWindow` options. */
export interface WindowSpec {
  /** Tauri window label. `main` is the launcher window. */
  label: string
  url: string
  title: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  x?: number
  y?: number
  maximized?: boolean
  /** `false` reproduces Electron's `frame: false` custom titlebar. */
  decorations: boolean
  transparent?: boolean
  resizable?: boolean
  /** Keep the window alive but hidden when closed, like the multiplayer window. */
  hideOnClose?: boolean
  backgroundColor?: string
  /**
   * Cancel every navigation starting with this prefix and report it as a
   * `navigate` event instead. Used to capture the OAuth redirect.
   */
  navigateIntercept?: string
  /**
   * Which renderer bridge to inject. Defaults to `index`, the launcher preload;
   * `browse` adds `appsHost` for the app browser, `multiplayer` adds the
   * `multiplayer` peer proxy, and `none` loads the page bare, as third-party
   * pages such as the Microsoft sign-in flow must be.
   */
  preload?: 'index' | 'browse' | 'multiplayer' | 'none'
}

export type ShellCommand =
  | { type: 'open-window'; spec: WindowSpec }
  | { type: 'close-window'; label: string }
  | { type: 'focus-window'; label: string }
  | { type: 'show-window'; label: string }
  | { type: 'quit' }
  | { type: 'exit'; code: number }
  | { type: 'relaunch'; args?: string[] }
  | { type: 'set-tray'; tooltip?: string; icon?: string; menu?: TrayMenuItem[] }
  | { type: 'set-progress'; label: string; progress: number }
  | { type: 'flash-frame'; label: string; flash: boolean }
  | { type: 'register-protocol'; protocol: string }

export interface TrayMenuItem {
  id: string
  label: string
  enabled?: boolean
}

/** Events the shell pushes back to the sidecar on its stdin, one JSON per line. */
export type ShellEvent =
  | { type: 'window-closed'; label: string }
  | { type: 'window-all-closed' }
  | { type: 'navigate'; label: string; url: string }
  | { type: 'second-instance'; argv: string[] }
  | { type: 'deep-link'; url: string }
  | { type: 'tray-click'; id: string }
