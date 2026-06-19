import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import { usePreferredDark } from '@vueuse/core'
import 'virtual:uno.css'
import { createApp, defineComponent, h } from 'vue'
import App from './App.vue'

// Lazily-importable locale bundles, same glob the main window uses.
const localeLoaders = import.meta.glob('../../locales/*.yaml')

/**
 * Pick the best available locale for a preferred tag, mirroring the main
 * window's fallback chain: exact tag -> base language -> any regional variant
 * of that language -> English.
 */
function resolveLocale(preferred: string): string {
  const available = Object.keys(localeLoaders)
    .map((p) => /\/([^/]+)\.yaml$/.exec(p)?.[1])
    .filter((v): v is string => !!v)
  if (available.includes(preferred)) return preferred
  const base = preferred.split('-')[0]
  if (available.includes(base)) return base
  const regional = available.find((l) => l.startsWith(`${base}-`))
  if (regional) return regional
  return 'en'
}

/**
 * The migration window boots from `LauncherApp.setup()`, long before the
 * settings service exists, so it cannot use `useI18nSync`. Instead it reads the
 * locale the main window last persisted to localStorage (same renderer origin),
 * falling back to the OS/browser language. English is already bundled, so only
 * other locales need to be fetched.
 */
async function setupLocale() {
  let preferred = 'en'
  try {
    preferred = localStorage.getItem('locale') || navigator.language || 'en'
  } catch {
    preferred = navigator.language || 'en'
  }
  const locale = resolveLocale(preferred)
  if (typeof document !== 'undefined') {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }
  if (locale === 'en') return
  const loader = localeLoaders[`../../locales/${locale}.yaml`]
  if (!loader) return
  try {
    const message: any = await loader()
    i18n.global.setLocaleMessage(locale, message.default)
    ;(i18n.global.locale as any).value = locale
  } catch {
    // Keep English on any load failure — the window must still render.
  }
}

function bootstrap() {
  const app = createApp(defineComponent({
    setup(props, context) {
      const preferDark = usePreferredDark()
      const updateTheme = (theme: string) => {
        if (theme === 'system') {
          vuetify.theme.change(preferDark.value ? 'dark' : 'light')
        } else if (theme === 'dark') {
          vuetify.theme.change('dark')
        } else if (theme === 'light') {
          vuetify.theme.change('light')
        }
      }
      updateTheme('dark')

      return () => h(App)
    },
  }))

  app.use(i18n)
  app.use(vuetify)

  app.mount('#app')
}

setupLocale().finally(bootstrap)


