
import { ActionContext } from 'vuex'
import { MinecraftFolder } from 'ts-minecraft'
import { remote, ipcRenderer } from 'electron'
import paths from 'path'
import { v4 } from 'uuid'

export default {
    exit() { ipcRenderer.sendSync('exit') },
    /**
     * 
     * @param {ActionContext} context 
     * @param {} payload 
     * @return {Promise<string[]>}
     */
    openDialog(context, payload) {
        return new Promise((resolve, reject) => {
            remote.dialog.showOpenDialog(
                remote.BrowserWindow.getFocusedWindow(),
                payload,
                (files) => {
                    files = files || [];
                    resolve(files)
                })
        });
    },
    saveDialog(context, payload) {
        return new Promise((resolve, reject) => {
            remote.dialog.showSaveDialog(
                remote.BrowserWindow.getFocusedWindow(),
                payload,
                (file) => {
                    file = file || '';
                    resolve(file)
                })
        })
    },
    /**
     * @typedef {Object} Resolution
     * @property {number} width
     * @property {number} height 
     * @property {boolean=} fullscreen 
     */

    /**
       * 
       * @param {ActionContext} context 
       * @param {{resolution?:Resolution, location?:string, theme?:string}} payload 
       */
    updateSetting(context, payload) {
        // if (payload.resolution) {
        //     context.commit('resolution', payload.resolution);
        // }
    },
}
