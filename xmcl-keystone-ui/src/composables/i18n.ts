import { inject, InjectionKey } from '@vue/composition-api'
import VueI18n from 'vue-i18n'

export const I18N_KEY: InjectionKey<VueI18n> = Symbol('I18N_KEY')

export function useI18n () {
  const i18n = inject(I18N_KEY)
  if (!i18n) throw new Error('Cannot find i18n. Maybe router not loaded?')
  return {
    $t (key: string, values?: any[] | { [key: string]: any }): string { return i18n.t(key, values) as any },
    $tc (key: string, count: number): string { return i18n.tc(key, count) },
    $te (key: string): boolean { return i18n.te(key) },
    t (key: string, values?: any[] | { [key: string]: any }): string { return i18n.t(key, values) as any },
    tc (key: string, count: number): string { return i18n.tc(key, count) },
    te (key: string): boolean { return i18n.te(key) },
  }
}
