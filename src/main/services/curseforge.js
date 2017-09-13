import { net } from 'electron'
import querystring from 'querystring'
import parser from 'fast-html-parser'

export default {
    initialize() {
    },
    actions: {
        async mods({ page, sort, version } = {}) {
            const endpoint = `https://minecraft.curseforge.com/mc-mods?${querystring.stringify({
                page: page || '',
                'filter-sort': sort || 'popularity',
                'filter-game-version': version || '',
            })}`
            let s = ''
            await new Promise((resolve, reject) => {
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
            const root = parser.parse(s.replace(/\r\n/g, ''));
            const pages = root.querySelectorAll('.b-pagination-item')
                .map(pageItem => pageItem.firstChild.rawText)
                .map(text => Number.parseInt(text, 10))
                .filter(n => Number.isInteger(n))
                .reduce((a, b) => (a > b ? a : b))
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
                    path, name, author, description, date, count, categories, icon,
                };
            })

            return {
                mods: all,
                pages,
            }
        },
    },
}
