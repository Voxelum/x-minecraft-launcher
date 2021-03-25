import { Component } from '/@shared/entities/compenent'
import { Mutations as ResourceMutations } from './resource'
import { Mutations as InstanceResourceMutations } from './instanceResource'
import { Mutations as VersionMutations } from './version'
import { ModuleOption } from '../root'

interface State {
  /**
   * The component activated for the instance
   */
  components: Component[]
}

interface Mutations extends InstanceResourceMutations {
}

export type InstanceComponentModule = ModuleOption<State, {}, Mutations, {}>

const mod: InstanceComponentModule = {
  state: {
    components: [],
  },
  mutations: {
    instanceModAdd(state, r) {
    },
    instanceModRemove(state, mods) {
    },
    instanceMods(state, resources) {
    },
    instanceResourcepackAdd(state, r) {
    },
    instanceResourcepackRemove(state, packs) {
    },
    instanceResourcepacks(state, resources) {
    },
  },
}
