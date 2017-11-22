import {
    net, app,
} from 'electron'
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

/**
 * 
 * @param {parser.Node} n 
 */
function parseFrame(n) {
    const block = n.firstChild;
    const items = n.lastChild;
    return {
        image: block.firstChild.firstChild.attributes.src,
        url: block.firstChild.attributes.href,
        title: block.firstChild.attributes.title,
        view: block.lastChild.lastChild.firstChild.attributes.title,
        likes: block.lastChild.lastChild.childNodes[1].attributes.title,
        favor: block.lastChild.lastChild.childNodes[2].attributes.title,
        items: items.firstChild.classNames[0] === 'noitems' ? [] : items.childNodes.map(c => ({
            id: c.attributes.iid,
            url: c.childNodes[1].attributes.href,
            image: c.childNodes[1].firstChild.attributes.src,
        })),
    }
}

/**
 * 
 * @param {parser.HTMLElement} root 
 */
function parseAllClass(root) {
    return root.querySelectorAll('.class_block').map(node => node.removeWhitespace())
        .filter(node => node.childNodes.length === 2
            && node.firstChild.classNames[0] === 'left'
            && node.lastChild.classNames[0] === 'right'
            && node.firstChild.firstChild.firstChild.classNames[1] !== 'today')
        .map((node) => {
            const left = node.firstChild;
            const right = node.lastChild;
            const titleDetail = left.firstChild.firstChild;
            return {
                title: titleDetail.lastChild.text,
                url: titleDetail.lastChild.attributes.href,
                description: titleDetail.attributes.title,
                list: left.lastChild.childNodes.map(parseFrame),
            }
        });
}

function parseNews(root) {
    const news = root.querySelector('.news_block').removeWhitespace();
    const newsMods = news.childNodes[1].childNodes.map((node) => {
        if (node.childNodes.length === 2) {
            return {
                image: node.childNodes[0].childNodes[0].attributes.src,
                url: node.childNodes[0].attributes.href,
                title: node.childNodes[0].attributes.title,
            }
        }
        return {
            image: node.childNodes[1].childNodes[0].attributes.src,
            url: node.childNodes[1].attributes.href,
            title: node.childNodes[1].attributes.title,
        }
    })
    return newsMods;
}


export default {
    initialize() {
        
    },
    proxy: {},
    actions: {
        async fetchDetail(context, url) {
            console.log(url)
            const pageCont = parser.parse(await request(url)).removeWhitespace()
            const infoBlock = pageCont.querySelector('.InfoBlock')
            const title = pageCont.querySelector('.title')
            const modimg = pageCont.querySelector('.class_modimg')
            const classEx = pageCont.querySelector('.class_ex')
            const modDescription = pageCont.querySelector('.right_inside')
            return {
                title: title.childNodes[1].text,
                subTitle: title.childNodes[2].text,
                likes: title.childNodes[3].childNodes[0].lastChild.text,
                popularity: classEx.childNodes[0].childNodes[0].childNodes[0].text,
                popularityType: classEx.childNodes[0].childNodes[0].childNodes[1].text,
                lastDayCount: classEx.childNodes[0].childNodes[2].text,
                averageCount: classEx.childNodes[0].childNodes[3].text,
                browseCount: classEx.childNodes[1].childNodes[0].childNodes[0].text,
                recommendCount: classEx.childNodes[1].childNodes[1].childNodes[0].text,
                image: modimg.attributes.src,
                modType: infoBlock.childNodes[0].lastChild.text,
                recordTime: infoBlock.childNodes[1].text,
                author: infoBlock.childNodes[2].text,
                lastModifiedTime: infoBlock.childNodes[3].text,
                mod: infoBlock.childNodes[4].text,
                lastRecommendTime: infoBlock.childNodes[5].text,
                modifyCount: infoBlock.childNodes[6].text.replace('\r\n', '').replace(/ /g, ''),
                relevantLink: infoBlock.childNodes[7].childNodes[1]
                    .childNodes[1].childNodes[0].lastChild.text,
                modDescription: modDescription.childNodes[0].childNodes[0]
                    .childNodes[0].childNodes[0].text,
            }
        },
        async fetchAll() {
            const s = await request('http://www.mcmod.cn')
            const root = parser.parse(s);
            const content = parseAllClass(root);
            const news = parseNews(root);
            return { news, content }
        },
        async fetchRandom() {
            const randomSection = parser.parse(await new Promise((resolve, reject) => {
                let s = ''
                const req = net.request({
                    method: 'POST',
                    url: 'http://www.mcmod.cn/ajax/index/ajax___index_random.php',
                })
                req.on('response', (msg) => {
                    msg.on('data', (b) => { s += b.toString() })
                    msg.on('end', () => {
                        resolve(s)
                    })
                })
                req.on('error', e => reject(e))
                req.setHeader('Host', 'www.mcmod.cn')
                req.setHeader('Origin', 'http://www.mcmod.cn')
                req.setHeader('Referer', 'http://www.mcmod.cn/')
                req.end()
            })).removeWhitespace();
            return randomSection.childNodes.map(parseFrame);
        },
    },
}
