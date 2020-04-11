import { DefaultDownloader, DownloadOption } from '@xmcl/installer';
import { Task } from '@xmcl/task';
import { BrowserWindow, DownloadItem, session, Session } from 'electron';
import { readFile } from 'fs-extra';
import { basename, join } from 'path';
import { Store } from 'vuex';
import { Manager } from '.';

function downloadItemTask(item: DownloadItem) {
    return Task.create('downloadItem', (context: Task.Context) => new Promise<string>((resolve, reject) => {
        item.on('updated', () => {
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
    }), { url: item.getURL(), file: item.getFilename() });
}

export default class NetworkManager extends Manager {
    private guard!: BrowserWindow;

    private jsguard: BrowserWindow | undefined;

    private jsguardClearHandle: NodeJS.Timeout | undefined;

    private downloading: { [url: string]: { file: string; callback: (item: Promise<string>) => void } } = {};

    private inGFW = false;

    private downloader = new DefaultDownloader();

    readonly request = this.downloader.requster.extend({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.83 Safari/537.36 Edg/81.0.416.41' } });

    private session: Session | undefined;

    constructor(private tempRoot: string = 'temp') {
        super();
    }

    getDownloaderOption() {
        return {
            downloader: this.downloader,
            maxConcurrency: 16,
            overwriteWhen: 'checksumNotMatchOrEmpty',
        } as const;
    }

    async rootReady(root: string) {
        this.tempRoot = join(root, 'temp');
    }

    async appReady() {
        this.updateGFW();
    }

    /**
     * Update the status of GFW
     */
    async updateGFW() {
        this.inGFW = await Promise.race([
            this.request.head('https://npm.taobao.org', { throwHttpErrors: false }).then(() => true, () => false),
            this.request.head('https://www.google.com', { throwHttpErrors: false }).then(() => false, () => true),
        ]);
        this.log(this.inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.');
        return this.inGFW;
    }

    /**
     * Return if current environment is in GFW.
     */
    get isInGFW() {
        return this.inGFW;
    }

    async downloadFile(options: DownloadOption) {
        return this.downloader.downloadFile(options);
    }

    /**
     * Download file using chrome browser default downloader! 
     * @param payload The url and the relative path to the launcher root folder
     * @returns The full downloaed file path
     */
    async downloadFileByBrowser(payload: { url: string; file: string }) {
        const win = this.guard;
        if (!win) {
            throw new Error('Downloader Not Ready');
        }
        return new Promise<string>((resolve, reject) => {
            this.downloading[payload.url] = {
                file: payload.file,
                callback(prom) { prom.then(resolve, reject); },
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
        const success = await new Promise((resolve) => {
            browser.webContents.once('did-navigate', (e, u, code) => {
                if (code === 503) {
                    resolve(false);
                }
            });
            browser.webContents.once('dom-ready', () => {
                browser.webContents.savePage(cachePath, 'HTMLOnly')
                    .then(() => resolve(true), () => resolve(false));
            });
        });
        if (success) {
            const buffer = await readFile(cachePath);
            return buffer.toString();
        }
        return this.requestPageWithJS(url);
    }

    async requestPageWithJS(url: string) {
        this.log(`Request with js ${url}`);
        const root = this.tempRoot;
        this.ensureJSGuard();
        const browser = this.jsguard!;
        const cachePath = join(root, basename(new URL(url).pathname));
        browser.loadURL(url, {
            httpReferrer: browser.webContents.getURL() || '',
        });
        const { code, success } = await new Promise((resolve) => {
            let scode = 0;
            browser.webContents.once('did-navigate', (e, u, code) => {
                scode = code;
            });
            browser.webContents.once('dom-ready', () => {
                browser.webContents.savePage(cachePath, 'HTMLOnly')
                    .then(() => resolve({ code: scode, success: true }), () => resolve({ code: scode, success: false }));
            });
        });
        if (success) {
            const buffer = await readFile(cachePath);
            return buffer.toString();
        }
        throw new Error(`Fail to fetch ${url}. Code: ${code}`);
    }

    private ensureSession() {
        if (!this.session) {
            this.session = session.fromPartition('persist:interal');
            this.session.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.69 Safari/537.36 Edg/81.0.416.34');
        }
        return this.session;
    }

    private ensureJSGuard() {
        if (!this.jsguard) {
            this.jsguard = new BrowserWindow({
                focusable: false,
                webPreferences: {
                    session: this.ensureSession(),
                    javascript: true,
                    devTools: false,
                },
                show: false,
            });
        }
        if (this.jsguardClearHandle) {
            clearTimeout(this.jsguardClearHandle);
        }
        this.jsguardClearHandle = setTimeout(() => {
            this.jsguard!.close();
            this.jsguard = undefined;
        }, 10000);
    }

    storeReady(store: Store<any>) {
        this.guard = new BrowserWindow({
            focusable: false,
            webPreferences: {
                javascript: false,
                devTools: false,
            },
            show: false,
        });
        this.guard.setFocusable(false);
        this.guard.webContents.session.once('will-download', (event, item, contents) => {
            const handle = this.downloading[item.getURL()];
            const savePath = join(this.tempRoot, handle.file || item.getFilename());
            if (!item.getSavePath()) item.setSavePath(savePath);
            const downloadTask = downloadItemTask(item);
            const taskHandle = this.managers.taskManager.submit(downloadTask);
            handle.callback(taskHandle.wait());
        });
    }
}
