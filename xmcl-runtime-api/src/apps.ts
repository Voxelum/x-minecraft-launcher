/**
 * The launcher app manifest
 */
export interface AppManifest {
  /**
   * The name of the launcher web application. This will be used in title of the window.
   */
  name: string
  /**
   * Description of the purpose of the launcher application
   */
  description?: string

  backgroundColor?: string
  /**
   * The screenshots member is an array of image objects represent the web application in common usage scenarios.
   */
  screenshots?: Array<{
    /**
     * The sizes member is a string consisting of an unordered set of unique space-separated tokens which are ASCII case-insensitive that represents the dimensions of an image for visual media.
     */
    sizes?: string | 'any'
    /**
     * The src member of an image is a URL from which a user agent can fetch the icon's data.
     */
    src: string
    /**
     * The type member of an image is a hint as to the media type of the image.
     */
    type?: string
  }>
  /**
   * The icons member is an array of icon objects that can serve as iconic representations of the web application in various contexts.
   */
  iconUrls: {
    /**
     * The url of the icon. It should be in PNG format.
     * - On windows, this could also be an .ico file
     */
    icon: string
    darkIcon?: string

    trayIcon?: string
    darkTrayIcon?: string

    /**
     * Only used in macos
     */
    dockIcon?: string
    darkDockIcon?: string
  }

  /**
   * Lock the ratio of the window via minWidth & minHeight
   */
  ratio?: boolean
  /**
   * The min width of the launcher
   */
  minWidth?: number
  /**
   * The min height of the launcher
   */
  minHeight?: number
}

export interface InstalledAppManifest extends Required<AppManifest> {
  /**
   * The url of the app
   */
  url: string
  /**
   * Resolved icon file paths
   */
  iconSets: {
    /**
     * The path of the icon.
     * - On windows, this should be an .ico file
     * - On macOS, this should be an .icns file
     * - On linux, this should be an .png file
     *
     * For windows & mac, if the icon cannot be converted into preferred file format, it will fallback to png file.
     */
    icon: string
    darkIcon: string

    trayIcon: string
    darkTrayIcon: string

    dockIcon: string
    darkDockIcon: string
  }

  minWidth: number
  minHeight: number
  vibrancy: boolean
}

/**
 * The api to manage the installed apps
 */
export interface AppsHost {
  /**
   * The all installed app manifests
   */
  getInstalledApps(): Promise<InstalledAppManifest[]>
  /**
   * Install an new pwa app into the launcher. You can host your launcher front end in your static web server.
   *
   * The url need to be pointed to an pwa like launcher html website.
   *
   * @param url The url of the html website
   */
  installApp(url: string): Promise<InstalledAppManifest>
  /**
   * Currently windows only.
   * Create desktop shortcut in desktop & start-up menu
   * @param url The
   */
  createShortcut(url: string): Promise<void>

  uninstallApp(url: string): Promise<void>
  /**
   * Get default app url
   */
  getDefaultApp(): Promise<string>

  /**
   * Boot the app from url
   * @param url The url of the app
   */
  bootAppByUrl(url: string): Promise<void>

  /**
   * Get the new app info
   * @param url The url of the web
   */
  getAppInfo(url: string): Promise<AppManifest>
}
