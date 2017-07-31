import { TextComponent } from 'ts-minecraft'

import profile from './profile'

function state() {
    const theState = profile.state()

    theState.type = 'server'
    theState.host = ''
    theState.port = ''
    theState.isLanServer = false
    theState.icon = ''
    return theState
}
/* eslint-disable no-unused-vars */
const getters = {
    // Use mapState
}

const mutations = profile.mutations

const actions = {
    save() {

    },
    load() { },
    ping(context, payload) {
        return context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((status) => {
                context.commit('putAll', {
                    icon: status.icon,
                })
                console.log('incomming')
                if (status.gameVersion.text && status.gameVersion._siblings) { 
                    console.log('converting ver')
                    const str = TextComponent.str(status.gameVersion.text)
                    str._siblings = status.gameVersion._siblings;
                    status.gameVersion = str;
                }
                if (status.serverMOTD.text && status.serverMOTD._siblings) {
                    console.log('converting motd')
                    const str = TextComponent.str(status.serverMOTD.text)
                    str._siblings = status.serverMOTD._siblings;
                    status.serverMOTD = str;
                }
                return status
            })
    },
}
export default {
    state,
    getters,
    mutations,
    actions,
}
