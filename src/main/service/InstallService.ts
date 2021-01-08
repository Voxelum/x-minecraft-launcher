import { isFabricLoaderLibrary, isForgeLibrary } from '@universal/entities/version';
import { ForgeVersion, ForgeVersionList, OptifineVersion, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema } from '@universal/entities/version.schema';
import { MutationKeys } from '@universal/store';
import { MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core';
import { getFabricLoaderArtifact, getForgeVersionList, getLiteloaderVersionList, getLoaderArtifactList, getVersionList, getYarnArtifactList, installAssetsTask, installFabric, InstallForgeOptions, installForgeTask, installLibrariesTask, installLiteloaderTask, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask, LiteloaderVersion, LOADER_MAVEN_URL, MinecraftVersion, Options, YARN_MAVEN_URL } from '@xmcl/installer';
import { task } from '@xmcl/task';
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

    private refreshedOptifine = false;

    private refreshedForge: Record<string, boolean> = {};

    async load() {
        const [mc, forge, liteloader, fabric, optifine] = await Promise.all([
            this.getPersistence({ path: this.getPath('minecraft-versions.json'), schema: VersionMinecraftSchema }),
            this.getPersistence({ path: this.getPath('forge-versions.json'), schema: VersionForgeSchema }),
            this.getPersistence({ path: this.getPath('lite-versions.json'), schema: VersionLiteloaderSchema }),
            this.getPersistence({ path: this.getPath('fabric-versions.json'), schema: VersionFabricSchema }),
            this.getPersistence({ path: this.getPath('optifine-versions.json'), schema: VersionOptifineSchema }),
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
        if (optifine) {
            this.commit('optifineMetadata', optifine);
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
            case 'optifineMetadata':
                await this.setPersistence({
                    path: this.getPath('optifine-versions.json'),
                    data: this.state.version.optifine,
                    schema: VersionOptifineSchema,
                });
                break;
            default:
        }
    }

    async init() {
    }

    protected getMinecraftJsonManifestRemote() {
        if (this.networkManager.isInGFW && this.state.setting.apiSetsPreference !== 'mojang') {
            const api = this.state.setting.apiSets.find(a => a.name === this.state.setting.apiSetsPreference);
            if (api) {
                return `${api.url}/mc/game/version_manifest.json`;
            }
        }
        return undefined;
    }

    protected getForgeInstallOptions(): InstallForgeOptions {
        const options: InstallForgeOptions = {
            ...this.networkManager.getDownloadBaseOptions(),
            overwriteWhen: 'checksumNotMatch',
            java: this.getters.defaultJava.path,
        };
        if (this.networkManager.isInGFW && this.state.setting.apiSetsPreference !== 'mojang') {
            const api = this.state.setting.apiSets.find(a => a.name === this.state.setting.apiSetsPreference);
            if (api) {
                options.mavenHost = [`${api.url}/maven`];
            }
        }
        return options;
    }

    protected getInstallOptions(): Options {
        const option: Options = {
            assetsDownloadConcurrency: 16,
            ...this.networkManager.getDownloadBaseOptions(),
            overwriteWhen: 'checksumNotMatch',
            side: 'client',
        };

        if (this.networkManager.isInGFW && this.state.setting.apiSetsPreference !== 'mojang') {
            const api = this.state.setting.apiSets.find(a => a.name === this.state.setting.apiSetsPreference);
            if (api) {
                option.assetsHost = `${api.url}/assets`;
                option.mavenHost = `${api.url}/maven`;
                option.assetsIndexUrl = (u) => {
                    const url = new URL(u.assetIndex.url);
                    const host = new URL(api.url).host;
                    url.host = host;
                    url.hostname = host;
                    return url.toString();
                };
                option.json = (u) => {
                    const url = new URL(u.url);
                    const host = new URL(api.url).host;
                    url.host = host;
                    url.hostname = host;
                    return url.toString();
                };
                option.client = (u) => {
                    const url = new URL(u.downloads.client.url);
                    const host = new URL(api.url).host;
                    url.host = host;
                    url.hostname = host;
                    return url.toString();
                };
            }
        }
        return option;
    }

    private async getForgesFromBMCL(mcversion: string, currentForgeVersion: ForgeVersionList) {
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

        const { body, statusCode, headers } = await this.networkManager.request({
            method: 'GET',
            url: `https://bmclapi2.bangbang93.com/forge/minecraft/${mcversion}`,
            headers: currentForgeVersion && currentForgeVersion.timestamp
                ? {
                    'If-Modified-Since': currentForgeVersion.timestamp,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
                }
                : {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
                },
            rejectUnauthorized: false,
        });
        function convert(v: BMCLForge): ForgeVersion {
            let installer = v.files.find(f => f.category === 'installer')!;
            let universal = v.files.find(f => f.category === 'universal')!;
            return {
                mcversion: v.mcversion,
                version: v.version,
                type: 'common',
                date: v.modified,
            } as any;
        }
        if (statusCode === 304) {
            return currentForgeVersion;
        }
        const forges: BMCLForge[] = JSON.parse(body);
        const result: ForgeVersionList = {
            mcversion,
            timestamp: headers['if-modified-since'] ?? forges[0]?.modified,
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
        const remote = this.getMinecraftJsonManifestRemote();
        const newMetadata = await getVersionList({ original: oldMetadata, remote });
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
        const option = this.getInstallOptions();
        const location = this.state.root;
        const resolvedVersion = await Version.parse(location, version);
        await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'));
    }

    @Singleton('install')
    async installDependencies(version: string) {
        const option = this.getInstallOptions();
        const location = this.state.root;
        const resolvedVersion = await Version.parse(location, version);
        await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries'));
        await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'));
    }

    @Singleton('install')
    async reinstall(version: string) {
        const option = this.getInstallOptions();
        const location = this.state.root;
        const local = this.state.version.local.find(v => v.id === version);
        if (!local) {
            throw new Error(`Cannot reinstall ${version} as it's not found!`);
        }
        await this.submit(installVersionTask({ id: local.minecraftVersion, url: '' }, location).setName('installVersion'));
        const forgeLib = local.libraries.find(isForgeLibrary);
        if (forgeLib) {
            await this.submit(installForgeTask({ version: forgeLib.version, mcversion: local.minecraftVersion }, location).setName('installForge'));
        }
        const fabLib = local.libraries.find(isFabricLoaderLibrary);
        if (fabLib) {
            await this.installFabric({ minecraft: local.minecraftVersion, loader: fabLib.version });
        }
        await this.submit(installLibrariesTask(local, option).setName('installLibraries'));
        await this.submit(installAssetsTask(local, option).setName('installAssets'));
    }

    /**
     * Install assets to the version
     * @param version The local version id
     */
    @Singleton('install')
    async installAssets(assets: { name: string; size: number; hash: string }[]) {
        const option = this.getInstallOptions();
        const location = this.state.root;
        const task = installResolvedAssetsTask(assets, new MinecraftFolder(location), option).setName('installAssets');
        await this.submit(task);
    }

    /**
     * Download and install a minecract version
     */
    @Singleton('install')
    async installMinecraft(meta: MinecraftVersion) {
        const id = meta.id;

        const option = this.getInstallOptions();
        const task = installVersionTask(meta, this.state.root, option).setName('installVersion');
        try {
            await this.submit(task);
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
            resolved = libraries as any;
        }
        const option = this.getInstallOptions();
        const task = installResolvedLibrariesTask(resolved, this.state.root, option).setName('installLibraries');
        try {
            await this.submit(task);
        } catch (e) {
            this.warn('An error ocurred during install libraries:');
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
            const currentForgeVersion = this.state.version.forge.find(f => f.mcversion === minecraftVersion)!;

            let newForgeVersion = currentForgeVersion;
            if (this.networkManager.isInGFW) {
                this.log(`Update forge version list (BMCL) for Minecraft ${minecraftVersion}`);
                newForgeVersion = await this.getForgesFromBMCL(mcversion, currentForgeVersion);
            } else {
                this.log(`Update forge version list (ForgeOfficial) for Minecraft ${minecraftVersion}`);
                newForgeVersion = await getForgeVersionList({ mcversion: minecraftVersion, original: currentForgeVersion as any }) as any;
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
    async installForge(meta: Parameters<typeof installForgeTask>[0]) {
        const options = this.getForgeInstallOptions();

        let version: string | undefined;
        try {
            this.log(`Start to install forge ${meta.version} on ${meta.mcversion}`);
            version = await this.submit(installForgeTask(meta, this.state.root, options));
            this.local.refreshVersions();
            this.log(`Success to install forge ${meta.version} on ${meta.mcversion}`);
        } catch (err) {
            this.warn(`An error ocurred during download version ${meta.version}@${meta.mcversion}`);
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

        const [yarnModified, yarnDate] = await getIfModified(YARN_MAVEN_URL, this.state.version.fabric.yarnTimestamp);

        if (yarnModified) {
            let versions = await getYarnArtifactList();
            this.commit('fabricYarnMetadata', { versions, timestamp: yarnDate });
            this.log(`Refreshed fabric yarn metadata at ${yarnDate}.`);
        }

        const [loaderModified, loaderDate] = await getIfModified(LOADER_MAVEN_URL, this.state.version.fabric.loaderTimestamp);

        if (loaderModified) {
            let versions = await getLoaderArtifactList();
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
    async installFabric(versions: { yarn?: string; loader: string; minecraft: string }) {
        try {
            this.log(`Start to install fabric: yarn ${versions.yarn}, loader ${versions.loader}.`);
            const result = await this.submit(task('installFabric', async () => {
                const artifact = await getFabricLoaderArtifact(versions.minecraft, versions.loader);
                return installFabric(artifact, this.getPath(), { side: 'client' });
            }));
            this.local.refreshVersions();
            this.log(`Success to install fabric: yarn ${versions.yarn}, loader ${versions.loader}.`);
            return result;
        } catch (e) {
            this.warn(`An error ocurred during install fabric yarn-${versions.yarn}, loader-${versions.loader}`);
            this.warn(e);
        }
        return undefined;
    }

    @Singleton()
    async refreshLiteloader(force = false) {
        if (!force && this.refreshedLiteloader) {
            return;
        }

        const option = this.state.version.liteloader.timestamp === '' ? undefined : {
            original: this.state.version.liteloader,
        };
        const remoteList = await getLiteloaderVersionList(option);
        if (remoteList !== this.state.version.liteloader) {
            this.commit('liteloaderMetadata', remoteList);
        }

        this.refreshedLiteloader = true;
    }

    @Singleton('install')
    async installLiteloader(meta: LiteloaderVersion) {
        try {
            await this.submit(installLiteloaderTask(meta, this.state.root));
        } catch (err) {
            this.warn(err);
        } finally {
            this.local.refreshVersions();
        }
    }

    @Singleton()
    async refreshOptifine(force = false) {
        if (!force && this.refreshedOptifine) {
            return;
        }

        this.log('Start to refresh optifine metadata');

        const headers = this.state.version.optifine.etag === '' ? undefined : {
            'If-None-Match': this.state.version.optifine.etag,
        };

        const response = await this.networkManager.request.get('https://bmclapi2.bangbang93.com/optifine/versionList', {
            headers,
            rejectUnauthorized: false,
        });

        if (response.statusCode === 304) {
            this.log('Not found new optifine version metadata. Use cache.');
        } else if (response.statusCode >= 200 && response.statusCode < 300) {
            const etag = response.headers.etag as string;
            const versions: OptifineVersion[] = JSON.parse(response.body);

            this.commit('optifineMetadata', {
                etag,
                versions,
            });
            this.log('Found new optifine version metadata. Update it.');
        }

        this.refreshedOptifine = true;
    }
}
