import { vfs } from '@xmcl/util';
import { app, BrowserWindow } from 'electron';
import { HTMLElement, parse as parseHTML } from 'fast-html-parser';
import { basename, join } from 'path';

let browser: BrowserWindow;
let tempRoot: string = '';
function getTempRoot() {
    if (tempRoot === '')
        tempRoot = join(app.getPath('userData'), 'temps');
    return tempRoot;
}
const waitBrowser = new Promise((resolve, reject) => {
    app.once('ready', () => {
        browser = new BrowserWindow({
            focusable: false,
            webPreferences: {
                javascript: false,
                devTools: false
            },
            width: 0,
            height: 0,
            show: false,
        });
        browser.setFocusable(false);
        resolve();
    })
});


export async function request<T>(url: string, transformToObject: (element: HTMLElement) => T) {
    const body = await fetchPageFromBrowser(url, getTempRoot())
    const html = parseHTML(body);
    return transformToObject(html);
}

async function fetchPageFromBrowser(url: string, root: string) {
    await waitBrowser;
    const cachePath = join(root, basename(new URL(url).pathname));
    browser.loadURL(url, {
        httpReferrer: browser.webContents.getURL() || '',
    });
    await new Promise((resolve, reject) => {
        browser.webContents.once('did-finish-load', () => {
            browser.webContents.savePage(cachePath, 'HTMLOnly', (e) => {
                if (e) reject(e);
                else resolve();
            });
        });
    })
    const buffer = await vfs.readFile(cachePath);
    return buffer.toString();
}

