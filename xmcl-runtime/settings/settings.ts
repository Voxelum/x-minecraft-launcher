import { MutableState, Settings } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export const kSettings: InjectionKey<MutableState<Settings>> = Symbol('settings')

export function shouldOverrideApiSet(s: Settings, gfw: boolean) {
  if (s.apiSetsPreference === 'mojang') {
    return false
  }
  if (s.apiSetsPreference === '') {
    return gfw
  }
  return true
}

export function getApiSets(s: Settings) {
  const apiSets = s.apiSets
  const api = apiSets.find(a => a.name === s.apiSetsPreference)
  const allSets = apiSets.filter(a => a.name !== s.apiSetsPreference)
  if (api) {
    allSets.unshift(api)
  }
  return allSets
}
