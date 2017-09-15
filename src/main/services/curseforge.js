import { net } from 'electron'
import querystring from 'querystring'
import parser from 'fast-html-parser'

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
    let text = '';
    if (node instanceof parser.TextNode) {
        text += node.rawText;
    } else if (node instanceof parser.HTMLElement) {
        const attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
        if (node.tagName !== null) text += `<${node.tagName}${attrs}>`
        if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c)
        if (node.tagName !== null) text += `</${node.tagName}>`
    } else throw new Error('Unsupported type');
    return text
}

export default {
    initialize() {
    },
    actions: {
        async project(path) {
            const root = parser.parse(await request(`https://minecraft.curseforge.com${path}`));
            const descontent = root.querySelector('.project-description')
            const description = convert(descontent)

            const filespage = parser.parse(await request(`https://minecraft.curseforge.com${path}/files`))
            const files = filespage.querySelectorAll('.project-file-list-item')
                .map((i) => {
                    i = i.removeWhitespace();
                    return {
                        type: i.firstChild.attributes.title,
                        href: i.childNodes[1].firstChild.firstChild.firstChild.attributes.href,
                        size: i.childNodes[2].rawText,
                        date: i.childNodes[3].firstChild.attributes['data-epoch'],
                        downloadCount: i.childNodes[5].rawText,
                    }
                })
            return {
                description,
                files,
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
                .childNodes.map((ver) => {
                    return {
                        type: ver.attributes.class,
                        text: ver.rawText,
                        value: ver.attributes.value,
                    };
                })
            const filters = root.querySelector('#filter-sort').removeWhitespace()
                .childNodes.map((f) => {
                    return {
                        text: f.rawText,
                        value: f.attributes.value,
                    }
                })
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
                const date = status.lastChild.firstChild.attributes['data-epoch'];
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
