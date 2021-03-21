import { inject } from '@vue/composition-api'
import { STORE_KEY } from '/@/constant'
import { RootCommit, Store } from '/@shared/store'

export function useStore (): Store {
  const repo = inject(STORE_KEY)
  if (!repo) throw new Error('Cannot find Store. Maybe store not loaded?')
  return repo
}

export function useMutation<T extends keyof RootCommit> (key: T): (payload: Parameters<Required<RootCommit>[T]>[1]) => void {
  const { commit } = useStore()
  return payload => commit(key, payload)
}

export function useMutations<T extends keyof RootCommit> (...keys: T[]): { [K in T]: (payload: Parameters<Required<RootCommit>[K]>[1] | void) => void } {
  const result: any = {}
  keys.forEach((k) => { result[k] = useMutation(k) })
  return result
}
