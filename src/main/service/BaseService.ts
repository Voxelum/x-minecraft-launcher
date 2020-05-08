import { copyPassively, exists } from '@main/util/fs';
import { Task } from '@xmcl/task';
import { join } from 'path';
import { SemVer } from 'semver';
import Service from './Service';

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

    getTrustedSites = this.appManager.getTrustedSites.bind(this.appManager);

    /**
     * Try to open a url in default browser. It will popup a message dialog to let user know.
     * If user does not trust the url, it won't open the site.
     * @param url The pending url
     */
    openInBrowser = this.appManager.openInBrowser.bind(this.appManager);

    /**
     * A electron provided function to show item in direcotry
     * @param path The path to the file item
     */
    showItemInDirectory = this.appManager.showItemInFolder;

    /**
     * A safe method that only open directory. If the `path` is a file, it won't execute it.
     * @param path The directory path.
     */
    openDirectory = this.appManager.openDirectory;

    async quitAndInstall() {
        if (this.state.setting.readyToUpdate !== 'none') {
            if (this.state.setting.readyToUpdate === 'asar') {
                await this.updateManager.quitAndInstallAsar();
            } else {
                this.updateManager.quitAndInstallFullUpdate();
            }
        }
    }

    async checkUpdate() {
        this.commit('checkingUpdate', true);
        const checkUpdate = Task.create('checkUpdate', async () => {
            try {
                const info = await this.updateManager.checkForUpdates();
                this.commit('updateInfo', info.updateInfo);
                return info;
            } catch {
                return undefined;
            } finally {
                this.commit('checkingUpdate', false);
            }
        });
        return this.submit(checkUpdate);
    }

    /**
     * Download the update if there is avaiable update
     */
    async downloadUpdate() {
        if (!this.state.setting.updateInfo) {
            throw new Error('Cannot download update if we don\'t check the version update!');
        }
        let currentVersion = new SemVer(this.state.launcherVersion);
        let newVersion = new SemVer(this.state.setting.updateInfo.version);
        let task: Task<void>;
        if (newVersion.major !== currentVersion.major) {
            task = this.updateManager.downloadFullUpdateTask();
        } else {
            let asarFile = this.state.setting.updateInfo.files.find((f) => f.url.endsWith('app.asar'));
            if (asarFile) {
                task = this.updateManager.downloadAsarUpdateTask(asarFile.url, asarFile.sha512);
            } else {
                task = this.updateManager.downloadFullUpdateTask();
            }
        }
        let handle = this.submit(task);
        await handle.wait();
    }

    quit = this.appManager.quit;

    exit = this.appManager.exit;
}
