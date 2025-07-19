import colors from 'vuetify/util/colors'
import { vuetify } from '@/vuetify'

export function useVuetifyColor() {
  const getColorCode = (code: string) => {
    return vuetify.theme.current.value.colors[code] ?? (colors as any)[code]?.base ?? ''
  }

  return {
    getColorCode,
  }
}
