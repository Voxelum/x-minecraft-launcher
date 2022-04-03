import { computed } from '@vue/composition-api'
import { injection } from '/@/util/inject'
import { VuetifyInjectionKey } from './vuetify'

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

export function usePreferDark() {
  const preferDark = ref(true)
  const matches = (window.matchMedia) ? window.matchMedia('(prefers-color-scheme: dark)') : false
  if (matches) {
    preferDark.value = matches.matches
    matches.onchange = ({ matches }) => {
      preferDark.value = matches
    }
  }
  return preferDark
}
