import { ResolvedVersion } from '@xmcl/core'
import { ModuleOption } from '../root'
import { DEFAULT_PROFILE, Instance } from '/@shared/entities/instance'
import { InstanceSchema } from '/@shared/entities/instance.schema'
import { JavaRecord } from '/@shared/entities/java'
import { ServerStatus, UNKNOWN_STATUS } from '/@shared/entities/serverStatus'
import { getResolvedVersion } from '/@shared/entities/version'
import { remove, set } from '/@shared/util/middleware'
import { DeepPartial } from '/@shared/util/object'

interface State {
  /**
   * All loaded launch instances
   */
  all: { [path: string]: Instance }
  /**
   * Current selected path
   */
  path: string
}

interface Getters {
  /**
   * All selected instances.
   */
  instances: Instance[]
  /**
   * The selected instance config.
   */
  instance: Instance
  /**
   * The selected instance mapped local version.
   * If there is no local version matced, it will return a local version with id equal to `""`.
   */
  instanceVersion: ResolvedVersion
  /**
   * The selected instance mapped local java.
   * If there is no matching java for current instance, it will return the `DEFAULT_JAVA`
   * which contains the `majorVersion` equal to 0
   */
  instanceJava: JavaRecord
  /**
   * The selected instance mapped minecraft server protocol version.
   * This is determined by the minecraft version of it.
   */
  instanceProtocolVersion: number
}

interface Mutations {
  instanceAdd: InstanceSchema & { path: string }
  instanceRemove: string
  instanceSelect: string

  /**
   * Edit the profile content. This commit will trigger save function to store the data to the disk.
   * Don't use this directly. Use `editProfile` action
   * @param payload The modified data
   */
  instance: DeepPartial<InstanceSchema> & { path: string }

  // non-persistence mutation below, just update cache, nothing saved

  instanceStatus: ServerStatus
  instancesStatus: { [path: string]: ServerStatus }
}

export type InstanceModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceModule = {
  state: {
    all: {},
    path: '',
  },
  getters: {
    instances: state => Object.keys(state.all).map(k => state.all[k]),
    instanceProtocolVersion: () => 338,
    instance: state => state.all[state.path] || DEFAULT_PROFILE,
    instanceVersion: (state, getters, rootState) => {
      const current = state.all[state.path] || DEFAULT_PROFILE
      return getResolvedVersion(rootState.version.local, current.runtime, current.version)
    },
    instanceJava: (state, getters, rootState, rootGetter) => {
      const javaPath = getters.instance.java
      if (javaPath && javaPath !== '') {
        return rootState.java.all.find(j => j.path === javaPath) || {
          path: javaPath,
          version: '',
          majorVersion: 0,
          valid: false,
        }
      }
      return rootGetter.defaultJava
    },
  },
  mutations: {
    instanceAdd(state, instance) {
      /**
       * Prevent the case that hot reload keep the vuex state
       */
      if (!state.all[instance.path]) {
        // TODO: remove in vue3
        set(state.all, instance.path, { ...instance, serverStatus: UNKNOWN_STATUS })
        state.all[instance.path] = { ...instance, serverStatus: UNKNOWN_STATUS }
      }
    },
    instanceRemove(state, id) {
      // TODO: remove in vue3
      remove(state.all, id)
      delete state.all[id]
    },
    instanceSelect(state, id) {
      if (state.all[id]) {
        state.path = id
      } else if (state.path === '') {
        state.path = Object.keys(state.all)[0]
      }
      state.all[state.path].lastAccessDate = Date.now()
    },
    instance(state, settings) {
      const inst = state.all[settings.path || state.path]

      if (!inst) {
        console.error(`Cannot commit profile. Illegal State with missing profile ${state.path}`)
        return
      }

      inst.name = typeof settings.name === 'string' ? settings.name : inst.name

      inst.author = settings.author || inst.author
      inst.description = settings.description || inst.description
      inst.version = typeof settings.version === 'string' ? settings.version : inst.version

      if (settings.server) {
        if (inst.server) {
          inst.server.host = settings.server.host || inst.server.host
          inst.server.port = settings.server.port || inst.server.port
        } else {
          inst.server = {
            host: settings.server.host,
            port: settings.server.port,
          }
        }
      }

      if (settings.runtime) {
        const versions = settings.runtime
        if (inst.runtime.minecraft !== settings.runtime.minecraft && typeof versions.minecraft === 'string') {
          // if minecraft version changed, all other related versions are rest.
          inst.runtime.minecraft = versions.minecraft
          for (const versionType of Object.keys(inst.runtime).filter(v => v !== 'minecraft')) {
            inst.runtime[versionType] = ''
          }
        }

        for (const versionType of Object.keys(versions).filter(v => v !== 'minecraft')) {
          const ver = versions[versionType]
          if (typeof ver === 'string') {
            inst.runtime[versionType] = ver
          }
        }
      }

      if ('minMemory' in settings) {
        inst.minMemory = (typeof settings.minMemory === 'number') && settings.minMemory > 0 ? settings.minMemory : 0
      }
      if ('maxMemory' in settings) {
        inst.maxMemory = (typeof settings.maxMemory === 'number') && settings.maxMemory > 0 ? settings.maxMemory : 0
      }

      if (settings.vmOptions instanceof Array && settings.vmOptions.every(r => typeof r === 'string')) {
        inst.vmOptions = Object.seal(settings.vmOptions)
      }
      if (settings.mcOptions instanceof Array && settings.mcOptions.every(r => typeof r === 'string')) {
        inst.mcOptions = Object.seal(settings.mcOptions)
      }

      inst.url = settings.url || inst.url
      inst.icon = settings.icon || inst.icon
      inst.java = settings.java || inst.java

      if (typeof settings.showLog === 'boolean') {
        inst.showLog = settings.showLog
      }
      if (typeof settings.hideLauncher === 'boolean') {
        inst.hideLauncher = settings.hideLauncher
      }
    },
    instanceStatus(state, status) {
      state.all[state.path].serverStatus = status
    },
    instancesStatus(state, statues) {
      for (const [path, stat] of Object.entries(statues)) {
        state.all[path].serverStatus = stat
      }
    },
  },
}

export default mod
