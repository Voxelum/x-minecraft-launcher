import { PersistedResource } from '/@shared/entities/resource'
import { remove } from '/@shared/util/middleware'
import { Category } from '@xmcl/curseforge'
import { ModuleOption } from '../root'

interface State {
  downloading: { fileId: number; taskId: string }[]
  categories: Category[]
  categoriesTimestamp: string
}

interface Getters {
  isFileInstalled: (file: { id: number; href: string }) => boolean
  findFileInstalled: (file: { id: number; href: string }) => PersistedResource | undefined
}

interface Mutations {
  curseforgeDownloadFileStart: { fileId: number; taskId: string }
  curseforgeDownloadFileEnd: number
  curseforgeCategories: { categories: Category[]; timestamp: string }
}

export type CurseForgeModule = ModuleOption<State, Getters, Mutations, {}>

const mod: CurseForgeModule = {
  state: {
    downloading: [],
    categories: [],
    categoriesTimestamp: '',
  },
  getters: {
    isFileInstalled: (state, _, rt) => (file) => {
      const find = (m: PersistedResource) => {
        if ('curseforge' in m && typeof m.curseforge === 'object') {
          const s = m.curseforge
          if (s.fileId === file.id) return true
        }
        return false
      }
      if (rt.resource.mods.find(find)) return true
      if (rt.resource.resourcepacks.find(find)) return true
      if (rt.resource.modpacks.find(find)) return true
      if (rt.resource.saves.find(find)) return true

      return false
    },
    findFileInstalled: (state, _, rt) => (file) => {
      /**
             */
      const find = (m: PersistedResource) => {
        const source = m
        if ('curseforge' in source && typeof source.curseforge === 'object') {
          const s = source.curseforge
          if (s.fileId === file.id) return true
        }
        return false
      }
      let result
      /* eslint-disable no-cond-assign */
      if (result = rt.resource.mods.find(find)) return result
      if (result = rt.resource.resourcepacks.find(find)) return result
      if (result = rt.resource.modpacks.find(find)) return result
      if (result = rt.resource.saves.find(find)) return result
      /* eslint-enable no-cond-assign */

      return undefined
    },
  },
  mutations: {
    curseforgeDownloadFileStart (state, { fileId, taskId }) {
      state.downloading.push({ fileId, taskId })
    },
    curseforgeDownloadFileEnd (state, fileId) {
      const index = state.downloading.findIndex(f => f.fileId === fileId)

      state.downloading.splice(index, 1)

      // TODO: remove in vue3
      remove(state.downloading, index)
    },
    curseforgeCategories (state, { categories, timestamp }) {
      state.categories = categories
      state.categoriesTimestamp = timestamp
    },
  },
}

export default mod
