
export interface Shell {
  /**
    * A safe method that only open directory. If the `path` is a file, it won't execute it.
    * @param path The directory path
    */
  openDirectory(path: string): Promise<boolean>

  /**
    * Try to open a url in default browser. It will popup a message dialog to let user know.
    * If user does not trust the url, it won't open the site.
    * @param url The pending url
    */
  openInBrowser(url: string): Promise<boolean>

  /**
    * Show the item in folder
    * @param path The file path to show.
    */
  showItemInFolder(path: string): void

  createShortcut(path: string, link: {
    /**
      * The Application User Model ID. Default is empty.
      */
    appUserModelId?: string
    /**
      * The arguments to be applied to `target` when launching from this shortcut.
      * Default is empty.
      */
    args?: string
    /**
      * The working directory. Default is empty.
      */
    cwd?: string
    /**
      * The description of the shortcut. Default is empty.
      */
    description?: string
    /**
      * The path to the icon, can be a DLL or EXE. `icon` and `iconIndex` have to be set
      * together. Default is empty, which uses the target's icon.
      */
    icon?: string
    /**
      * The resource ID of icon when `icon` is a DLL or EXE. Default is 0.
      */
    iconIndex?: number
    /**
      * The target to launch from this shortcut.
      */
    target: string
    /**
      * The Application Toast Activator CLSID. Needed for participating in Action
      * Center.
      */
    toastActivatorClsid?: string
  }): boolean
}
