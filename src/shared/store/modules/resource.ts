import { ModuleOption } from '../root'
import { AnyPersistedResource, NO_RESOURCE, PersistedCurseforgeModpackResource, PersistedFabricResource, PersistedForgeResource, PersistedLiteloaderResource, PersistedModpackResource, PersistedResource, PersistedResourcePackResource, PersistedSaveResource, PersistedUnknownResource } from '/@shared/entities/resource'
import { ResourceDomain } from '/@shared/entities/resource.schema'
import { requireString } from '/@shared/util/assert'

interface State {
  mods: Array<PersistedForgeResource | PersistedLiteloaderResource | PersistedFabricResource>
  resourcepacks: Array<PersistedResourcePackResource>
  saves: Array<PersistedSaveResource>
  modpacks: Array<PersistedModpackResource | PersistedCurseforgeModpackResource>
  unknowns: Array<PersistedUnknownResource>
}

interface Getters {
  /**
   * Query local resource by uri
   * @param uri The uri
   */
  queryResource(uri: string): AnyPersistedResource | undefined
}

export interface Mutations {
  resource: AnyPersistedResource
  resources: AnyPersistedResource[]
  resourcesRemove: AnyPersistedResource[]
}

export type ResourceModule = ModuleOption<State, Getters, Mutations, {}>

const mod: ResourceModule = {
  state: {
    mods: [],
    resourcepacks: [],
    saves: [],
    modpacks: [],
    unknowns: [],
  },
  getters: {
    queryResource: state => (url) => {
      requireString(url)
      for (const domain of Object.keys(state)) {
        const resources = state[domain as ResourceDomain]
        for (const v of resources) {
          const uris = v.uri
          if (uris.some(u => u === url)) {
            return v
          }
        }
      }
      return undefined
    },
  },
  mutations: {
    resource: (state, res) => {
      if (res.domain in state) {
        const domain = state[res.domain]
        domain.push(Object.freeze(res) as any)
      } else {
        throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`)
      }
    },
    resources: (state, all) => {
      for (const res of all) {
        if (res.domain in state) {
          const domain = state[res.domain]
          domain.push(Object.freeze(res) as any)
        } else {
          throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`)
        }
      }
    },
    resourcesRemove(state, resources) {
      const removal = new Set(resources.map((r) => r.hash))
      const domains = new Set(resources.map((r) => r.domain))
      for (const domain of domains) {
        state[domain] = (state[domain] as PersistedResource[]).filter((r) => !removal.has(r.hash)) as any
      }
    },
  },
}

export default mod
