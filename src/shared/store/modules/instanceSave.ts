import { ModuleOption } from '../root'
import { InstanceSaveMetadata } from '/@shared/entities/save'

interface State {
  saves: InstanceSaveMetadata[]
}

interface Getters {
}

interface Mutations {
  instanceSaves: InstanceSaveMetadata[]
  instanceSaveAdd: InstanceSaveMetadata
  instanceSaveRemove: string
}

export type InstanceSaveModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceSaveModule = {
  state: {
    saves: [],
  },
  getters: {
  },
  mutations: {
    instanceSaves(state, saves) {
      state.saves = saves
    },
    instanceSaveAdd(state, save) {
      state.saves.push(save)
    },
    instanceSaveRemove(state, save) {
      state.saves = state.saves.filter((s) => s.path !== save)
    },
  },
}

export default mod
