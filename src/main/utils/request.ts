import hparser from 'fast-html-parser';
import { got } from '@xmcl/minecraft-launcher-core';
import { ipcMain } from 'electron';

let ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36';
// @ts-ignore
ipcMain.on('user-agent', (event, arg) => {
    ua = arg;
});

/**
 * In memory cache
 */
const cache: { [key: string]: any } = {};

async function request<T>(url: string, parser: (element: hparser.HTMLElement) => T) {
    if (cache[url]) return cache[url];
    const resp = await got.get(url, {
        headers: {
            'user-agent': ua,
        },
    });
    const parsed = hparser.parse(resp.body);
    const result = parser(parsed);
    if (result) {
        cache[url] = result;
        setTimeout(() => { delete cache[url]; }, 60000);
    }
    return result;
}

export default request;
