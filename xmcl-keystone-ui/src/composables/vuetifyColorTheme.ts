import { Framework } from 'vuetify'
import { useColorTheme } from './colorTheme'

export function useVuetifyColorTheme(vuetify: Framework, {
  primaryColor,
  accentColor,
  infoColor,
  errorColor,
  successColor,
  warningColor,
}: Omit<ReturnType<typeof useColorTheme>, 'cssVars'>) {
  if (primaryColor.value) { vuetify.theme.currentTheme.primary = primaryColor.value }
  if (accentColor.value) { vuetify.theme.currentTheme.accent = accentColor.value }
  if (infoColor.value) { vuetify.theme.currentTheme.info = infoColor.value }
  if (errorColor.value) { vuetify.theme.currentTheme.error = errorColor.value }
  if (successColor.value) { vuetify.theme.currentTheme.success = successColor.value }
  if (warningColor.value) { vuetify.theme.currentTheme.warning = warningColor.value }

  watch(primaryColor, (newColor) => { vuetify.theme.currentTheme.primary = newColor })
  watch(accentColor, (newColor) => { vuetify.theme.currentTheme.accent = newColor })
  watch(infoColor, (newColor) => { vuetify.theme.currentTheme.info = newColor })
  watch(errorColor, (newColor) => { vuetify.theme.currentTheme.error = newColor })
  watch(successColor, (newColor) => { vuetify.theme.currentTheme.success = newColor })
  watch(warningColor, (newColor) => { vuetify.theme.currentTheme.warning = newColor })
}
