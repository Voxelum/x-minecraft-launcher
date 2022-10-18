import { InjectionKey } from 'vue'
import { Framework } from 'vuetify'
import { injection } from '../util/inject'
import colors from 'vuetify/lib/util/colors'

export const kVuetify: InjectionKey<Framework> = Symbol('vuetify')

export function useVuetifyColor() {
  const vuetify = injection(kVuetify)

  const getColorCode = (code: string) => {
    return vuetify.theme.currentTheme[code] ?? (colors as any)[code]?.base ?? ''
  }

  return {
    getColorCode,
  }
}
