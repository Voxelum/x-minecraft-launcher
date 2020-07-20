import { copyPassively, exists } from '@main/util/fs';
import { ensureDir } from '@xmcl/installer/util';
import { Task } from '@xmcl/task';
import { copy, copyFile, readJson, remove, unlink, writeJson } from 'fs-extra';
import { join } from 'path';
import Service, { Singleton } from './Service';

export interface MigrateOptions {
    destination: string;
}

export default class BaseService extends Service {
    async init() {
        this.scanLocalMinecraft();
    }

    async scanLocalMinecraft() {
        const mcPath = this.getMinecraftPath();
        if (await exists(mcPath)) {
            if (this.state.version.local.length === 0) {
                this.log('Try to migrate the version from .minecraft');
                await copyPassively(join(mcPath, 'libraries'), join(this.state.root, 'libraries'));
                await copyPassively(join(mcPath, 'assets'), join(this.state.root, 'assets'));
                await copyPassively(join(mcPath, 'versions'), join(this.state.root, 'versions'));
            }
        }
    }

    saveSites() {

    }

    /**
     * Try to open a url in default browser. It will popup a message dialog to let user know.
     * If user does not trust the url, it won't open the site.
     * @param url The pending url
     */
    openInBrowser = this.app.openInBrowser.bind(this.app);

    /**
     * A electron provided function to show item in direcotry
     * @param path The path to the file item
     */
    showItemInDirectory = this.app.showItemInFolder;

    /**
     * A safe method that only open directory. If the `path` is a file, it won't execute it.
     * @param path The directory path.
     */
    openDirectory = this.app.openDirectory;

    async quitAndInstall() {
        if (this.state.setting.updateStatus === 'ready') {
            await this.quitAndInstall();
        }
        this.warn('There is no update avaiable!');
    }

    @Singleton()
    async checkUpdate() {
        let handle = this.submit(this.app.checkUpdateTask());
        try {
            this.log('Check update');
            let info = await handle.wait();
            this.commit('updateInfo', info);
        } catch (e) {
            this.error('Check update failed');
            this.error(e);
            throw e;
        }
    }

    /**
     * Download the update if there is avaiable update
     */
    @Singleton()
    async downloadUpdate() {
        if (!this.state.setting.updateInfo) {
            throw new Error('Cannot download update if we don\'t check the version update!');
        }
        let task: Task<void> = this.app.downloadUpdateTask();
        let handle = this.submit(task);
        await handle.wait();
        this.commit('updateStatus', 'ready');
    }

    quit = this.app.quit.bind(this.app);

    exit = this.app.exit;

    private oldMigratedRoot = '';

    async migrate(options: MigrateOptions) {
        // TODO: not to hardcode

        const source = this.app.gameDataPath;
        const destination = options.destination;
        await ensureDir(destination);

        function onError(e: any) {
            if (e.code === 'ENOENT') return;
            throw e;
        }

        try {
            await Promise.all([
                copy(this.getPath('assets'), join(destination, 'assets')).catch(onError),
                copy(this.getPath('libraries'), join(destination, 'libraries')).catch(onError),
                copy(this.getPath('instances'), join(destination, 'instances')).catch(onError),
                copy(this.getPath('versions'), join(destination, 'versions')).catch(onError),
                copy(this.getPath('mods'), join(destination, 'mods')).catch(onError),
                copy(this.getPath('resourcepacks'), join(destination, 'resourcepacks')).catch(onError),
                copy(this.getPath('saves'), join(destination, 'saves')).catch(onError),
                copy(this.getPath('modpacks'), join(destination, 'modpacks')).catch(onError),

                copyFile(this.getPath('instances.json'), join(destination, 'instances.json')).catch(onError),
                copyFile(this.getPath('minecraft-versions.json'), join(destination, 'minecraft-versions.json')).catch(onError),
                copyFile(this.getPath('forge-versions.json'), join(destination, 'forge-versions.json')).catch(onError),
                copyFile(this.getPath('lite-versions.json'), join(destination, 'lite-versions.json')).catch(onError),
                copyFile(this.getPath('fabric-versions.json'), join(destination, 'fabric-versions.json')).catch(onError),
                copyFile(this.getPath('authlib-injection.json'), join(destination, 'authlib-injection.json')).catch(onError),
                copyFile(this.getPath('java.json'), join(destination, 'java.json')).catch(onError),
                copyFile(this.getPath('setting.json'), join(destination, 'setting.json')).catch(onError),
                copyFile(this.getPath('user.json'), join(destination, 'user.json')).catch(onError),
            ]);

            const content = await readJson(join(destination, 'instances.json'));
            content.instances = content.instances.map((p: string) => (p.startsWith(source) ? (destination + p.substring(source.length)) : p));
            content.instance = content.selectedInstance.startsWith(source) ? (destination + content.selectedInstance.substring(source.length)) : content.selectedInstance;
            await writeJson(join(destination, 'instances.json'), content);
        } catch (e) {
            this.error('Fail to migrate the root! abort!');
            this.error(e);
            throw e;
        }

        try {
            this.oldMigratedRoot = this.app.gameDataPath;
            await this.app.migrateRoot(destination);
            this.commit('root', destination);
        } catch (e) {
            this.oldMigratedRoot = '';
            throw e;
        }
    }

    async postMigrate() {
        if (!this.oldMigratedRoot) {
            this.warn('Cannot perform post migrate as the migration is not performed or failed');
            return;
        }
        await this.serviceManager.dispose();

        function onError(e: any) {
            if (e.code === 'ENOENT') return;
            throw e;
        }

        await Promise.all([
            remove(join(this.oldMigratedRoot, 'assets')).catch(onError),
            remove(join(this.oldMigratedRoot, 'libraries')).catch(onError),
            remove(join(this.oldMigratedRoot, 'instances')).catch(onError),
            remove(join(this.oldMigratedRoot, 'versions')).catch(onError),
            remove(join(this.oldMigratedRoot, 'mods')).catch(onError),
            remove(join(this.oldMigratedRoot, 'resourcepacks')).catch(onError),
            remove(join(this.oldMigratedRoot, 'saves')).catch(onError),
            remove(join(this.oldMigratedRoot, 'modpacks')).catch(onError),

            unlink(join(this.oldMigratedRoot, 'instances.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'minecraft-versions.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'forge-versions.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'lite-versions.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'fabric-versions.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'authlib-injection.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'java.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'setting.json')).catch(onError),
            unlink(join(this.oldMigratedRoot, 'user.json')).catch(onError),
        ]);
        this.app.relaunch();
    }
}
