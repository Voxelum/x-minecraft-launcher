import LauncherApp from '@main/app/LauncherApp';
import { downloadFileTask, DownloadOption, HttpDownloader } from '@xmcl/installer';
import got from 'got';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent, AgentOptions } from 'https';
import { cpus } from 'os';
import { Manager } from '.';

export default class NetworkManager extends Manager {
    private inGFW = false;

    private downloader: HttpDownloader;

    readonly request = got.extend({});

    constructor(app: LauncherApp) {
        super(app);
        let options: AgentOptions = {
            keepAlive: true,
            maxSockets: cpus().length * 4,
            rejectUnauthorized: false,
        };
        this.downloader = new HttpDownloader({
            http: new HttpAgent(options),
            https: new HttpsAgent(options),
        });
    }

    getDownloaderOption() {
        return {
            downloader: this.downloader,
            overwriteWhen: 'checksumNotMatchOrEmpty',
        } as const;
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

    downloadFileTask(options: DownloadOption) {
        return downloadFileTask(options, { downloader: this.downloader });
    }

    /**
     * Download file using chrome browser default downloader! 
     * @param payload The url and the relative path to the launcher root folder
     * @returns The full downloaed file path
     */
    // async downloadFileByBrowser(payload: { url: string; file: string }) {
    //     const ses = this.ensureSession();
    //     return new Promise<string>((resolve, reject) => {
    //         this.downloading[payload.url] = {
    //             file: payload.file,
    //             callback(prom) { prom.then(resolve, reject); },
    //         };
    //         ses.createInterruptedDownload({ path: file, urlChain: [url] });
    //     });
    // }

    /**
     * Request url content by browser. This equivlent to enter the url to the browser and enter.
     * Once the browser finish loading, this function will return the content of the page.
     * @param url The requesting URL
     */
    // async requestPageWithJS(url: string) {
    //     this.log(`Request with js ${url}`);
    //     const root = this.tempRoot;
    //     this.ensureJSGuard();
    //     const browser = this.jsguard!;
    //     const cachePath = join(root, basename(new URL(url).pathname));
    //     browser.loadURL(url, {
    //         httpReferrer: browser.webContents.getURL() || '',
    //     });
    //     const { code, success } = await new Promise((resolve) => {
    //         let scode = 0;
    //         browser.webContents.once('did-navigate', (e, u, code) => {
    //             scode = code;
    //         });
    //         browser.webContents.once('dom-ready', () => {
    //             browser.webContents.savePage(cachePath, 'HTMLOnly')
    //                 .then(() => resolve({ code: scode, success: true }), () => resolve({ code: scode, success: false }));
    //         });
    //     });
    //     if (success) {
    //         const buffer = await readFile(cachePath);
    //         return buffer.toString();
    //     }
    //     throw new Error(`Fail to fetch ${url}. Code: ${code}`);
    // }

    // private ensureSession() {
    //     if (!this.session) {
    //         this.session = session.fromPartition('persist:interal');
    //         this.session.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.69 Safari/537.36 Edg/81.0.416.34');
    //         this.session.on('will-download', (event, item) => {
    //             const handle = this.downloading[item.getURL()];
    //             const savePath = join(this.tempRoot, handle.file || item.getFilename());
    //             if (!item.getSavePath()) item.setSavePath(savePath);
    //             const downloadTask = downloadItemTask(item);
    //             const taskHandle = this.managers.taskManager.submit(downloadTask);
    //             handle.callback(taskHandle.wait());
    //         });
    //     }
    //     return this.session;
    // }

    // private ensureJSGuard() {
    //     if (!this.jsguard) {
    //         this.jsguard = new BrowserWindow({
    //             focusable: false,
    //             webPreferences: {
    //                 session: this.ensureSession(),
    //                 javascript: true,
    //                 devTools: false,
    //             },
    //             show: false,
    //         });
    //     }
    //     if (this.jsguardClearHandle) {
    //         clearTimeout(this.jsguardClearHandle);
    //     }
    //     this.jsguardClearHandle = setTimeout(() => {
    //         this.jsguard!.close();
    //         this.jsguard = undefined;
    //     }, 10000);
    // }

    // setup code
    setup() {
        this.updateGFW();
    }
}
