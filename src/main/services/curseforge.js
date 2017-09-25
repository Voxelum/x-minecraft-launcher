import { net } from 'electron'
import querystring from 'querystring'
import parser from 'fast-html-parser'

function localDate(string) {
    const d = new Date(0)
    d.setUTCSeconds(Number.parseInt(string, 10))
    return d.toLocaleDateString()
}

function request(endpoint) {
    return new Promise((resolve, reject) => {
        let s = ''
        const req = net.request(endpoint)
        req.on('response', (msg) => {
            msg.on('data', (b) => { s += b.toString() })
            msg.on('end', () => {
                resolve(s)
            })
        })
        req.on('error', e => reject(e))
        req.end()
    });
}

function convert(node) {
    if (node === null || !node) return '';
    let text = '';
    if (node instanceof parser.TextNode) {
        text += node.rawText;
    } else if (node instanceof parser.HTMLElement) {
        if (node.tagName !== null) {
            if (node.tagName === 'a') {
                let attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
                if (node.attributes.href) {
                    const href = node.attributes.href;
                    const newHref = `#/external/${href.substring(href.indexOf('remoteUrl=') + 'remoteUrl='.length)}`
                    attrs = querystring.unescape(querystring.unescape(attrs.replace(href, newHref)))
                }
                text += `<${node.tagName}${attrs}>`
            } else {
                const attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
                text += `<${node.tagName}${attrs}>`
            }
        }
        if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c)
        if (node.tagName !== null) text += `</${node.tagName}>`
    } else throw new Error(`Unsupported type ${JSON.stringify(node)}`);
    return text
}

export default {
    initialize() {
    },
    actions: {
        async downloads({ path, version, page } = {}) {
            if (!path || path == null) throw new Error('Curseforge path cannot be null')
            version = version || ''
            page = page || 1
            const filespage = parser.parse(await request(`
            https://minecraft.curseforge.com${path}/files?filter-game-version=${version}&page=${page}
            `))
            const pages = filespage.querySelectorAll('.b-pagination-item')
                .map(pageItem => pageItem.firstChild.rawText)
                .map(text => Number.parseInt(text, 10))
                .filter(n => Number.isInteger(n))
                .reduce((a, b) => (a > b ? a : b))
            const versions = filespage.querySelector('#filter-game-version').removeWhitespace()
                .childNodes.map(ver => ({
                    type: ver.attributes.class,
                    text: ver.rawText,
                    value: ver.attributes.value,
                }))
            const files = filespage.querySelectorAll('.project-file-list-item')
                .map((i) => {
                    i = i.removeWhitespace();
                    return {
                        type: i.firstChild.firstChild.attributes.title,
                        name: i.childNodes[1].firstChild.childNodes[1].firstChild.rawText,
                        href: i.childNodes[1].firstChild.firstChild.firstChild.attributes.href,
                        size: i.childNodes[2].rawText,
                        date: localDate(i.childNodes[3].firstChild.attributes['data-epoch']),
                        version: i.childNodes[4].firstChild.rawText,
                        downloadCount: i.childNodes[5].rawText,
                    }
                })
            return { pages, versions, files };
        },
        async project(path) {
            if (!path || path == null) throw new Error('Curseforge path cannot be null')
            const root = parser.parse(await request(`https://minecraft.curseforge.com${path}`));
            const descontent = root.querySelector('.project-description')
            const description = convert(descontent)
            const details = root.querySelector('.project-details').removeWhitespace()
            const createdDate = localDate(details.childNodes[1].childNodes[1].firstChild.attributes['data-epoch'])
            const lastFile = localDate(details.childNodes[2].childNodes[1].firstChild.attributes['data-epoch'])
            const totalDownload = details.childNodes[3].childNodes[1].rawText
            const license = details.childNodes[4].childNodes[1].attributes.href;

            const projWrap = root.querySelector('.project-user').removeWhitespace()
            const image = projWrap.firstChild.firstChild.attributes.href;
            const name = projWrap.childNodes[1].firstChild.rawText;

            const files = root.querySelectorAll('.file-tag')
                .map((f) => {
                    f = f.removeWhitespace();
                    const typeClass = f.firstChild.firstChild.attributes.class;
                    let type = 'unknonwn'
                    if (typeClass.includes('release')) type = 'release'
                    else if (typeClass.includes('alpha')) type = 'alpha'
                    else if (typeClass.includes('beta')) type = 'beta'
                    const href = f.childNodes[1].firstChild.attributes.href;
                    const fname = f.childNodes[1].childNodes[1].rawText;
                    const date = localDate(f.childNodes[1].childNodes[2].attributes['data-epoch'])
                    return {
                        type,
                        href,
                        name: fname,
                        date,
                    }
                });
            return {
                image,
                name,
                createdDate,
                lastFile,
                totalDownload,
                license,
                description,
                downloads: {},
                // files,
            }
        },
        async mods({ page, sort, version } = {}) {
            const endpoint = `https://minecraft.curseforge.com/mc-mods?${querystring.stringify({
                page: page || '',
                'filter-sort': sort || 'popularity',
                'filter-game-version': version || '',
            })}`
            const s = await request(endpoint)
            const root = parser.parse(s.replace(/\r\n/g, ''));
            const pages = root.querySelectorAll('.b-pagination-item')
                .map(pageItem => pageItem.firstChild.rawText)
                .map(text => Number.parseInt(text, 10))
                .filter(n => Number.isInteger(n))
                .reduce((a, b) => (a > b ? a : b))
            const versions = root.querySelector('#filter-game-version').removeWhitespace()
                .childNodes.map(ver => ({
                    type: ver.attributes.class,
                    text: ver.rawText,
                    value: ver.attributes.value,
                }))
            const filters = root.querySelector('#filter-sort').removeWhitespace()
                .childNodes.map(f => ({
                    text: f.rawText,
                    value: f.attributes.value,
                }))
            const all = root.querySelectorAll('.project-list-item').map((item) => {
                item = item.removeWhitespace();
                const noText = n => !(n instanceof parser.TextNode)
                const [avatar, details] = item.childNodes
                let icon
                try {
                    icon = avatar.firstChild.firstChild.attributes.src
                } catch (e) {
                    icon = ''
                }
                const path = avatar.firstChild.attributes.href;
                let [name, status, categories, description] = details.childNodes;
                const author = name.lastChild.lastChild.firstChild.rawText
                name = name.firstChild.firstChild.rawText
                const count = status.firstChild.firstChild.rawText
                const date = localDate(status.lastChild.firstChild.attributes['data-epoch']);
                status = {}
                description = description.firstChild.rawText;
                categories = categories.firstChild.childNodes.map((ico) => {
                    const ca = {
                        href: ico.firstChild.attributes.href,
                        icon: ico.firstChild.firstChild.attributes.src,
                    }
                    return ca
                })
                return {
                    path: path.substring(path.lastIndexOf('/') + 1), name, author, description, date, count, categories, icon,
                };
            })

            return {
                mods: all,
                pages,
                versions,
                filters,
            }
        },
    },
}
