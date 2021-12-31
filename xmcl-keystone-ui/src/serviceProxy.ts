import { computed, InjectionKey, reactive, ref, Ref } from '@vue/composition-api'
import { BaseServiceKey, BaseServiceMethods, BaseState, CurseForgeServiceKey, CurseForgeServiceMethods, CurseforgeState, DiagnoseServiceKey, DiagnoseServiceMethods, DiagnoseState, ImportServiceKey, ImportServiceMethods, InstallServiceKey, InstallServiceMethods, InstallState, InstanceCurseforgeIOServiceKey, InstanceCurseforgeIOServiceMethods, InstanceIOServiceKey, InstanceIOServiceMethods, InstanceJavaServiceKey, InstanceJavaServiceMethods, InstanceJavaState, InstanceLogServiceKey, InstanceLogServiceMethods, InstanceModsServiceKey, InstanceModsServiceMethods, InstanceModsState, InstanceOptionsServiceKey, InstanceOptionsServiceMethods, InstanceOptionsState, InstanceResourcePacksServiceKey, InstanceResourcePacksServiceMethods, InstanceSavesServiceKey, InstanceSavesServiceMethods, InstanceServerInfoServiceKey, InstanceServerInfoServiceMethods, InstanceServiceKey, InstanceServiceMethods, InstanceShaderPacksServiceKey, InstanceShaderPacksServiceTemplate, InstanceState, InstanceVersionServiceKey, InstanceVersionServiceMethods, InstanceVersionState, JavaServiceKey, JavaServiceMethods, JavaState, LaunchServiceKey, LaunchServiceMethods, LaunchState, ResourceServiceKey, ResourceServiceMethods, ResourceState, SaveState, ServerInfoState, ServerStatusServiceKey, ServerStatusServiceMethods, State, UserServiceKey, UserServiceMethods, UserState, VersionServiceKey, VersionServiceMethods, VersionState } from '@xmcl/runtime-api'
import { Store } from 'vuex'
import { createServiceFactory as _createServiceFactory, ServiceFactory } from './serviceFactory'

const TasksContainer = Symbol('TaskContainer')

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
  return Reflect.get(promise, TasksContainer)
}

const ACESSOR_SYMBOLS = Symbol('Acessor')

function createStoreAccessor(store: Store<any>, symb: VuexModuleTemplateSymbols) {
  const acessor: any = {}
  Object.defineProperty(acessor, ACESSOR_SYMBOLS, { value: symb })
  for (const [key] of symb.state) {
    acessor[key] = computed(() => (store as any).state[`services/${symb.name}`][key])
  }
  for (const [key] of symb.getters) {
    acessor[key] = computed(() => store.getters[key])
  }
  for (const [key] of symb.mutations) {
    acessor[key] = (payload: any) => {
      serviceChannel.commit(key, payload)
    }
  }
  return acessor
}

interface VuexModuleTemplateSymbols {
  name: string
  state: [string, any][]
  getters: [string, () => any][]
  mutations: [string, (payload: any) => void][]
  accessor: [string, any][]
}

function createGetterAcessor(symb: VuexModuleTemplateSymbols, state: any, getters: any, rootState: any, rootGetters: any, external: boolean) {
  const accessor = {} as any
  if (!external) {
    for (const [key] of symb.state) {
      Object.defineProperty(accessor, key, { get() { return state[key] } })
    }
    for (const [key] of symb.getters) {
      Object.defineProperty(accessor, key, { get() { return getters[key] } })
    }
  } else {
    for (const [key] of symb.state) {
      Object.defineProperty(accessor, key, { get() { return rootState[`services/${symb.name}`][key] } })
    }
    for (const [key] of symb.getters) {
      Object.defineProperty(accessor, key, { get() { return rootGetters[key] } })
    }
  }
  for (const [key, acc] of symb.accessor) {
    accessor[key] = createGetterAcessor(acc[ACESSOR_SYMBOLS], state, getters, rootState, rootGetters, true)
  }
  return accessor
}

function createStoreTemplate(symb: VuexModuleTemplateSymbols) {
  const state = {} as any
  const mutations = {
    sync(state: any, payload: any) {
      if (payload[symb.name]) {
        for (const [k, v] of Object.entries(payload[symb.name])) {
          state[k] = v
        }
      }
    },
  } as any
  const getters = {} as any
  for (const [key, val] of symb.state) {
    state[key] = val
  }
  for (const [key, get] of symb.getters) {
    getters[key] = (state: any, getters: any, rootState: any, rootGetters: any) => get.call(createGetterAcessor(symb, state, getters, rootState, rootGetters, false))
  }
  for (const [key, mut] of symb.mutations) {
    mutations[key] = (state: any, payload: any) => mut.call(state, payload)
  }

  return {
    state,
    getters,
    mutations,
  }
}

