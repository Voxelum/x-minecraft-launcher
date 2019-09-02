export interface SettingConfig {
    /**
     * The display language of the launcher
     * @default "en"
     */
    locale: string;
    /**
     * Should launcher auto download new update
     * @default false 
     */
    autoDownload: boolean;
    /**
     * Should launcher auto install new update after app quit
     * @default false
     */
    autoInstallOnAppQuit: boolean;
    /**
     * Should launcher show the pre-release 
     * @default false
     */
    allowPrerelease: boolean;
    /**
     * The default background image url
     * @default null 
     */
    defaultBackgroundImage: string | null;
    /**
     * The default blur factor
     * @default 0
     */
    defaultBlur: number;
}
