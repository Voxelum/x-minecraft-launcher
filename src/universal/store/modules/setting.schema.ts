import Schema from '../Schema';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export enum ParticleMode {
    PUSH = 'push',
    REMOVE = 'remove',
    REPULSE = 'repulse',
    BUBBLE = 'bubble',
}

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
     * The default background image url
     * @default null 
     */
    defaultBackgroundImage: string | null;
    /**
     * The default blur factor
     * @default 0
     */
    defaultBlur: number;

    /**
     * Use bmcl API in China Mainland
     * @default true
     */
    useBmclAPI: boolean;

    /**
     * Show particle on background
     * @default true
     */
    showParticle: boolean;

    /**
     * The particle click mode
     * @default "repulse"
     */
    particleMode: ParticleMode;
}

export const SettingSchema: Schema<SettingSchema> = require('./SettingSchema.json');
