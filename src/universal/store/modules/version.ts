import { fitin } from 'universal/utils/object';
import Vue from 'vue';
import lastestRelease from 'universal/utils/lasteRelease.json';

import { Forge, ForgeWebPage, LiteLoader, Installer, Version, ResolvedLibrary } from "@xmcl/minecraft-launcher-core";
import { Context, Module } from "..";
import ForgeInstaller from "@xmcl/forge-installer";
export type Status = 'remote' | 'local';

/**
 * The module handle the local/remote version related work 
 */
export declare namespace VersionModule {
    /**
     * An interface to reference a resolved version in 
     * <minecraft folder>/versions/<version-id>/<version-id>.json
     * 
     * This is more lightweight than @xmcl/minecraft-launcher-core's Version by Version.parse.
     */
    interface ResolvedVersion {
        /**
         * Minecraft version of this version. e.g. 1.7.10
         */
        minecraft: string;
        /**
         * Forge version of this version. e.g. 14.23.5.2838
         */
        forge: string;
        liteloader: string;
        /**
         * The ideal id this version, which is computed by 
         * function universal/utils/versions.js#getExpectVersion
         */
        id: string;
        /**
         * The real folder id of the version, which is the <verison-id> in
         * 
         * <minecraft folder>/versions/<version-id>/<version-id>.json
         */
        folder: string;
    }

    interface WebPage extends ForgeWebPage {
        latest: number;
        recommended: number;
    }

    interface State {
        local: ResolvedVersion[];
        minecraft: Installer.VersionMetaList;
        refreshingMinecraft: boolean;
        forge: { [mcversion: string]: ForgeWebPage };
        refreshingForge: boolean;
        liteloader: LiteLoader.VersionMetaList;
        refreshingLiteloader: boolean;
    }

    interface Getters {
        /**
         * Latest snapshot
         */
        minecraftSnapshot: Installer.VersionMeta | undefined,
        /**
         * Latest release
         */
        minecraftRelease: Installer.VersionMeta,
        minecraftVersion: (mcversion: string) => Installer.VersionMeta | undefined,
        minecraftStatuses: { [minecraftVersion: string]: Status };

        /**
         * Get the forge webpage info by a minecraft version
         */
        forgeVersionsOf: (mcversion: string) => ForgeWebPage | undefined;
        forgeLatestOf: (mcversion: string) => ForgeWebPage.Version | undefined;
        forgeRecommendedOf: (mcversion: string) => ForgeWebPage.Version | undefined;
        forgeStatuses: { [forgeVersion: string]: Status };

        liteloaderVersionsOf: (mcversion: string) => {
            snapshot?: LiteLoader.VersionMeta;
            release?: LiteLoader.VersionMeta;
        }
    }

    interface Mutations {
        refreshingMinecraft(state: State, refreshing: boolean): void;
        refreshingForge(state: State, refreshing: boolean): void;
        refreshingLiteloader(state: State, refreshing: boolean): void;

        localVersions(state: State, local: ResolvedVersion[]): void;
        minecraftMetadata(state: State, metadatas: Installer.VersionMetaList): void;
        forgeMetadata(state: State, metadatas: ForgeWebPage): void;
        liteloaderMetadata(state: State, metadatas: LiteLoader.VersionMetaList): void;
    }

    type C = Context<State, {}>;
    interface Actions {
        refresh(context: C): Promise<void>

        refreshVersions(context: C): Promise<void>
        /**
         * Request minecraft version list and cache in to store and disk.
         */
        refreshMinecraft(context: C): Promise<void>
        refreshForge(context: C, mcversion: string): Promise<void>
        refreshLiteloader(context: C): Promise<void>

        getForgeWebPage(context: C, mcversion: string): Promise<ForgeWebPage | undefined>

        resolveVersion(context: C, version: Pick<ResolvedVersion, 'minecraft' | 'forge' | 'liteloader'>): Promise<string>

