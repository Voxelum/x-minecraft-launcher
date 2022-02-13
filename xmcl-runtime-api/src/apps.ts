/* eslint-disable camelcase */
export interface AppManifest {
  /**
   * The name of the launcher web application. This will be used in title of the window.
   */
  name: string
  /**
   * Description of the purpose of the launcher application
   */
  description?: string
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
    purpose?:
    | 'monochrome'
    | 'maskable'
    | 'any'
    | 'monochrome maskable'
    | 'monochrome any'
    | 'maskable monochrome'
    | 'maskable any'
    | 'any monochrome'
    | 'any maskable'
    | 'monochrome maskable any'
    | 'monochrome any maskable'
    | 'maskable monochrome any'
    | 'maskable any monochrome'
    | 'any monochrome maskable'
    | 'any maskable monochrome'
  }>

  /**
   * The icons member is an array of icon objects that can serve as iconic representations of the web application in various contexts.
   */
  icons?: Array<{
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
    purpose?:
    | 'monochrome'
    | 'maskable'
    | 'any'
    | 'monochrome maskable'
    | 'monochrome any'
    | 'maskable monochrome'
    | 'maskable any'
    | 'any monochrome'
    | 'any maskable'
    | 'monochrome maskable any'
    | 'monochrome any maskable'
    | 'maskable monochrome any'
    | 'maskable any monochrome'
    | 'any monochrome maskable'
    | 'any maskable monochrome'
  }>

  /**
   * The background_color member describes the expected background color of the web application.
   */
  background_color?: string

  ratio?: boolean

  minWidth?: number

  minHeight?: number

  display?: string
}

export interface InstalledAppManifest extends Required<AppManifest> {
  /**
   * The url of the app
   */
  url: string

  /**
   * The path of the icon.
   * - On windows, this should be an .ico file
   * - On macOS, this should be an .icns file
   * - On linux, this should be an .png file
   *
   * For windows & mac, if the icon cannot be converted into preferred file format, it will fallback to png file.
   */
  iconPath: string

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
