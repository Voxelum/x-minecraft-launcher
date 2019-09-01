import { GameSetting, LevelDataFrame, World, Server } from "@xmcl/minecraft-launcher-core";
import { Context, Module } from "../store";
import { JavaModule } from "./java";
import { Resource } from './resource';
import { DiagnoseModule } from './diagnose';
import { VersionModule } from "./version";

type Problem = DiagnoseModule.Problem;

type CreateProfileOption = Omit<ProfileModule.Profile, 'serverInfos' | 'saves' | 'settings' | 'refreshing' | 'problems' | 'id'> & { type: 'modpack' }
type CreateServerProfileOption = Omit<ProfileModule.ServerProfile, 'serverInfos' | 'saves' | 'settings' | 'refreshing' | 'problems' | 'id'> & { type: 'server' }
type CreateOption = DeepPartial<CreateProfileOption | CreateServerProfileOption>;

// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
type DeepPartial<T> = Partial<{
    [k in keyof T]:
    T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
    T[k] extends object ? DeepPartial<T[k]> :
    T[k];
}>;
export interface TemplateFunction {
    (id: string, java: JavaModule.Java, mcversion: string, type: 'modpack' | 'server', creatingNew: boolean): ProfileModule.ServerOrModpack
}
export const createTemplate: TemplateFunction;
export declare namespace ProfileModule {
    interface ServerProfile extends ProfileBase {
        type: 'server';
        host: string;
        port: number;
    }

    interface Profile extends ProfileBase {
        type: 'modpack';
        author: string;
        description: string;
    }

    type ServerOrModpack = Profile | ServerProfile;
    type ServerAndModpack = Profile & ServerProfile;

    type Save = Pick<World, 'level' | 'path'>

    interface ProfileBase {
        /**
         * The unique id (uuid) of the profile. The profile data will be stored into profiles/${id}/profile.json according to this.
         */
        id: string;
        /**
         * The display name of the profile. It will also be the modpack display name
         */
        name: string;

        /**
         * The java object containing the java info
         */
        java: {
            /**
             * The real path of the java paath
             */
            path: string;
            /**
             * The actual version string of the java
             */
            version: string;
            /**
             * The major version of selected java. If the version cannot be found, matching the java by this
             */
            majorVersion: number;
        },

        /**
         * Either a modpack or server. The modpack is the common profile. It can export into a modpack 
         */
        type: 'modpack' | 'server';

        /**
         * Should show a logger window after Minecraft launched
         */
        showLog: boolean;
        /**
         * Should launcher hide after Minecraft launched
         */
        hideLauncher: boolean;

        /**
         * The external resource deployment of this profiles, like mods or resource packs
         */
        deployments: {
            mods: string[];
            [domain: string]: string[];
        };

        /**
         * The version requirement of the profile.
         * 
         * Containing the forge & liteloader & etc.
         */
        version: {
            minecraft: string;
            forge: string;
            liteloader: string;
            [id: string]: string;
        };

        resolution: { width: number, height: number, fullscreen: boolean };
        minMemory?: number;
        maxMemory?: number;

        vmOptions: string[];
        mcOptions: string[];

        url: string;
        icon: string;

        image: string?;
        blur: number;

        lastAccessDate: number;
        creationDate: number;
    }

    interface State {
        /**
         * All loaded launch profiles
         */
        all: { [id: string]: ServerOrModpack };

        /**
         * Sort 
         */
        profileIds: string[];
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
        status: Server.StatusFrame?;

        /**
         * The problems of current profile
         */
        problems: Problem[];
        /**
         * If current launcher is refreshing the profile data
         */
        refreshing: boolean;

        dirty: {
            /**
             * Whether the save folder is dirty
             */
            saves: boolean;

            /**
             * Whether the server.dat is dirty
             */
            servers: boolean;

            gamesettings: boolean;
        },
    }

    interface Getters {
        profiles: ServerOrModpack[];
        serverProtocolVersion: number;
        selectedProfile: ServerOrModpack;
        currentVersion: VersionModule.ResolvedVersion;
    }

    interface Mutations {
        profileIds(state: State, ids: string[]): void;
        addProfile(state: State, profile: ProfileBase): void;
        removeProfile(state: State, id: string): void;
        selectProfile(state: State, id: string): void;

