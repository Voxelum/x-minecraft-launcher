import { ModuleOption } from '../root'
import { HMCLServerManagedModpack } from '/@shared/entities/hmclModpack'

interface State {
  current: HMCLServerManagedModpack | undefined
  pending: HMCLServerManagedModpack | undefined
}

interface Getters {
}

interface Mutations {
  hmclModpackSet: HMCLServerManagedModpack
  hmclModpackPending: HMCLServerManagedModpack
}

export type InstanceHMCLModpackModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceHMCLModpackModule = {
  state: {
    current: undefined,
    pending: undefined,
  },
  getters: {
  },
  mutations: {
    hmclModpackSet(state, modpack) {
      state.current = modpack
    },
    hmclModpackPending(state, modpack) {
      state.pending = modpack
    },
  },
}

export default mod