function getStoreTemplateSymbol(name: string, stateTemplate: State<any>) {
  function extractSymbol(o: object, s: VuexModuleTemplateSymbols) {
    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
      if (typeof prop.value !== 'undefined') {
        const val = prop.value
        if (val instanceof Function) {
          if (key !== 'constructor') {
            // mutation
            s.mutations.push([key, val])
          }
        } else {
          if (val && (val[ACESSOR_SYMBOLS])) {
            s.accessor.push([key, val])
          } else {
            // state
            s.state.push([key, val])
          }
        }
      } else if (prop.get) {
        // getters
        s.getters.push([key, prop.get])
      }
    }
  }

  const symb: VuexModuleTemplateSymbols = {
    name,
    state: [],
    getters: [],
    mutations: [],
    accessor: [],
  }
  extractSymbol(stateTemplate, symb)
  extractSymbol(Object.getPrototypeOf(stateTemplate), symb)

  return symb
}

export const SERVICES_KEY: InjectionKey<ServiceFactory> = Symbol('SERVICES_KEY')

export function createServiceFactory(store: Store<any>) {
  const factory = _createServiceFactory({
    decoareteState(service, state) {
      const symbols = getStoreTemplateSymbol(service.toString(), state)
      const accessor = createStoreAccessor(store, symbols)
      const template = createStoreTemplate(symbols)
      store.registerModule(`services/${service.toString()}`, template)
      return reactive(accessor)
    },
    taskListener(_, __, p: any, ___, id) {
      if (!(p)[TasksContainer]) {
        Object.defineProperty(p, TasksContainer, { value: ref([]), enumerable: false, writable: false, configurable: false })
      }
      p[TasksContainer].value.push(id)
    },
  })

  factory.register(ImportServiceKey, ImportServiceMethods, [], () => undefined)
  factory.register(InstanceIOServiceKey, InstanceIOServiceMethods, [], () => undefined)
  factory.register(ServerStatusServiceKey, ServerStatusServiceMethods, [], () => undefined)
  factory.register(InstanceLogServiceKey, InstanceLogServiceMethods, [], () => undefined)
  factory.register(InstanceCurseforgeIOServiceKey, InstanceCurseforgeIOServiceMethods, [], () => undefined)
  factory.register(InstanceResourcePacksServiceKey, InstanceResourcePacksServiceMethods, [], () => undefined)
  factory.register(InstanceShaderPacksServiceKey, InstanceShaderPacksServiceTemplate, [], () => undefined)

  factory.register(BaseServiceKey, BaseServiceMethods, [], () => new BaseState())
  factory.register(DiagnoseServiceKey, DiagnoseServiceMethods, [], () => new DiagnoseState())
  factory.register(InstanceOptionsServiceKey, InstanceOptionsServiceMethods, [], () => new InstanceOptionsState())
  factory.register(InstallServiceKey, InstallServiceMethods, [], () => new InstallState())
  factory.register(InstanceModsServiceKey, InstanceModsServiceMethods, [], () => new InstanceModsState())
  factory.register(InstanceSavesServiceKey, InstanceSavesServiceMethods, [], () => new SaveState())
  factory.register(InstanceServerInfoServiceKey, InstanceServerInfoServiceMethods, [], () => new ServerInfoState())
  factory.register(InstanceServiceKey, InstanceServiceMethods, [], () => new InstanceState())
  factory.register(JavaServiceKey, JavaServiceMethods, [], () => new JavaState())
  factory.register(VersionServiceKey, VersionServiceMethods, [], () => new VersionState())
  factory.register(InstanceJavaServiceKey, InstanceJavaServiceMethods, [InstanceServiceKey, JavaServiceKey], (i, j) => new InstanceJavaState(i, j))
  factory.register(InstanceVersionServiceKey, InstanceVersionServiceMethods, [InstanceServiceKey, VersionServiceKey], (i, v) => new InstanceVersionState(i, v))
  factory.register(LaunchServiceKey, LaunchServiceMethods, [], () => new LaunchState())
  factory.register(ResourceServiceKey, ResourceServiceMethods, [], () => new ResourceState())
  factory.register(CurseForgeServiceKey, CurseForgeServiceMethods, [ResourceServiceKey], (res) => new CurseforgeState(res))
  factory.register(UserServiceKey, UserServiceMethods, [], () => new UserState())

  return factory
}
