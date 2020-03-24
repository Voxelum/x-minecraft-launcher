import { MutationKeys } from '@universal/store';
import { VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema } from '@universal/store/modules/version.schema';
import { ResolvedLibrary, Version, MinecraftFolder } from '@xmcl/core';
import { FabricInstaller, ForgeInstaller, Installer, LiteLoaderInstaller } from '@xmcl/installer';
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
        const [mc, forge, liteloader] = await Promise.all([
            this.getPersistence({ path: this.getPath('minecraft-versions.json'), schema: VersionMinecraftSchema }),
            this.getPersistence({ path: this.getPath('forge-versions.json'), schema: VersionForgeSchema }),
            this.getPersistence({ path: this.getPath('lite-versions.json'), schema: VersionLiteloaderSchema }),
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
            default:
        }
    }

    async init() {
    }

    async refresh() {
        await Promise.all([
            this.refreshMinecraft(),
            this.refreshForge(),
            this.refreshLiteloader(),
        ]);
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
            timestamp: forges[0].modified,
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
        this.refreshedMinecraft = true;
        this.log('Updating minecraft version metadata');
        const oldMetadata = this.state.version.minecraft;
        const newMetadata = await Installer.getVersionList({ original: oldMetadata });
        if (oldMetadata !== newMetadata) {
            this.log('Found new minecraft version metadata. Update it.');
            this.commit('minecraftMetadata', newMetadata);
        } else {
            this.log('Not found new Minecraft version metadata. Use cache.');
        }
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

    async getForgeWebPage(mcversion: string) {
        if (!this.state.version.forge[mcversion]) {
            this.refreshForge({ mcversion });
        }
        return this.state.version.forge[mcversion];
    }

    /**
    * Refresh forge remote versions cache from forge websites 
    */
    @Singleton()
    async refreshForge(options: { force?: boolean; mcversion?: string } = {}) {
        let { mcversion, force } = options;

        mcversion = mcversion || this.getters.instance.runtime.minecraft;

        if (!force && this.refreshedForge[mcversion]) {
            this.log(`Skip to refresh forge metadata from ${mcversion}. Use cache`);
            return;
        }
        this.refreshedForge[mcversion] = true;

        let version = mcversion;
        if (!version) {
            const prof = this.state.instance.all[this.state.instance.path];
            if (!prof) {
                this.log('The profile refreshing is not ready. Break forge versions list update.');
                return;
            }
            version = prof.runtime.minecraft;
        }

        this.log(`Update forge version list under Minecraft ${version}`);

        const cur = this.state.version.forge[version];
        try {
            if (this.networkManager.isInGFW) {
                // const headers = cur ? { 'If-Modified-Since': cur.timestamp } : {};
                this.log('Using self host to fetch forge versions list');
                let version = await this.getForgesFromBMCL(mcversion);
                this.log('Found new forge versions list. Update it');
                this.commit('forgeMetadata', version);
                // const { body, statusCode } = await this.networkManager.request(`https://xmcl.azurewebsites.net/api/v1/forge/versions/${version}`, {
                //     headers,
                //     responseType: 'json',
                // });

                // if (statusCode !== 304 && body) {
                //     this.log('Found new forge versions list. Update it');
                //     this.commit('forgeMetadata', body as ForgeInstaller.VersionList);
                // }
            } else {
                this.log('Using direct query to fetch forge versions list');
                const result = await ForgeInstaller.getVersionList({ mcversion: version, original: cur });
                if (result !== cur) {
                    this.log('Found new forge versions list. Update it');
                    this.commit('forgeMetadata', result);
                }
            }
        } catch (e) {
            this.error(`Fail to fetch forge info of ${version}`);
            this.error(e);
        } finally {
            this.log('Finish update forge versions list');
        }
    }

    /**
     * Install forge by forge version metadata
     */
    @Singleton('install')
    async installForge(meta: Parameters<typeof installTask>[0]) {
        let maven = this.networkManager.isInGFW ? ['https://xmcl.azurewebsites.net/api/v1/maven', 'https://bmclapi2.bangbang93.com/maven'] : [];
        let handle = this.submit(ForgeInstaller.installTask(meta, this.state.root, {
            mavenHost: maven,
            java: this.getters.defaultJava.path,
            overwriteWhen: 'checksumNotMatchOrEmpty',
        }));
        let version: string | undefined;
        try {
            version = await handle.wait();
            this.local.refreshVersions();
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
            return;
        }

        this.refreshedFabric = true;
        let originalVersionList = this.state.version.fabric;
        let loaderList = await FabricInstaller.getLoaderVersionList({ original: originalVersionList.loader });
        let yarnList = await FabricInstaller.getLoaderVersionList({ original: originalVersionList.yarn });
        this.commit('fabricMetadata', { yarn: yarnList, loader: loaderList });
    }

    /**
     * Install fabric to the game
     * @param versions The fabric versions
     */
    @Singleton('install')
    async installFabric(versions: { yarn: string; loader: string }) {
        try {
            const handle = this.submit(Task.create('installFabric', () => FabricInstaller.install(versions.yarn, versions.loader, this.state.root)));
            await handle.wait();
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

        this.refreshedLiteloader = true;

        const option = this.state.version.liteloader.timestamp === '' ? undefined : {
            original: this.state.version.liteloader,
        };
        const remoteList = await LiteLoaderInstaller.getVersionList(option);
        if (remoteList !== this.state.version.liteloader) {
            this.commit('liteloaderMetadata', remoteList);
        }
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