        installLibraries(context: C, payload: { libraries: (Version.Library | ResolvedLibrary)[] }): Promise<TaskHandle>;
        installAssets(context: C, version: string): Promise<TaskHandle>
        installDependencies(context: C, version: string): Promise<TaskHandle>

        installMinecraft(context: C, version: Installer.VersionMeta): Promise<TaskHandle>
        installForge(context: C, version: ForgeInstaller.VersionMeta): Promise<TaskHandle>
        installLiteloader(context: C, version: LiteLoader.VersionMeta): Promise<TaskHandle>

        showVersionDirectory(context: C, version: string): Promise<void>;
        showVersionsDirectory(context: C): Promise<void>;

        deleteVersion(context: C, version: string): Promise<void>;
    }
}

export interface VersionModule extends Module<"version", VersionModule.State, VersionModule.Getters, VersionModule.Mutations, VersionModule.Actions> {
}

const mod: VersionModule = {
    state: {
        /**
         * local versions
         */
        local: [],
        refreshingMinecraft: false,
        refreshingForge: false,
        refreshingLiteloader: false,
        minecraft: {
            timestamp: '',
            latest: {
                snapshot: '',
                release: '',
            },
            versions: [],
        },
        forge: {

        },
        liteloader: {
            timestamp: '',
            meta: {
                description: '',
                authors: '',
                url: '',
                updated: '',
                updatedTime: 0,
            },
            versions: {},
        },
    },
    getters: {
        /**
         * latest snapshot
         */
        minecraftSnapshot: state => state.minecraft.versions.find(v => v.id === state.minecraft.latest.snapshot),
        /**
         * latest release
         */
        minecraftRelease: state => state.minecraft.versions.find(v => v.id === state.minecraft.latest.release) || lastestRelease,

        minecraftVersion: state => version => state.minecraft.versions.find(v => v.id === version),

        minecraftStatuses: (state, _, rootStates) => {
            const localVersions: { [k: string]: boolean } = {};
            rootStates.version.local.forEach((ver) => {
                if (ver.minecraft) localVersions[ver.minecraft] = true;
            });
            const statusMap: { [key: string]: import('./version').Status } = {};
            for (const ver of state.minecraft.versions) {
                statusMap[ver.id] = localVersions[ver.id] ? 'local' : 'remote';
            }
            return statusMap;
        },
        forgeVersionsOf: state => version => (state.forge[version]),
        forgeLatestOf: state => (version) => {
            const versions = state.forge[version];
            if (!versions) return undefined;
            return versions.versions.find(v => v.type === 'latest');
        },
        forgeRecommendedOf: state => (version) => {
            const versions = state.forge[version];
            if (!versions) return undefined;
            return versions.versions.find(v => v.type === 'recommended');
        },
        forgeStatuses: (state, _, rootState) => {
            const statusMap: { [key: string]: import('./version').Status } = {};
            const localForgeVersion: { [k: string]: boolean } = {};
            rootState.version.local.forEach((ver) => {
                if (ver.forge) localForgeVersion[ver.forge] = true;
            });

            Object.keys(state.forge).forEach((mcversion) => {
                const container = state.forge[mcversion];
                if (container.versions) {
                    container.versions.forEach((version) => {
                        statusMap[version.version] = localForgeVersion[version.version] ? 'local' : 'remote';
                    });
                }
            });
            return statusMap;
        },
        liteloaderVersionsOf: state => version => state.liteloader.versions[version],
    },
    mutations: {
        refreshingMinecraft(state, r) { state.refreshingMinecraft = r; },
        refreshingForge(state, r) { state.refreshingForge = r; },
        refreshingLiteloader(state, r) { state.refreshingLiteloader = r; },

        localVersions(state, local) {
            state.local = local;
        },
        minecraftMetadata(state, metadata) {
            fitin(state.minecraft, metadata);
        },
        forgeMetadata(state, metadata) {
            const { mcversion } = metadata;
            Vue.set(state.forge, mcversion, metadata);
        },
        liteloaderMetadata(state, metadata) {
            fitin(state.liteloader, metadata);
        },
    },
};

export default mod;
