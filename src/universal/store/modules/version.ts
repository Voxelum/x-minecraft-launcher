import { Installer, LiteLoaderInstaller, ForgeInstaller, FabricInstaller } from '@xmcl/installer';
import lastestRelease from '@universal/util/lasteRelease.json';
import { ModuleOption } from '../root';
import { RuntimeVersions } from './instance.schema';
import { VersionFabricSchema } from './version.schema';


export type Status = 'remote' | 'local' | 'loading';

export interface ForgeVersion {
    /**
     * The forge version string
     */
    version: string;
    /**
     * The target minecraft version
     */
    minecraft: string;
    /**
     * The type of this version
     */
    type: 'buggy' | 'recommended' | 'common' | 'latest';
}

/**
 * An interface to reference a resolved version in 
 * <minecraft folder>/versions/<version-id>/<version-id>.json
 * 
 * This is more lightweight than @xmcl/minecraft-launcher-core's Version by Version.parse.
 */
export interface LocalVersion extends RuntimeVersions {
    /**
     * The ideal id this version, which is computed by 
     * function universal/utils/versions.js#getExpectVersion
     */
    id?: string;
    /**
     * The real folder id of the version, which is the <verison-id> in
     * 
     * <minecraft folder>/versions/<version-id>/<version-id>.json
     */
    folder: string;
}

interface State {
    /**
     * All the local versions installed in the disk
     */
    local: LocalVersion[];
    /**
     * Minecraft version metadata list. Helps to download.
     */
    minecraft: Installer.VersionList;
    /**
     * Forge version metadata dictionary. Helps to download.
     */
    forge: ForgeInstaller.VersionList[];
    /**
     * Fabric version metadata dictionary. Helps to download.
     */
    fabric: VersionFabricSchema;
    /**
     * Liteloader version metadata list. Helps to download.
     */
    liteloader: LiteLoaderInstaller.VersionList;
}

interface Getters {
    /**
     * Latest snapshot
     */
    minecraftSnapshot: Installer.Version | undefined;
    /**
     * Latest release
     */
    minecraftRelease: Installer.Version;
    minecraftVersion: (mcversion: string) => Installer.Version | undefined;
}

interface Mutations {
    localVersions: LocalVersion[];
    localVersion: LocalVersion | { [runtime: string]: string };
    localVersionRemove: string;
    minecraftMetadata: Installer.VersionList;
    forgeMetadata: ForgeInstaller.VersionList;
    liteloaderMetadata: LiteLoaderInstaller.VersionList;
    fabricYarnMetadata: { versions: FabricInstaller.FabricArtifactVersion[]; timestamp: string };
    fabricLoaderMetadata: { versions: FabricInstaller.FabricArtifactVersion[]; timestamp: string };
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
        forge: [],
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
        fabric: {
            yarnTimestamp: '',
            loaderTimestamp: '',
            yarns: [],
            loaders: [],
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
    },
    mutations: {
        localVersions(state, local) {
            state.local = local;
        },
        localVersion(state, local) {
            const found = state.local.find(l => l.folder === local.folder);
            if (found) {
                Object.assign(found, local);
            } else {
                state.local.push(local as any);
            }
        },
        localVersionRemove(state, folder) {
            state.local = state.local.filter((v => v.folder === folder));
        },
        minecraftMetadata(state, metadata) {
            state.minecraft = Object.freeze(metadata);
        },
        forgeMetadata(state, metadata) {
            state.forge.push(Object.freeze(metadata));
        },
        liteloaderMetadata(state, metadata) {
            state.liteloader = Object.freeze(metadata);
        },
        fabricYarnMetadata(state, { versions, timestamp }) {
            state.fabric.yarnTimestamp = timestamp;
            state.fabric.yarns = Object.seal(versions);
        },
        fabricLoaderMetadata(state, { versions, timestamp }) {
            state.fabric.loaderTimestamp = timestamp;
            state.fabric.loaders = Object.seal(versions);
        },
    },
};

export default mod;
