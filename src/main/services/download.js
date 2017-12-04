import { WebContents, BrowserWindow, app } from 'electron'
import paths from 'path'
import { v4 } from 'uuid'
import { EventEmitter } from 'events'

class DownloadTask extends EventEmitter {
    constructor(id, url, file, source) {
        super();
        this.id = id;
        this.url = url;
        this.source = source;
        this.file = file;
    }
    execute(context) {
        return new Promise((resolve, reject) => {
            this.source.session.once('will-download', (event, item, content) => {
                // if (item.getURL() !== this.url) throw new Error(`Unmatched url: ${item.getURL()} : ${this.url}`)
                const savePath = paths.join(app.getPath('userData'), 'temps', item.getFilename());
                if (!this.file) item.setSavePath(savePath)
                item.on('updated', ($event, state) => {
                    this.emit('update', {
                        status: state,
                        progress: item.getReceivedBytes(),
                        total: item.getTotalBytes(),
                    })
                })
                item.on('done', ($event, state) => {
                    switch (state) {
                        case 'completed':
                            resolve(savePath)
                            break;
                        case 'cancelled':
                        case 'interrupted':
                        default: 
                            reject(new Error(state))
                            break;
                    }
                })
            })
            this.source.downloadURL(this.url);
        })
    }
}

export default {
    initialize() {
    },
    proxy() { },
    actions: {
        /**
         * @param {ServiceContext} context 
         * @param {{url:string, path?:string}} payload 
         */
        download(context, payload) {
            console.log(payload)
            return new DownloadTask(`download ${payload.url}`, payload.url, payload.path, context.source);
        },
    },
}
