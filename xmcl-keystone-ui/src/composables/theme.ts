import { injection } from '@/util/inject'
import { Ref, computed } from 'vue'
import { kSettingsState } from './setting'
import { kVuetify } from './vuetify'
import { Settings } from '@xmcl/runtime-api'
import { Framework } from 'vuetify'

export function useTheme() {
  const vuetify = injection(kVuetify)

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

export function useThemeSync(framework: Framework, state: Ref<Settings | undefined>) {
  const preferDark = usePreferDark()

  const updateTheme = (theme: 'dark' | 'system' | 'light') => {
    if (theme === 'system') {
      framework.theme.dark = preferDark.value
    } else if (theme === 'dark') {
      framework.theme.dark = true
    } else if (theme === 'light') {
      framework.theme.dark = false
    }
  }

  watch(computed(() => state.value?.theme ?? 'system'), (newValue: string, oldValue: string) => {
    console.log(`Theme changed ${oldValue} -> ${newValue}`)
    updateTheme(newValue as any)
  })

  updateTheme(state.value?.theme || 'system')
}
