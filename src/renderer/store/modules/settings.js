import { ipcRenderer } from 'electron'

export default {
    state: {
        theme: 'semantic',
        themes: [],
        defaultResolution: { width: 400, height: 400, fullscreen: false },  
    },
    getters: {
        themes: state => state.themes,
        theme: state => state.theme,
    },
    mutations: {
        resolution: (state, resolution) => {
            state.resolution = resolution;
        },
    },
    actions: {
        /**
        * 
        * @param {ActionContext} context 
        * @param {{resolution?:{width:number,height:number,fullscreen?:boolean}, location?:string, theme?:string}} payload 
        */
        updateSetting(context, payload) {
            if (payload.resolution) {
                context.commit('resolution', payload.resolution);
            }
            if (payload.location !== context.state.root ||
                payload.theme !== context.state.theme) {
                ipcRenderer.send('update', payload.location, payload.theme)
            }
        },
    },
}
