import { ipcRenderer } from 'electron'

class VirtualFs {
    constructor(files = {}) {
        this.files = files;
    }
    pack(path, data) {
        if (typeof data === 'object') data = JSON.stringify(data);
        this.files[path] = data;
        ipcRenderer.send('fs-put', path, data);
    }
    has(path) {
        return this.files[path] !== undefined;
    }
    get(path, fallback) {
        if (this.has(path)) {
            return this.files[path];
        }
        return fallback;
    }
}
