import Schema from '../Schema';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface SettingSchema {
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
     * The download API set preferences
     * @default 'mcbbs'
     */
    apiSetsPreference: 'mojang' | 'mcbbs' | 'bmcl';
    /**
     * The supported unofficial api sets
     */
    apiSets: Array<{ name: string; url: string }>;
}

export const SettingSchema: Schema<SettingSchema> = require('./SettingSchema.json');
