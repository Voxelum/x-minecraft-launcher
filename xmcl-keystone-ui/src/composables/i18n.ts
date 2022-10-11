import { inject, InjectionKey } from '@vue/composition-api'
import VueI18n from 'vue-i18n'

export const I18N_KEY: InjectionKey<VueI18n> = Symbol('I18N_KEY')

let debug: string[] | undefined
if (import.meta.env.DEV) {
  debug = []
}

export function useI18n () {
  const i18n = getCurrentInstance()?.proxy.$i18n ?? inject(I18N_KEY)
  if (!i18n) throw new Error('Cannot find i18n. Maybe router not loaded?')
  return {
    t (key: string, values?: any[] | { [key: string]: any }): string { return i18n.t(key, values) as any },
    tc (key: string, count: number, args?: any): string { return i18n.tc(key, count, args) },
    te (key: string): boolean { return i18n.te(key) },
    ts(key: string, fallback: string) {
      if (i18n.te(key)) {
        return i18n.t(key)
      } else {
        if (debug?.indexOf(key) === -1) {
          console.log(`[KEY] ${key}: ${fallback[0].toUpperCase() + fallback.substring(1)}`)
        }
        debug?.push(key)
        return fallback[0].toUpperCase() + fallback.substring(1)
      }
    },
  }
}
