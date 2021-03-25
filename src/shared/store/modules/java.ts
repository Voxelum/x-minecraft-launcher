import { EMPTY_JAVA, JavaRecord } from '/@shared/entities/java'
import { requireObject, requireString } from '/@shared/util/assert'
import { ModuleOption } from '../root'

type State = {
  all: JavaRecord[]
}

interface Getters {
  defaultJava: JavaRecord
  missingJava: boolean
}
interface Mutations {
  javaUpdate: (JavaRecord | JavaRecord[])
  javaRemove: (JavaRecord)
}

export type JavaModule = ModuleOption<State, Getters, Mutations, {}>

const mod: JavaModule = {
  state: {
    all: [],
  },
  getters: {
    defaultJava: state => state.all.find(j => j.valid && j.majorVersion === 8) || state.all.find(j => j.valid) || EMPTY_JAVA,
    missingJava: state => state.all.length === 0,
  },
  mutations: {
    javaUpdate (state, java) {
      if (java instanceof Array) {
        for (const j of java) {
          const existed = state.all.find(jp => jp.path === j.path)
          if (existed) {
            existed.majorVersion = j.majorVersion
            existed.version = j.version
            existed.valid = j.valid
          } else {
            state.all.push(j)
          }
        }
      } else {
        const existed = state.all.find(j => j.path === java.path)
        if (existed) {
          existed.majorVersion = java.majorVersion
          existed.version = java.version
          existed.valid = java.valid
        } else {
          state.all.push(java)
        }
      }
    },
    javaRemove (state, java) {
      requireObject(java)
      requireString(java.path)

      // TODO: remove in vue3
      state.all = state.all.filter(j => j.path !== java.path && j.version !== java.version)
    },
  },
}

export default mod
