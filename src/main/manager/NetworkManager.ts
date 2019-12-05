import Task from "@xmcl/task";
import { BrowserWindow, DownloadItem } from 'electron';
import { fs } from "main/utils";
import { basename, join } from "path";
import { Store } from "vuex";
import { Manager } from ".";
import TaskManager from "./TaskManager";
import inGFW from 'in-gfw';

function downloadItemTask(item: DownloadItem) {
    function downloadItem(context: Task.Context) {
        return new Promise<string>((resolve, reject) => {
            item.on('updated', (e) => {
                context.update(item.getReceivedBytes(), item.getTotalBytes(), item.getURL());
            });
            item.on('done', (event, state) => {
                switch (state) {
                    case 'completed':
                        resolve(item.getSavePath());
                        break;
                    case 'cancelled':
                    case 'interrupted':
                    default:
                        reject(new Error(state));
                        break;
                }
            });
        });
    };
    downloadItem.parameters = { url: item.getURL(), file: item.getFilename() }
    return downloadItem;
}

export default class NetworkManager extends Manager {
    private taskManager!: TaskManager;
    private guard!: BrowserWindow;

    private downloading: { [url: string]: { file: string; callback: (item: Promise<string>) => void } } = {};
    private inGFW: boolean = false;

    constructor(private tempRoot: string = 'temps') {
        super();
    }

    async appReady() {
        this.updateGFW();
    }

    /**
     * Update the status of GFW
     */
    async updateGFW() {
        this.inGFW = await inGFW.net().catch(() => inGFW.os());
        return this.inGFW;
    }

    /**
     * Return if current environment is in GFW.
     */
    get isInGFW() {
        return this.inGFW;
    }

    /**
     * Download file using chrome browser default downloader! 
     * @param payload The url and the relative path to the launcher root folder
     * @returns The full downloaed file path
     */
    async downloadFile(payload: { url: string; file: string }) {
        const win = this.guard;
        if (!win) {
            throw new Error('Downloader Not Ready');
        }
        return new Promise<string>((resolve, reject) => {
            this.downloading[payload.url] = {
                file: payload.file,
                callback(prom) { prom.then(resolve, reject); }
            };
            win.webContents.downloadURL(payload.url);
        });
    }

    /**
     * Request url content by browser. This equivlent to enter the url to the browser and enter.
     * Once the browser finish loading, this function will return the content of the page.
     * @param url The requesting URL
     */
    async requestPage(url: string) {
        const root = this.tempRoot;
        const browser = this.guard;
        const cachePath = join(root, basename(new URL(url).pathname));
        browser.loadURL(url, {
            httpReferrer: browser.webContents.getURL() || '',
        });
        await new Promise((resolve, reject) => {
            browser.webContents.once('did-finish-load', () => {
                browser.webContents.savePage(cachePath, 'HTMLOnly')
                    .then(resolve, reject);
            });
        });
        const buffer = await fs.readFile(cachePath);
        return buffer.toString();
    }

    storeReady(store: Store<any>) {
        this.tempRoot = join(store.state.root, 'temps');
        this.guard = new BrowserWindow({
            focusable: false,
            webPreferences: {
                javascript: false,
                devTools: false
            },
            width: 0,
            height: 0,
            show: false,
        });
        this.guard.setFocusable(false);
        this.guard.webContents.session.once('will-download', (event, item, contents) => {
            const handle = this.downloading[item.getURL()];
            const savePath = join(store.state.root, 'temps', handle.file || item.getFilename());
            if (!item.getSavePath()) item.setSavePath(savePath);
            const downloadTask = downloadItemTask(item);
            const taskHandle = this.taskManager.submit(downloadTask);
            handle.callback(taskHandle.wait());
        });
    }
}