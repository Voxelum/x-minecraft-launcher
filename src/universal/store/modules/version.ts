import type { Installer, LiteLoaderInstaller, ForgeInstaller, FabricInstaller } from '@xmcl/installer';
import { LATEST_RELEASE, LocalVersion } from '@universal/entities/version';
import { ForgeVersionList, VersionFabricSchema, VersionForgeSchema } from '@universal/entities/version.schema';
import { ModuleOption } from '../root';

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
    forge: VersionForgeSchema;
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
    forgeMetadata: ForgeVersionList;
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
        minecraftRelease: state => state.minecraft.versions.find(v => v.id === state.minecraft.latest.release) || LATEST_RELEASE,

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
            const existed = state.forge.find((version) => version.mcversion === metadata.mcversion);
            if (existed) {
                existed.timestamp = metadata.timestamp;
                existed.versions = Object.freeze(metadata.versions) as any;
            } else {
                const result = { ...metadata, versions: Object.freeze(metadata.versions) };
                state.forge.push(result as any);
            }
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
