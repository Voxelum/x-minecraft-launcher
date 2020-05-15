import { MutationKeys } from '@universal/store';
import { VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema } from '@universal/store/modules/version.schema';
import { MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core';
import { FabricInstaller, ForgeInstaller, Installer, LiteLoaderInstaller } from '@xmcl/installer';
import { LOADER_MAVEN_URL, YARN_MAVEN_URL } from '@xmcl/installer/fabric';
import { installTask } from '@xmcl/installer/forge';
import { Task } from '@xmcl/task';
import Service, { Inject, Singleton } from './Service';
import VersionService from './VersionService';

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export default class InstallService extends Service {
    @Inject('VersionService')
    private local!: VersionService;

    private refreshedMinecraft = false;

    private refreshedFabric = false;

    private refreshedLiteloader = false;

    private refreshedForge: Record<string, boolean> = {};

    async load() {
        const [mc, forge, liteloader, fabric] = await Promise.all([
            this.getPersistence({ path: this.getPath('minecraft-versions.json'), schema: VersionMinecraftSchema }),
            this.getPersistence({ path: this.getPath('forge-versions.json'), schema: VersionForgeSchema }),
            this.getPersistence({ path: this.getPath('lite-versions.json'), schema: VersionLiteloaderSchema }),
            this.getPersistence({ path: this.getPath('fabric-versions.json'), schema: VersionFabricSchema }),
        ]);
        if (typeof mc === 'object') {
            this.commit('minecraftMetadata', mc);
        }
        if (typeof forge === 'object') {
            for (const value of Object.values(forge!)) {
                this.commit('forgeMetadata', value);
            }
        }
        if (liteloader) {
            this.commit('liteloaderMetadata', liteloader);
        }
        if (fabric) {
            this.commit('fabricLoaderMetadata', { versions: fabric.loaders, timestamp: fabric.loaderTimestamp });
            this.commit('fabricYarnMetadata', { versions: fabric.yarns, timestamp: fabric.yarnTimestamp });
        }
    }

    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'minecraftMetadata':
                await this.setPersistence({
                    path: this.getPath('minecraft-versions.json'),
                    data: this.state.version.minecraft,
                    schema: VersionMinecraftSchema,
                });
                break;
            case 'forgeMetadata':
                await this.setPersistence({
                    path: this.getPath('forge-versions.json'),
                    data: this.state.version.forge,
                    schema: VersionForgeSchema,
                });
                break;
            case 'liteloaderMetadata':
                await this.setPersistence({
                    path: this.getPath('lite-versions.json'),
                    data: this.state.version.liteloader,
                    schema: VersionLiteloaderSchema,
                });
                break;
            case 'fabricLoaderMetadata':
            case 'fabricYarnMetadata':
                await this.setPersistence({
                    path: this.getPath('fabric-versions.json'),
                    data: this.state.version.fabric,
                    schema: VersionFabricSchema,
                });
                break;
            default:
        }
    }

    async init() {
    }

    private async getForgesFromBMCL(mcversion: string) {
        interface BMCLForge {
            'branch': string; // '1.9';
            'build': string; // 1766;
            'mcversion': string; // '1.9';
            'modified': string; // '2016-03-18T07:44:28.000Z';
            'version': string; // '12.16.0.1766';
            files: {
                format: 'zip' | 'jar'; // zip
                category: 'universal' | 'mdk' | 'installer';
                hash: string;
            }[];
        }
        let forges: BMCLForge[] = await this.networkManager.request.get(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcversion}`).json();
        function convert(v: BMCLForge): ForgeInstaller.Version {
            let installer = v.files.find(f => f.category === 'installer')!;
            let universal = v.files.find(f => f.category === 'universal')!;
            return {
                mcversion: v.mcversion,
                version: v.version,
                type: 'common',
            } as any;
        }
        let result: ForgeInstaller.VersionList = {
            mcversion,
            timestamp: forges[0]?.modified,
            versions: forges.map(convert),
        };
        return result;
    }

    /**
     * Request minecraft version list and cache in to store and disk.
     */
    @Singleton()
    async refreshMinecraft(force = false) {
        if (!force && this.refreshedMinecraft) {
            this.log('Skip to refresh Minecraft metadata. Use cache.');
            return;
        }
        this.log('Start to refresh minecraft version metadata.');
        const oldMetadata = this.state.version.minecraft;
        const newMetadata = await Installer.getVersionList({ original: oldMetadata });
        if (oldMetadata !== newMetadata) {
            this.log('Found new minecraft version metadata. Update it.');
            this.commit('minecraftMetadata', newMetadata);
        } else {
            this.log('Not found new Minecraft version metadata. Use cache.');
        }
        this.refreshedMinecraft = true;
    }

    /**
     * Install assets to the version
     * @param version The local version id
     */
    @Singleton('install')
    async installAssetsAll(version: string) {
        let option: Installer.AssetsOption = {
            assetsDownloadConcurrency: 16,
        };
        if (this.networkManager.isInGFW && this.state.setting.useBmclAPI) {
            option.assetsHost = 'http://bmclapi2.bangbang93.com/assets';
        }
        const location = this.state.root;
        const resolvedVersion = await Version.parse(location, version);
        await this.submit(Installer.installAssetsTask(resolvedVersion, option)).wait();
    }

    /**
     * Install assets to the version
     * @param version The local version id
     */
    @Singleton('install')
    async installAssets(assets: { name: string; size: number; hash: string }[]) {
        let option: Installer.AssetsOption = {
            assetsDownloadConcurrency: 16,
        };
        if (this.networkManager.isInGFW && this.state.setting.useBmclAPI) {
            option.assetsHost = 'http://bmclapi2.bangbang93.com/assets';
        }
        const location = this.state.root;
        await this.submit(Installer.installResolvedAssetsTask(assets, new MinecraftFolder(location), option)).wait();
    }

    /**
     * Download and install a minecract version
     */
    @Singleton('install')
    async installMinecraft(meta: Installer.Version) {
        const id = meta.id;

        let option = {};
        if (this.networkManager.isInGFW && this.state.setting.useBmclAPI) {
            option = { client: `https://bmclapi2.bangbang93.com/version/${meta.id}/client` };
        }

        const task = this.submit(Installer.installVersionTask('client', meta, this.state.root, option));

        try {
            await task.wait();
            this.local.refreshVersions();
        } catch (e) {
            this.warn(`An error ocurred during download version ${id}`);
            this.warn(e);
        }
    }


    /**
     * Install provided libraries.
     */
    @Singleton('install')
    async installLibraries({ libraries }: { libraries: (Version.Library | ResolvedLibrary)[] }) {
        let resolved: ResolvedLibrary[];
        if ('downloads' in libraries[0]) {
            resolved = Version.resolveLibraries(libraries);
        } else {
            resolved = libraries as any; // TODO: typecheck
        }
        let option = {};
        if (this.networkManager.isInGFW && this.state.setting.useBmclAPI) {
            option = { libraryHost: (lib: ResolvedLibrary) => `http://bmclapi.bangbang93.com/maven/${lib.path}` };
        }

        try {
            await this.submit(Installer.installResolvedLibrariesTask(resolved, this.state.root, option)).wait();
        } catch (e) {
            if ('libraryHost' in option) {
                try {
                    await this.submit(Installer.installResolvedLibrariesTask(resolved, this.state.root)).wait();
                } catch (e) {
                    this.warn(e);
                }
            }
            this.warn(e);
        }
    }

    /**
    * Refresh forge remote versions cache from forge websites 
    */
    @Singleton()
    async refreshForge(options: { force?: boolean; mcversion?: string } = {}) {
        let { mcversion, force } = options;

        mcversion = mcversion || this.getters.instance.runtime.minecraft;

        if (!force && this.refreshedForge[mcversion]) {
            this.log(`Skip to refresh forge metadata from ${mcversion}. Use cache.`);
            return;
        }
        this.refreshedForge[mcversion] = true;

        let minecraftVersion = mcversion;
        if (!minecraftVersion) {
            const prof = this.state.instance.all[this.state.instance.path];
            if (!prof) {
                this.log('The instance refreshing is not ready. Break forge versions list update.');
                return;
            }
            minecraftVersion = prof.runtime.minecraft;
        }

        try {
            let currentForgeVersion = this.state.version.forge.find(f => f.mcversion === minecraftVersion)!;
            let newForgeVersion: ForgeInstaller.VersionList = currentForgeVersion;
            if (this.networkManager.isInGFW) {
                this.log(`Update forge version list (BMCL) for Minecraft ${minecraftVersion}`);
                newForgeVersion = await this.getForgesFromBMCL(mcversion);
            } else {
                this.log(`Update forge version list (ForgeOfficial) for Minecraft ${minecraftVersion}`);
                newForgeVersion = await ForgeInstaller.getVersionList({ mcversion: minecraftVersion, original: currentForgeVersion });
            }

            if (newForgeVersion !== currentForgeVersion) {
                this.log('Found new forge versions list. Update it');
                this.commit('forgeMetadata', newForgeVersion);
            } else {
                this.log('No new forge version metadata found. Skip.');
            }
        } catch (e) {
            this.error(`Fail to fetch forge info of ${minecraftVersion}`);
            this.error(e);
        }
    }

    /**
     * Install forge by forge version metadata
     */
    @Singleton('install')
    async installForge(meta: Parameters<typeof installTask>[0]) {
        let maven = this.networkManager.isInGFW ? ['https://bmclapi2.bangbang93.com/maven'] : [];
        let handle = this.submit(ForgeInstaller.installTask(meta, this.state.root, {
            mavenHost: maven,
            java: this.getters.defaultJava.path,
            overwriteWhen: 'checksumNotMatchOrEmpty',
        }));
        let version: string | undefined;
        try {
            this.log(`Start to install forge ${meta.version} on ${meta.mcversion} using maven ${maven}`);
            version = await handle.wait();
            this.local.refreshVersions();
            this.log(`Success to install forge ${meta.version} on ${meta.mcversion}`);
        } catch (err) {
            this.warn(`An error ocurred during download version ${handle}`);
            this.warn(err);
        }
        return version;
    }

    /**
     * 
     * @param force shouls the version be refresh regardless if we have already refreshed fabric version.
     */
    @Singleton()
    async refreshFabric(force = false) {
        if (!force && this.refreshedFabric) {
            this.log('Skip to refresh fabric metadata. Use cache.');
            return;
        }

        this.log('Start to refresh fabric metadata');

        const getIfModified = async (url: string, timestamp: string) => {
            let { statusCode, headers } = await this.networkManager.request.head(url, { headers: { 'if-modified-since': timestamp } });
            return [statusCode === 200, headers['last-modified'] ?? timestamp] as const;
        };

        let [yarnModified, yarnDate] = await getIfModified(YARN_MAVEN_URL, this.state.version.fabric.yarnTimestamp);

        if (yarnModified) {
            let versions = await FabricInstaller.getYarnArtifactList();
            this.commit('fabricYarnMetadata', { versions, timestamp: yarnDate });
            this.log(`Refreshed fabric yarn metadata at ${yarnDate}.`);
        }

        let [loaderModified, loaderDate] = await getIfModified(LOADER_MAVEN_URL, this.state.version.fabric.loaderTimestamp);

        if (loaderModified) {
            let versions = await FabricInstaller.getLoaderArtifactList();
            this.commit('fabricLoaderMetadata', { versions, timestamp: loaderDate });
            this.log(`Refreshed fabric loader metadata at ${loaderDate}.`);
        }

        this.refreshedFabric = true;
    }

    /**
     * Install fabric to the game
     * @param versions The fabric versions
     */
    @Singleton('install')
    async installFabric(versions: { yarn: string; loader: string }) {
        try {
            this.log(`Start to install fabric: yarn ${versions.yarn}, loader ${versions.loader}.`);
            const handle = this.submit(Task.create('installFabric', () => FabricInstaller.install(versions.yarn, versions.loader, this.state.root)));
            await handle.wait();
            this.local.refreshVersions();
            this.log(`Success to install fabric: yarn ${versions.yarn}, loader ${versions.loader}.`);
        } catch (e) {
            this.warn(`An error ocurred during install fabric yarn-${versions.yarn}, loader-${versions.loader}`);
            this.warn(e);
        }
    }

    @Singleton()
    async refreshLiteloader(force = false) {
        if (!force && this.refreshedLiteloader) {
            return;
        }

        const option = this.state.version.liteloader.timestamp === '' ? undefined : {
            original: this.state.version.liteloader,
        };
        const remoteList = await LiteLoaderInstaller.getVersionList(option);
        if (remoteList !== this.state.version.liteloader) {
            this.commit('liteloaderMetadata', remoteList);
        }

        this.refreshedLiteloader = true;
    }

    @Singleton('install')
    async installLiteloader(meta: LiteLoaderInstaller.Version) {
        const task = this.submit(LiteLoaderInstaller.installTask(meta, this.state.root));
        try {
            await task.wait();
        } catch (err) {
            this.warn(err);
        } finally {
            this.local.refreshVersions();
        }
    }
}
