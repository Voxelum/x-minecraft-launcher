import colors from 'vuetify/lib/util/colors'
import { vuetify } from '@/vuetify'

export function useVuetifyColor() {
  const getColorCode = (code: string) => {
    return vuetify.framework.theme.currentTheme[code] ?? (colors as any)[code]?.base ?? ''
  }

  return {
    getColorCode,
  }
}
