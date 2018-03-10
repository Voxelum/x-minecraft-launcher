import hparser from 'fast-html-parser'
import { net } from 'electron'

const cache = {}

export default
/**
 * @template T
 * 
 * @param {string|any} url
 * @param {(element:hparser.HTMLElement) => T} parser
 * @returns {Promise<T>}
 */
(url, parser) => {
    if (cache[url]) return Promise.resolve(cache[url]);
    return new Promise((resolve, reject) => {
        let s = '';
        const req = net.request(url)
        req.on('response', (msg) => {
            msg.on('data', (b) => { s += b.toString() })
            msg.on('end', () => {
                resolve(s)
            })
        })
        if (url.headers) {
            Object.keys(url.headers).forEach((key) => {
                req.setHeader(key, url.headers[key]);
            })
        }
        req.on('error', e => reject(e))
        req.end()
    })
        .then(hparser.parse)
        .then(parser)
        .then((parsed) => {
            if (parsed !== null) {
                cache[url] = parsed;
                setTimeout(() => { delete cache[url]; }, 60000);
            }
            return parsed;
        })
}

