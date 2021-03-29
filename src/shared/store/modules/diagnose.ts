import { Issue, IssueRegistry, IssueReport } from '/@shared/entities/issue'
import { ModuleOption } from '../root'

export interface State extends IssueRegistry {
}

export interface Getters {
  /**
   * The problems of current launcher state
   */
  issues: Issue[]
  isIssueActive: (id: keyof State['registry']) => boolean
}

interface Mutations {
  issuesPost: Partial<IssueReport>
  issuesStartResolve: Issue[]
  issuesEndResolve: Issue[]
}

export type DiagnoseModule = ModuleOption<State, Getters, Mutations, {}>

const mod: DiagnoseModule = {
  state: {
    missingVersion: { fixing: false, autofix: true, optional: false, actived: [] },
    missingVersionJar: { fixing: false, autofix: true, optional: false, actived: [] },
    missingAssetsIndex: { fixing: false, autofix: true, optional: false, actived: [] },
    missingVersionJson: { fixing: false, autofix: true, optional: false, actived: [] },
    missingLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
    missingAssets: { fixing: false, autofix: true, optional: false, actived: [] },

    corruptedVersionJar: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedAssetsIndex: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedVersionJson: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedLibraries: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedAssets: { fixing: false, autofix: true, optional: true, actived: [] },

    invalidJava: { fixing: false, autofix: true, optional: false, actived: [] },
    missingJava: { fixing: false, autofix: true, optional: false, actived: [] },

    unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
    incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
    incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
    missingAuthlibInjector: { fixing: false, autofix: true, optional: true, actived: [] },
    missingCustomSkinLoader: { fixing: false, autofix: true, optional: true, actived: [] },
    incompatibleJava: { fixing: false, autofix: false, optional: true, actived: [] },
    missingModsOnServer: { fixing: false, autofix: false, optional: false, actived: [] },
    badInstall: { fixing: false, autofix: true, optional: false, actived: [] },

    requireFabric: { fixing: false, autofix: false, optional: true, actived: [] },
    requireForge: { fixing: false, autofix: false, optional: true, actived: [] },
    requireFabricAPI: { fixing: false, autofix: false, optional: true, actived: [] },
  },
  getters: {
    issues(state) {
      const issues: Issue[] = []

      for (const [id, reg] of Object.entries(state)) {
        if (reg.actived.length === 0) continue
        if (reg.actived.length >= 4) {
          issues.push({
            id,
            arguments: { count: reg.actived.length, values: reg.actived },
            autofix: reg.autofix,
            optional: reg.optional,
            multi: true,
          })
        } else {
          issues.push(...reg.actived.map(a => ({
            id,
            arguments: a,
            autofix: reg.autofix,
            optional: reg.optional,
            multi: false,
          })))
        }
      }

      return issues
    },
    isIssueActive: (state) => (key) => (key in state ? state[key].actived.length !== 0 : false),
  },
  mutations: {
    issuesPost(state, issues) {
      for (const [id, value] of Object.entries(issues)) {
        if (value instanceof Array) {
          if (!state[id]) {
            throw new Error(`This should not happen! Missing problem registry ${id}.`)
          } else {
            state[id].actived = Object.freeze(value) as any
          }
        }
      }
    },
    issuesStartResolve(state, issues) {
      issues.forEach((p) => {
        state[p.id].fixing = true
      })
    },
    issuesEndResolve(state, issues) {
      issues.forEach((p) => {
        state[p.id].fixing = false
      })
    },
  },
}

export default mod
