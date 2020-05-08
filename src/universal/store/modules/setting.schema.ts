import Schema from '../Schema';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface SettingSchema {
    /**
     * The root paths of all the minecraft
     * @default []
     */
    roots: string[];
    /**
     * The primary installation root
     * @default ""
     */
    primaryRoot: string;
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
     * Use bmcl API in China Mainland
     * @default true
     */
    useBmclAPI: boolean;
}

export const SettingSchema: Schema<SettingSchema> = require('./SettingSchema.json');
