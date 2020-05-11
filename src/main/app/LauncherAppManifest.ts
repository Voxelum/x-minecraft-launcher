export interface LauncherAppManifest {
    /**
     * The name of this launcher app
     */
    name: string;
    /**
     * The url to this json, which will be used for update this json
     */
    url?: string;
    /**
     * The host url
     */
    host: string;
    /**
     * The version of this app
     */
    version: string;
    /**
     * Provided windows of this app
     */
    entries: { [name: string]: LauncherWindow };
    /**
     * Setup tray icon
     */
    tray?: LauncherTray;
    /**
     * Setup dock icon
     */
    dock?: LauncherDock;
}

export interface LauncherDock {
    icon: {
        default: string;
        x2?: string;
        x3?: string;
        x4?: string;
        x5?: string;
    };
}

export interface LauncherTray {
    icon: {
        default: string;
        x2?: string;
        x3?: string;
        x4?: string;
        x5?: string;
    };
}

export interface LauncherWindow {
    url: string;
    /**
     * The icon window url 
     */
    icon: string;
    option: LauncherWindowCreationOption;
}

type LauncherWindowCreationOption = Omit<Electron.BrowserWindowConstructorOptions, 'webPreferences' | 'icon'>;
