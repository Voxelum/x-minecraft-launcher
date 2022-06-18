import { InjectionKey } from '@vue/composition-api'
import { Framework } from 'vuetify'
import { injection } from '../util/inject'
import colors from 'vuetify/lib/util/colors'

export const VuetifyInjectionKey: InjectionKey<Framework> = Symbol('vuetify')

export function useVuetifyColor() {
  const vuetify = injection(VuetifyInjectionKey)

  const getColorCode = (code: string) => {
    return vuetify.theme.currentTheme[code] ?? (colors as any)[code]?.base ?? ''
  }

  return {
    getColorCode,
  }
}
