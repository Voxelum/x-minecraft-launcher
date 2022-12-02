import { GenericEventEmitter } from './events'

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
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>
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
  properties?: Array<'showHiddenFiles' | 'createDirectory' | 'treatPackageAsDirectory' | 'showOverwriteConfirmation' | 'dontAddToRecent'>
  /**
   * Create a security scoped bookmark when packaged for the Mac App Store. If this
   * option is enabled and the file doesn't already exist a blank file will be
   * created at the chosen path.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

interface WindowControllerEventMap {
  maximize: boolean
  minimize: boolean
}

export interface WindowController extends GenericEventEmitter<WindowControllerEventMap> {
  /**
   * Show current window
   */
  show(): void
  /**
   * Hide current window
   */
  hide(): void

  close(): void
  /**
   * Minimize current window
   */
  minimize(): void
  /**
   * Maximize current window
   */
  maximize(): void

  findInPage(text: string, options?: {
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
  }): void

  stopFindInPage(): void

  showOpenDialog(options: OpenDialogOptions): Promise<{
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
     * security scoped bookmark data. `securityScopedBookmarks` must be enabled for
     * this to be populated. (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmarks?: string[]
  }>
  showSaveDialog(options: SaveDialogOptions): Promise<{
    /**
     * whether or not the dialog was canceled.
     */
    canceled: boolean
    /**
     * If the dialog is canceled, this will be `undefined`.
     */
    filePath?: string
    /**
     * Base64 encoded string which contains the security scoped bookmark data for the
     * saved file. `securityScopedBookmarks` must be enabled for this to be present.
     * (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmark?: string
  }>
}
