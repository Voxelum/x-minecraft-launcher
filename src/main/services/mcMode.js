// import {
//     net,
// } from 'electron'
// import querystring from 'querystring'
// import parser from 'fast-html-parser'

const {
    net,
} = require('electron')
const http = require('http')

function request(end) {
    return new Promise((resol, rej) => {
        let str = ''
        http.get(end, ((res) => {
            res.on('data', (s) => {
                str += s.toString();
            })
            res.on('end', () => {
                resol(str)
            })
        }))
    })
}

// function request(endpoint) {
//     return new Promise((resolve, reject) => {
//         let s = ''
//         const req = net.request(endpoint)
//         req.on('response', (msg) => {
//             msg.on('data', (b) => {
//                 s += b.toString()
//             })
//             msg.on('end', () => {
//                 resolve(s)
//             })
//         })
//         req.on('error', e => reject(e))
//         req.end()
//     });
// }

// export default {
//     initialize() {},
//     actions: {

//         license() {
//             const string = request('http://www.mcmod.cn/').then(s => {
//                 console.log(s);
//             });
//         },

//     }
// }

const string = request('http://www.mcmod.cn/').then(s => {
    console.log(s);
});
