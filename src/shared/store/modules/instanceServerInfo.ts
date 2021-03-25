import { ServerInfo } from '@xmcl/server-info'
import { ModuleOption } from '../root'

interface State {
  /**
   * Cache loaded server info in servers.dat
   */
  serverInfos: ServerInfo[]
}

interface Getters {
}

interface Mutations {
  /**
   * Update server infos in server.dat
   * @param infos The new server infos
   */
  instanceServerInfos: ServerInfo[]
  instanceServerInfosLoad: ServerInfo[]
}

export type InstanceServerInfoModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceServerInfoModule = {
  state: {
    serverInfos: [],
  },
  getters: {
  },
  mutations: {
    instanceServerInfos(state, infos) {
      state.serverInfos = infos
    },
    instanceServerInfosLoad(state, cache) {
      state.serverInfos = [...cache]
    },
  },
}

export default mod
