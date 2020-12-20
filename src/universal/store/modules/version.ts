import { OptifineVersionList } from '@universal/entities/optifine';
import { LATEST_RELEASE, LocalVersion } from '@universal/entities/version';
import { ForgeVersionList, VersionFabricSchema, VersionForgeSchema } from '@universal/entities/version.schema';
import type { FabricArtifactVersion, LiteloaderVersionList, MinecraftVersion, MinecraftVersionList } from '@xmcl/installer';
import { ModuleOption } from '../root';

interface State {
    /**
     * All the local versions installed in the disk
     */
    local: LocalVersion[];
    /**
     * Minecraft version metadata list. Helps to download.
     */
    minecraft: MinecraftVersionList;
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
    liteloader: LiteloaderVersionList;
    /**
     * The optifine version list
     */
    optifine: OptifineVersionList;
}

interface Getters {
    /**
     * Latest snapshot
     */
    minecraftSnapshot: MinecraftVersion | undefined;
    /**
     * Latest release
     */
    minecraftRelease: MinecraftVersion;
    minecraftVersion: (mcversion: string) => MinecraftVersion | undefined;
}

interface Mutations {
    localVersions: LocalVersion[];
    localVersion: LocalVersion | { [runtime: string]: string };
    localVersionRemove: string;
    minecraftMetadata: MinecraftVersionList;
    optifineMetadata: OptifineVersionList;
    forgeMetadata: ForgeVersionList;
    liteloaderMetadata: LiteloaderVersionList;
    fabricYarnMetadata: { versions: FabricArtifactVersion[]; timestamp: string };
    fabricLoaderMetadata: { versions: FabricArtifactVersion[]; timestamp: string };
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
        optifine: {
            timestamp: '',
            versions: [],
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
        optifineMetadata(state, { versions, timestamp }) {
            state.optifine.versions = versions;
            state.optifine.timestamp = timestamp;
        },
    },
};

export default mod;
