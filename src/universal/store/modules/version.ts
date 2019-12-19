import { ForgeWebPage, Installer, LiteLoader } from '@xmcl/minecraft-launcher-core';
import lastestRelease from 'universal/utils/lasteRelease.json';
import { fitin } from 'universal/utils/object';
import Vue from 'vue';
import { ModuleOption } from '../root';


export type Status = 'remote' | 'local';

/**
 * An interface to reference a resolved version in 
 * <minecraft folder>/versions/<version-id>/<version-id>.json
 * 
 * This is more lightweight than @xmcl/minecraft-launcher-core's Version by Version.parse.
 */
export interface LocalVersion {
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

/**
 * The module handle the local/remote version related work 
 */
interface WebPage extends ForgeWebPage {
    latest: number;
    recommended: number;
}

interface State {
    /**
     * All the local versions installed in the disk
     */
    local: LocalVersion[];
    /**
     * Minecraft version metadata list. Helps to download.
     */
    minecraft: Installer.VersionMetaList;
    /**
     * Forge version metadata dictionary. Helps to download.
     */
    forge: { [mcversion: string]: ForgeWebPage };
    /**
     * Liteloader version metadata list. Helps to download.
     */
    liteloader: LiteLoader.VersionMetaList;
}

interface Getters {
    /**
     * Latest snapshot
     */
    minecraftSnapshot: Installer.VersionMeta | undefined;
    /**
     * Latest release
     */
    minecraftRelease: Installer.VersionMeta;
    minecraftVersion: (mcversion: string) => Installer.VersionMeta | undefined;
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
    };
}

interface Mutations {
    localVersions: LocalVersion[];
    minecraftMetadata: Installer.VersionMetaList;
    forgeMetadata: ForgeWebPage;
    liteloaderMetadata: LiteLoader.VersionMetaList;
}

export type VersionModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: VersionModule = {
    state: {
        /**
         * local versions
         */
        local: [],
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
            const statusMap: { [key: string]: Status } = {};
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
            const statusMap: { [key: string]: Status } = {};
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