        /**
         * Edit the profile content. This commit will trigger save function to store the data to the disk.
         * Don't use this directly. Use `editProfile` action
         * @param payload The modified data
         */
        profile(state: State, payload: DeepPartial<ServerAndModpack>): void;

        /**
         * Update server infos in server.dat
         * @param infos The new server infos
         */
        serverInfos(state: State, infos: Server.Info[]): void;
        /**
         * Update the game settings in options.txt
         * @param payload The new game settings.
         */
        gamesettings(state: State, payload: GameSetting.Frame): void;
        // non-persistence mutation below, just update cache, nothing saved

        profileCache(state: State, payload: { gamesettings?: GameSetting.Frame } | { serverInfos: Server.Info[] }): void
        serverStatus(state: State, status: Server.StatusFrame): void;
        profileSaves(state: State, worlds: Save[]): void;
        profileProblems(state: State, problems: Problem[]): void;
        refreshingProfile(state: State, refreshing: boolean): void;

        markDirty(state: State, payload: { target: keyof State['dirty'], dirty: boolean }): void;
    }

    type C = Context<State, Getters, Mutations, Actions>
    interface Actions {
        loadProfile(context: C, id: string): Promise<void>;
        loadProfileGameSettings(context: C, id: string): Promise<GameSetting.Frame>;
        loadProfileSeverData(context: C, id: string): Promise<Server.Info[]>
        loadProfileSaves(context: C, id: string): Promise<Pick<World, 'level' | 'path'>[]>;
        loadAllProfileSaves(context: C): Promise<Pick<World, 'level' | 'path'>[]>;

        /**
         * Return the profile's screenshots urls.
         */
        listProfileScreenshots(context: C, id: string): Promise<string[]>;

        /**
         * Select active profile
         * @param id the profile uuid
         */
        selectProfile(context: C, id: string): Promise<void>;
        /**
         * Create a launch profile (either a modpack or a server).
         * @param option The creation option
         */
        createProfile(context: C, option: CreateOption): Promise<string>;
        createAndSelectProfile(context: C, option: CreateOption): Promise<string>;
        editProfile(context: C, payload: Partial<ServerAndModpack>): Promise<void>;
        deleteProfile(context: C, id: string): Promise<void>

        /**
         * Export current profile as a modpack. Can be either curseforge or normal full Minecraft
         * @param option Which profile is exporting (search by id), where to export (dest), include assets? 
         */
        exportProfile(context: C, option: { id: string, dest: string, type: 'full' | 'noAssets' | 'curseforge' }): Promise<void>;
        /**
         * Import external profile into the launcher. The profile can be a curseforge zip, or a normal Minecraft file/zip. 
         * @param location The location of the profile try to import
         */
        importProfile(context: C, location: string): Promise<void>;
        /**
         * Resolve all deployment resources of a profile into `Resource` object.
         * @param id The profile uuid
         */
        resolveProfileResources(context: C, id: string): { [domain: string]: Resource<any>[] };

        /**
         * Copy current profile `src` save to other profile. The `dest` is the array of profile id. 
         */
        copySave(context: C, paylod: { src: string, dest: string[] }): Promise<void>;
        /**
         * Import external save from its absolute `path`.
         */
        importSave(context: C, path: string): Promise<void>;

        /**
         * Delete current selected profile's save by providing the save's full path
         */
        deleteSave(context: C, path: string): Promise<void>;

        /**
         * Export current profile save to any `destination`
         */
        exportSave(context: C, payload: { path: string, destination: string, zip?: boolean }): Promise<void>;

        pingServer(context: C, payload: { host: string, port: number, protocol: number }): Promise<Server.StatusFrame>;
        pingServers(context: C): Promise<(Server.Info & { status: Server.StatusFrame })[]>;
        createProfileFromServer(context: C, info: Server.Info & { status: Server.StatusFrame }): Promise<string>;

        refreshProfile(context: C): Promise<void>;
    }
}

export interface ProfileModule extends Module<"profile", ProfileModule.State, ProfileModule.Getters, ProfileModule.Mutations, ProfileModule.Actions> {
}

declare const mod: ProfileModule;