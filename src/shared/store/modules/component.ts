import { Component } from '/@shared/entities/compenent'
import { Mutations as ResourceMutations } from './resource'
import { Mutations as VersionMutations } from './version'
import { ModuleOption } from '../root'

interface State {
  components: Component[]
}

interface Mutations extends ResourceMutations, Pick<VersionMutations, 'localVersions' | 'localVersion' | 'localVersionRemove'> {
}

export type ComponentModule = ModuleOption<State, {}, Mutations, {}>

const mod: ComponentModule = {
  state: {
    components: [],
  },
  // mutations: {
  // },
}
