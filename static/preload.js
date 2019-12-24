const { dialog } = require('electron').remote;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clipboard, ipcRenderer } = require('electron');

window.electron = {
    dialog,
    clipboard,
    ipcRenderer,
};
