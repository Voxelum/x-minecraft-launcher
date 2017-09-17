// const parser = require('fast-html-parser')
// const querystring = require('querystring')

// function convert(node) {
//     let text = '';
//     if (node instanceof parser.TextNode) {
//         text += node.rawText;
//     } else if (node instanceof parser.HTMLElement) {
//         if (node.tagName !== null) {
//             if (node.tagName === 'a') {
//                 let attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
//                 if (node.attributes.href) {
//                     const href = node.attributes.href;
//                     const newHref = href.substring(href.indexOf('remoteUrl=') + 'remoteUrl='.length)
//                     attrs = querystring.unescape(querystring.unescape(attrs.replace(href, newHref)))
//                 }
//                 text += `<${node.tagName}${attrs}>`
//             } else {
//                 const attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
//                 text += `<${node.tagName}${attrs}>`
//             }
//         }
//         if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c)
//         if (node.tagName !== null) text += `</${node.tagName}>`
//     } else throw new Error('Unsupported type');
//     return text
// }

// const parsed = parser.parse(`<a href="/linkout?remoteUrl=http%253a%252f%252fjourneymap.info%252f">
// </a>`)
// console.log(parsed)
// console.log()
// console.log(convert(parsed))
// // let s = '/linkout?remoteUrl=http%253a%252f%252fjourneymap.info%252f'
// // const idx = s.indexOf('remoteUrl=') + 'remoteUrl='.length
// // s = s.substring(idx)
// // console.log(s)
