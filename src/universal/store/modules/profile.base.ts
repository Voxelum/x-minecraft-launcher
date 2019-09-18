import Vue from 'vue';
import { getExpectVersion } from 'universal/utils/versions';
import { UNKNOWN_STATUS } from 'universal/utils/server-status';

import { GameSetting, LevelDataFrame, World, Server, ServerStatusFrame } from "@xmcl/minecraft-launcher-core";
import { Context, Module } from "../store";
import { JavaModule, Java } from "./java";
import { Resource } from './resource';
import { VersionModule } from "./version";
import { ServerProfileConfig, ModpackProfileConfig, ProfileConfig, ProfilesConfig } from './profile.config';

type CreateProfileOption = Omit<ModpackProfileConfig, 'id'> & { type: 'modpack' }
type CreateServerProfileOption = Omit<ServerProfileConfig, 'id'> & { type: 'server' }
type CreateOption = DeepPartial<CreateProfileOption | CreateServerProfileOption>;
type ServerOrModpack = ModpackProfileConfig | ServerProfileConfig;
type ServerAndModpack = ModpackProfileConfig & ServerProfileConfig;

// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
type DeepPartial<T> = Partial<{
    [k in keyof T]:
    T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
    T[k] extends object ? DeepPartial<T[k]> :
    T[k];
}>;

import { reactive, toRefs, computed, Ref } from '@vue/composition-api';

interface State {
    /**
     * All loaded launch profiles
     */
    all: { [id: string]: ServerOrModpack };

    /**
     * Current selected id
     */
    id: string;

    // caches
    /**
     * Loaded server dat info 
     */
    serverInfos: Server.Info[];
    /**
     * The saves cache of current selected profile
     */
    saves: Save[];
    /**
     * The game setting of current selected profile
     */
    settings: GameSetting.Frame & { resourcePacks: Array<string> };
    /**
     * The server status of current selected server profile, modpack won't have this.
     */
    status: Server.StatusFrame | null;
    /**
     * If current launcher is refreshing the profile data
     */
    refreshing: boolean;
}

const state = reactive<State>({
    all: {},
    id: '',

    status: UNKNOWN_STATUS,

    settings: {
        resourcePacks: [],
    },
    serverInfos: [],
    saves: [],

    refreshing: false,
});

const selectedProfile = computed(() => state.all[state.id]);
const profiles = computed(() => Object.values(state.all));

function useProfile() {
    return {
        ...toRefs(state),
        selectedProfile,
        profiles,
    };
}

function useSelectedProfile() {
    const status: Ref<ServerStatusFrame> = computed(() => state.status || {
        favicon: 'unknownServer',
        version: { name: '', protocol: 0 },
        description: '',
        ping: 0,
        players: { max: 0, online: 0 },
    });

    return {
        ...toRefs(selectedProfile.value),
        isServer: selectedProfile.value,
        status,
    }
}

declare function useProfileActions(): Actions;

interface Actions {
    loadProfile(id: string): Promise<void>;
    loadProfileGameSettings(id: string): Promise<GameSetting.Frame>;
    loadProfileSeverData(id: string): Promise<Server.Info[]>
    loadProfileSaves(id: string): Promise<Pick<World, 'level' | 'path'>[]>;
    loadAllProfileSaves(): Promise<Pick<World, 'level' | 'path'>[]>;

    /**
     * Return the profile's screenshots urls.
     */
    listProfileScreenshots(id: string): Promise<string[]>;

    /**
     * Select active profile
     * @param id the profile uuid
     */
    selectProfile(id: string): Promise<void>;
    /**
     * Create a launch profile (either a modpack or a server).
     * @param option The creation option
     */
    createProfile(option: CreateOption): Promise<string>;
    createAndSelectProfile(option: CreateOption): Promise<string>;
    editProfile(payload: Partial<ServerAndModpack>): Promise<void>;
    deleteProfile(id: string): Promise<void>

    /**
     * Export current profile as a modpack. Can be either curseforge or normal full Minecraft
     * @param option Which profile is exporting (search by id), where to export (dest), include assets? 
     */
    exportProfile(option: { id: string, dest: string, type: 'full' | 'noAssets' | 'curseforge' }): Promise<void>;
    /**
     * Import external profile into the launcher. The profile can be a curseforge zip, or a normal Minecraft file/zip. 
     * @param location The location of the profile try to import
     */
    importProfile(location: string): Promise<void>;
    /**
     * Resolve all deployment resources of a profile into `Resource` object.
     * @param id The profile uuid
     */
    resolveProfileResources(id: string): { [domain: string]: Resource<any>[] };

    /**
     * Copy current profile `src` save to other profile. The `dest` is the array of profile id. 
     */
    copySave(paylod: { src: string, dest: string[] }): Promise<void>;
    /**
     * Import external save from its absolute `path`.
     */
    importSave(path: string): Promise<void>;

    /**
     * Delete current selected profile's save by providing the save's full path
     */
    deleteSave(path: string): Promise<void>;

    /**
     * Export current profile save to any `destination`
     */
    exportSave(payload: { path: string, destination: string, zip?: boolean }): Promise<void>;

    pingServer(payload: { host: string, port: number, protocol: number }): Promise<Server.StatusFrame>;
    pingServers(): Promise<(Server.Info & { status: Server.StatusFrame })[]>;
    createProfileFromServer(info: Server.Info & { status: Server.StatusFrame }): Promise<string>;

    listLogs(): Promise<string[]>;
    removeLog(name: string): Promise<void>;
    getLogContent(name: string): Promise<string>;

    listCrashReports(): Promise<string[]>;
    removeCrashReport(name: string): Promise<void>;
    getCrashReportContent(name: string): Promise<string>;

    refreshProfile(): Promise<void>;
}