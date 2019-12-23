import { ForgeInstaller, ForgeWebPage, Installer, JavaExecutor, LiteLoader, Net, ResolvedLibrary, Version } from '@xmcl/minecraft-launcher-core';
import { getPersistence, setPersistence } from 'main/utils/persistence';
import { MutationKeys } from 'universal/store';
import { VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema } from 'universal/store/modules/version.schema';
import Service, { Inject, Singleton } from './Service';
import VersionService from './VersionService';

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export default class VersionInstallService extends Service {
    @Inject('VersionService')
    private local!: VersionService;

    async load() {
        const [mc, forge, liteloader] = await Promise.all([
            getPersistence({ path: this.getPath('minecraft-versions.json'), schema: VersionMinecraftSchema }),
            getPersistence({ path: this.getPath('forge-versions.json'), schema: VersionForgeSchema }),
            getPersistence({ path: this.getPath('lite-versions.json'), schema: VersionLiteloaderSchema }),
        ]);
        if (typeof mc === 'object') this.commit('minecraftMetadata', mc);
        if (typeof forge === 'object') {
            for (const value of Object.values(forge!)) {
                this.commit('forgeMetadata', value);
            }
        }
        if (liteloader) this.commit('liteloaderMetadata', liteloader);
    }

    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'minecraftMetadata':
                await setPersistence({
                    path: this.getPath('minecraft-versions.json'),
                    data: this.state.version.minecraft,
                    schema: VersionMinecraftSchema,
                });
                break;
            case 'forgeMetadata':
                await setPersistence({
                    path: this.getPath('forge-versions.json'),
                    data: this.state.version.forge,
                    schema: VersionForgeSchema,
                });
                break;
            case 'liteloaderMetadata':
                await setPersistence({
                    path: this.getPath('lite-versions.json'),
                    data: this.state.version.liteloader,
                    schema: VersionLiteloaderSchema,
                });
                break;
            default:
        }
    }

    async init() {
        this.refreshMinecraft();
        this.refreshForge();
        this.refreshLiteloader();
    }

    async refresh() {
        await Promise.all([
            this.refreshMinecraft(),
            this.refreshForge(),
            this.refreshLiteloader(),
        ]);
    }

    /**
     * Request minecraft version list and cache in to store and disk.
     */
    @Singleton()
    async refreshMinecraft() {
        const oldMetadata = this.state.version.minecraft;
        this.log('Updating minecraft version metadata');
        const newMetadata = await Installer.updateVersionMeta({ fallback: oldMetadata });
        if (oldMetadata !== newMetadata) {
            this.log('Found new version meta list. Update it.');
            this.commit('minecraftMetadata', newMetadata);
        }
    }

    /**
     * Install assets to the version
     * @param version The local version id
     */
    @Singleton('install')
    async installAssets(version: string) {
        const location = this.state.root;
        let option = {};
        if (this.managers.NetworkManager.isInGFW && this.state.setting.useBmclAPI) {
            option = { assetsHost: 'http://bmclapi2.bangbang93.com/assets' };
        }
        const resolved = await Version.parse(location, version);
        try {
            await this.submit(Installer.installAssetsTask(resolved, option)).wait();
        } catch (err) {
            this.warn(err);
        }
    }

    @Singleton('install')
    async installDependencies(version: string) {
        const location = this.state.root;
        const resolved = await Version.parse(location, version);
        try {
            await this.submit(Installer.installDependenciesTask(resolved)).wait();
        } catch (err) {
            this.warn(err);
        }
    }

    /**
     * Download and install a minecract version
     */
    @Singleton('install')
    async installMinecraft(meta: Installer.VersionMeta) {
        const id = meta.id;

        let option = {};
        if (this.managers.NetworkManager.isInGFW && this.state.setting.useBmclAPI) {
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
     * Install forge by forge version metadata
     */
    @Singleton('install')
    async installForge(meta: ForgeInstaller.VersionMeta) {
        const maven = this.managers.NetworkManager.isInGFW ? 'https://voxelauncher.azurewebsites.net/api/v1' : undefined;
        const handle = this.submit(ForgeInstaller.installTask(meta, this.state.root, {
            maven,
            java: JavaExecutor.createSimple(this.getters.defaultJava.path),
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

    @Singleton('install')
    async installLiteloader(meta: LiteLoader.VersionMeta) {
        const task = this.submit(LiteLoader.installTask(meta, this.state.root));
        try {
            await task.wait();
        } catch (err) {
            this.warn(err);
        } finally {
            this.local.refreshVersions();
        }
    }

    @Singleton('install')
    async installLibraries({ libraries }: { libraries: (Version.Library | ResolvedLibrary)[] }) {
        let resolved: ResolvedLibrary[];
        if ('downloads' in libraries[0]) {
            resolved = Version.resolveLibraries(libraries);
        } else {
            resolved = libraries as any; // TODO: typecheck
        }
        let option = {};
        if (this.managers.NetworkManager.isInGFW && this.state.setting.useBmclAPI) {
            option = { libraryHost: (lib: ResolvedLibrary) => `http://bmclapi.bangbang93.com/maven/${lib.path}` };
        }

        try {
            await this.submit(Installer.installLibrariesDirectTask(resolved, this.state.root, option)).wait();
        } catch (e) {
            if ('libraryHost' in option) {
                try {
                    await this.submit(Installer.installLibrariesDirectTask(resolved, this.state.root)).wait();
                } catch (e) {
                    this.warn(e);
                }
            }
            this.warn(e);
        }
    }

    async getForgeWebPage(mcversion: string) {
        if (!this.state.version.forge[mcversion]) {
            this.refreshForge(mcversion);
        }
        return this.state.version.forge[mcversion];
    }

    /**
    * Refresh the remote versions cache 
    */
    @Singleton()
    async refreshForge(mcversion?: string) {
        // TODO: change to handle the profile not ready
        let version = mcversion;
        if (!version) {
            const prof = this.state.instance.all[this.state.instance.id];
            if (!prof) {
                this.log('The profile refreshing is not ready. Break forge versions list update.');
                return;
            }
            version = prof.runtime.minecraft;
        }

        this.log(`Update forge version list under Minecraft ${version}`);

        const cur = this.state.version.forge[version];
        try {
            if (this.managers.NetworkManager.isInGFW) {
                const headers = cur ? {
                    'If-Modified-Since': cur.timestamp,
                } : {};
                this.log('Using self host to fetch forge versions list');
                const { body, statusCode } = await Net.fetchJson(`https://voxelauncher.azurewebsites.net/api/v1/forge/versions/${version}`, {
                    headers,
                });

                if (statusCode !== 304 && body) {
                    this.log('Found new forge versions list. Update it');
                    this.commit('forgeMetadata', body);
                }
            } else {
                this.log('Using direct query to fetch forge versions list');
                const result = await ForgeWebPage.getWebPage({ mcversion: version, fallback: cur });
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

    @Singleton()
    async refreshLiteloader() {
        const option = this.state.version.liteloader.timestamp === '' ? undefined : {
            fallback: this.state.version.liteloader,
        };
        const remoteList = await LiteLoader.VersionMetaList.update(option);
        if (remoteList !== this.state.version.liteloader) {
            this.commit('liteloaderMetadata', remoteList);
        }
    }
}
