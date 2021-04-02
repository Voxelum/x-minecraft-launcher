import { ModuleOption } from '../root'
import { AnyResource } from '/@shared/entities/resource'

interface State {
  /**
   * The instance mods
   */
  mods: AnyResource[]
  /**
   * The instance resourcepacks
   */
  resourcepacks: AnyResource[]
}

interface Getters {
}

export interface Mutations {
  instanceMods: AnyResource[]
  instanceModAdd: AnyResource[]
  instanceModRemove: AnyResource[]

  instanceResourcepacks: AnyResource[]
  instanceResourcepackAdd: AnyResource[]
  instanceResourcepackRemove: AnyResource[]
}

export type InstanceResourceModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceResourceModule = {
  state: {
    mods: [],
    resourcepacks: [],
  },
  getters: {
  },
  mutations: {
    instanceModAdd(state, r) {
      state.mods.push(...r)
    },
    instanceModRemove(state, mods) {
      const toRemoved = new Set(mods.map(p => p.hash))
      state.mods = state.mods.filter(m => !toRemoved.has(m.hash))
    },
    instanceMods(state, resources) {
      state.mods = resources
    },
    instanceResourcepackAdd(state, r) {
      state.resourcepacks.push(...r)
    },
    instanceResourcepackRemove(state, packs) {
      const toRemoved = new Set(packs.map(p => p.hash))
      state.resourcepacks = state.resourcepacks.filter(p => !toRemoved.has(p.hash))
    },
    instanceResourcepacks(state, resources) {
      state.resourcepacks = resources
    },
  },
}

export default mod
