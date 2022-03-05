import { computed } from '@vue/composition-api'
import { injection } from '../util/inject'
import { VuetifyInjectionKey } from '../windows/main/vuetify'

export function useTheme() {
  const vuetify = injection(VuetifyInjectionKey)

  const darkTheme = computed({
    get(): boolean { return vuetify.theme.dark },
    set(v: boolean) { vuetify.theme.dark = v },
  })

  return {
    darkTheme,
  }
}
