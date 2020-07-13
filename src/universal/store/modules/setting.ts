import { UpdateInfo as _UpdateInfo } from 'electron-updater';
import { ModuleOption } from '../root';
import { SettingSchema } from './setting.schema';


export interface BlockMapDataHolder {
    /**
     * The file size. Used to verify downloaded size (save one HTTP request to get length).
     * Also used when block map data is embedded into the file (appimage, windows web installer package).
     */
    size?: number;
    /**
     * The block map file size. Used when block map data is embedded into the file (appimage, windows web installer package).
     * This information can be obtained from the file itself, but it requires additional HTTP request,
     * so, to reduce request count, block map size is specified in the update metadata too.
     */
    blockMapSize?: number;
    /**
     * The file checksum.
     */
    readonly sha512: string;
    readonly isAdminRightsRequired?: boolean;
}

export interface UpdateFileInfo extends BlockMapDataHolder {
    url: string;
}
export interface ReleaseNoteInfo {
    /**
     * The version.
     */
    readonly version: string;
    /**
     * The note.
     */
    readonly note: string | null;
}
export interface UpdateInfo extends _UpdateInfo {
    /**
    * The version.
    */
    readonly version: string;
    readonly files: Array<UpdateFileInfo>;
    /**
     * The release name.
     */
    releaseName?: string | null;
    /**
     * The release notes. List if `updater.fullChangelog` is set to `true`, `string` otherwise.
     */
    releaseNotes?: string | Array<ReleaseNoteInfo> | null;
    /**
     * The release date.
     */
    releaseDate: string;
    /**
     * The [staged rollout](/auto-update#staged-rollouts) percentage, 0-100.
     */
    readonly stagingPercentage?: number;

    incremental: boolean;
}

interface State extends SettingSchema {
    /**
     * All supported languages of the launcher
     */
    locales: string[];
    updateInfo: UpdateInfo | null;
    updateStatus: 'ready' | 'none' | 'pending';
    version: string;
    build: number;
}

interface Mutations {
    config: SettingSchema & { locales: string[] };
    locale: string;
    allowPrerelease: boolean;
    autoInstallOnAppQuit: boolean;
    updateStatus: 'ready' | 'none' | 'pending';
    autoDownload: boolean;
    updateInfo: UpdateInfo;
    settings: { [key: string]: number | string | boolean | object };

    apiSetsPreference: 'mojang' | 'bmcl' | 'mcbbs';
    apiSets: { name: string; url: string }[];

    version: [string, number];
}


/**
 * Whole launcher setting
 */
export type SettingModule = ModuleOption<State, {}, Mutations, {}>;

const mod: SettingModule = {
    state: {
        roots: [],
        primaryRoot: '',
        locale: '',
        locales: [],
        updateInfo: null,
        updateStatus: 'none',
        allowPrerelease: false,
        autoInstallOnAppQuit: false,
        autoDownload: false,
        apiSetsPreference: 'mojang',
        apiSets: [{ name: 'mcbbs', url: 'https://download.mcbbs.net' }, { name: 'bmcl', url: 'https://bmclapi2.bangbang93.com' }],
        version: '',
        build: 0,
    },
    mutations: {
        updateInfo(state, updateInfo) {
            if (typeof updateInfo === 'object') state.updateInfo = updateInfo;
        },
        updateStatus(state, updateStatus) { state.updateStatus = updateStatus; },
        allowPrerelease(state, allowPrerelease) {
            if (typeof allowPrerelease === 'boolean') { state.allowPrerelease = allowPrerelease; }
        },
        autoInstallOnAppQuit(state, autoInstallOnAppQuit) {
            if (typeof autoInstallOnAppQuit === 'boolean') state.autoInstallOnAppQuit = autoInstallOnAppQuit;
        },
        autoDownload(state, autoDownload) {
            if (typeof autoDownload === 'boolean') state.autoDownload = autoDownload;
        },
        locale(state, language) {
            state.locale = language;
        },
        config(state, config) {
            state.locale = config.locale;
            state.locales = config.locales;
            state.autoDownload = config.autoDownload || false;
            state.autoInstallOnAppQuit = config.autoDownload || false;
            state.allowPrerelease = config.allowPrerelease || false;
            state.apiSetsPreference = typeof config.apiSetsPreference === 'string' ? config.apiSetsPreference : 'mojang';
        },
        settings(state, settings) {
            // Object.assign(state.settings, settings);
        },
        apiSetsPreference(state, use) { state.apiSetsPreference = use; },
        apiSets(state, sets) { state.apiSets = sets; },
        version(state, [version, build]) { state.version = version; state.build = build ?? 0; },
    },
};

export default mod;
