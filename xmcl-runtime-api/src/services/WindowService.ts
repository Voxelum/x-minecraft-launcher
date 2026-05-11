import { GenericEventEmitter } from '../events'
import { SharedState } from '../util/SharedState'
import { ServiceKey } from './Service'

/**
 * Port from electron
 */
export interface FileFilter {
  extensions: string[]
  name: string
}

/**
 * Port from electron
 */
export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Contains which features the dialog should use. The following values are
   * supported:
   */
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >
  /**
   * Message to display above input boxes.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Create security scoped bookmarks when packaged for the Mac App Store.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

export interface SaveDialogOptions {
  /**
   * The dialog title. Cannot be displayed on some _Linux_ desktop environments.
   */
  title?: string
  /**
   * Absolute directory path, absolute file path, or file name to use by default.
   */
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Message to display above text fields.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Custom label for the text displayed in front of the filename text field.
   *
   * @platform darwin
   */
  nameFieldLabel?: string
  /**
   * Show the tags input box, defaults to `true`.
   *
   * @platform darwin
   */
  showsTagField?: boolean
  properties?: Array<
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'treatPackageAsDirectory'
    | 'showOverwriteConfirmation'
    | 'dontAddToRecent'
  >
  /**
   * Create a security scoped bookmark when packaged for the Mac App Store. If this
   * option is enabled and the file doesn't already exist a blank file will be
   * created at the chosen path.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

export interface FindInPageOptions {
  /**
   * Whether to search forward or backward, defaults to `true`.
   */
  forward?: boolean
  /**
   * Whether to begin a new text finding session with this request. Should be `true`
   * for initial requests, and `false` for follow-up requests. Defaults to `false`.
   */
  findNext?: boolean
  /**
   * Whether search should be case-sensitive, defaults to `false`.
   */
  matchCase?: boolean
}

export interface OpenDialogResult {
  /**
   * whether or not the dialog was canceled.
   */
  canceled: boolean
  /**
   * An array of file paths chosen by the user. If the dialog is cancelled this will
   * be an empty array.
   */
  filePaths: string[]
  /**
   * An array matching the `filePaths` array of base64 encoded strings which contains
   * security scoped bookmark data.
   */
  bookmarks?: string[]
}

export interface SaveDialogResult {
  canceled: boolean
  filePath?: string
  bookmark?: string
}

/**
 * Per-window state pushed to the renderer via `SharedState`. Each window
 * gets its own instance keyed by the calling client's window id.
 */
export class WindowState {
  maximized = false
  minimized = false

  windowMaximized(v: boolean) {
    this.maximized = v
  }

  windowMinimized(v: boolean) {
    this.minimized = v
  }
}

interface WindowServiceEventMap {}

/**
 * Window-control service. Replaces the legacy `windowController` ambient
 * global. All per-window operations target the calling renderer's
 * `BrowserWindow` (resolved from the IPC sender).
 */
export interface WindowService extends GenericEventEmitter<WindowServiceEventMap> {
  /**
   * Live `maximized` / `minimized` state of the calling renderer's window.
   */
  getWindowState(): Promise<SharedState<WindowState>>

  show(): Promise<boolean>
  hide(): Promise<boolean>
  close(): Promise<boolean>
  minimize(): Promise<boolean>
  maximize(): Promise<boolean>
  focus(): Promise<void>
  flashFrame(): Promise<void>

  /**
   * Toggle vibrancy/translucency on the calling window.
   */
  setTranslucent(enable: boolean): Promise<void>

  /**
   * macOS-only audio-input permission prompt. Returns `true` on other
   * platforms.
   */
  queryAudioPermission(): Promise<boolean>

  /**
   * Open the multiplayer popup window.
   */
  openMultiplayerWindow(): Promise<void>

  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult>
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult>

  findInPage(text: string, options?: FindInPageOptions): Promise<void>
  stopFindInPage(): Promise<void>

  startProfiling(): Promise<void>
  stopProfiling(): Promise<void>

  writeClipboard(text: string): Promise<void>
  writeClipboardImage(imageUrl: string): Promise<void>
}

export const WindowServiceKey: ServiceKey<WindowService> = 'WindowService'
