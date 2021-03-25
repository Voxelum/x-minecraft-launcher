import { LaunchStatus } from '/@shared/entities/launch'
import { ModuleOption } from '../root'

interface State {
  status: LaunchStatus
  errorType: string
  errors: any[]
}
interface Mutations {
  launchStatus: LaunchStatus
  launchErrors: { type: string; content: any[] }
}

export type LauncherModule = ModuleOption<State, {}, Mutations, {}>

const mod: LauncherModule = {
  state: {
    status: 'ready',
    errorType: '',
    errors: [],
  },
  mutations: {
    launchStatus(state, status) {
      state.status = status
    },
    launchErrors(state, error) {
      state.errorType = error.type
      state.errors = error.content
    },
  },
}

export default mod
