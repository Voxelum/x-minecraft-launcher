const { dialog, shell } = require('electron').remote
const { clipboard, ipcRenderer } = require('electron')

window.electron = {
    shell,
    dialog,
    clipboard,
    ipcRenderer,
}

