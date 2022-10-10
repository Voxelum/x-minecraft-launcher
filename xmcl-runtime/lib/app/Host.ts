/**
 * The host interface of the app.
 *
 * The main goal of this interface is to isolate the electron context from the launcher app.
 *
 * This interface design currently is align to electron.app interface
 */
export interface Host {
  /**
   * Whether the current executable is the default handler for a protocol (aka URI
   * scheme).
   *
   * **Note:** On macOS, you can use this method to check if the app has been
   * registered as the default protocol handler for a protocol. You can also verify
   * this by checking `~/Library/Preferences/com.apple.LaunchServices.plist` on the
   * macOS machine. Please refer to Apple's documentation for details.
   *
   * The API uses the Windows Registry and `LSCopyDefaultHandlerForURLScheme`
   * internally.
    */
  isDefaultProtocolClient(protocol: string, path?: string, args?: string[]): boolean

  /**
    * Whether the call succeeded.
    *
    * Sets the current executable as the default handler for a protocol (aka URI
    * scheme). It allows you to integrate your app deeper into the operating system.
    * Once registered, all links with `your-protocol://` will be opened with the
    * current executable. The whole link, including protocol, will be passed to your
    * application as a parameter.
    *
    * **Note:** On macOS, you can only register protocols that have been added to your
    * app's `info.plist`, which cannot be modified at runtime. However, you can change
    * the file during build time via Electron Forge, Electron Packager, or by editing
    * `info.plist` with a text editor. Please refer to Apple's documentation for
    * details.
    *
    * **Note:** In a Windows Store environment (when packaged as an `appx`) this API
    * will return `true` for all calls but the registry key it sets won't be
    * accessible by other applications.  In order to register your Windows Store
    * application as a default protocol handler you must declare the protocol in your
    * manifest.
    *
    * The API uses the Windows Registry and `LSSetDefaultHandlerForURLScheme`
    * internally.
    */
  setAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]): boolean

  /**
   * The return value of this method indicates whether or not this instance of your
   * application successfully obtained the lock.  If it failed to obtain the lock,
   * you can assume that another instance of your application is already running with
   * the lock and exit immediately.
   *
   * I.e. This method returns `true` if your process is the primary instance of your
   * application and your app should continue loading.  It returns `false` if your
   * process should immediately quit as it has sent its parameters to another
   * instance that has already acquired the lock.
   *
   * On macOS, the system enforces single instance automatically when users try to
   * open a second instance of your app in Finder, and the `open-file` and `open-url`
   * events will be emitted for that. However when users start your app in command
   * line, the system's single instance mechanism will be bypassed, and you have to
   * use this method to ensure single instance.
   *
   * An example of activating the window of primary instance when a second instance
   * starts:
   */
  requestSingleInstanceLock(): boolean

  getVersion(): string

  getLocale(): string

  getLocaleCountryCode(): string

  /**
   * Quit the app gently.
   */
  quit(): void

  /**
   * Force exit the app with exit code
   */
  exit(code?: number): void

  /**
   * Get the system provided path
   */
  getPath(key: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps'): string

  /**
   * Wait the engine ready
   */
  whenReady(): Promise<void>

  relaunch(): void
}
