import { useTheme } from '@/composables'
import { useLocalStorageCacheStringValue } from '@/composables/cache'
import { InjectionKey } from 'vue'

export const kColorTheme: InjectionKey<ReturnType<typeof useColorTheme>> = Symbol('ColorTheme')

export function useColorTheme() {
  const { darkTheme } = useTheme()

  const lightAppBarColor = useLocalStorageCacheStringValue<string>('lightAppBarColor', '')
  const lightSideBarColor = useLocalStorageCacheStringValue<string>('lightSideBarColor', '')

  const darkAppBarColor = useLocalStorageCacheStringValue<string>('darkAppBarColor', '#111111FF')
  const darkSideBarColor = useLocalStorageCacheStringValue<string>('darkSideBarColor', '#111111FF')

  const darkCardColor = useLocalStorageCacheStringValue<string>('darkAppBarColor', '#0c0c0ccc')
  const lightCardColor = useLocalStorageCacheStringValue<string>('darkAppBarColor', '#111111FF')

  const darkPrimaryColor = useLocalStorageCacheStringValue<string>('darkPrimaryColor', '#4caf50')
  const darkBackground = useLocalStorageCacheStringValue<string>('darkBackground', '#121212')
  const darkInfoColor = useLocalStorageCacheStringValue<string>('darkInfoColor', '#2196F3')
  const darkErrorColor = useLocalStorageCacheStringValue<string>('darkErrorColor', '#FF5252')
  const darkWarningColor = useLocalStorageCacheStringValue<string>('darkWarningColor', '#FB8C00')
  const darkSuccessColor = useLocalStorageCacheStringValue<string>('darkSuccessColor', '#4CAF50')
  const darkAccentColor = useLocalStorageCacheStringValue<string>('darkAccentColor', '#00e676')

  const lightPrimaryColor = useLocalStorageCacheStringValue<string>('lightPrimaryColor', '#1976D2')
  const lightBackground = useLocalStorageCacheStringValue<string>('lightBackground', '#FFFFFF')
  const lightInfoColor = useLocalStorageCacheStringValue<string>('lightInfoColor', '#2196F3')
  const lightErrorColor = useLocalStorageCacheStringValue<string>('lightErrorColor', '#FF5252')
  const lightWarningColor = useLocalStorageCacheStringValue<string>('lightWarningColor', '#FB8C00')
  const lightSuccessColor = useLocalStorageCacheStringValue<string>('lightSuccessColor', '#4CAF50')
  const lightAccentColor = useLocalStorageCacheStringValue<string>('lightAccentColor', '#82B1FF')

  const appBarColor = computed({
    get: () => darkTheme.value ? darkAppBarColor.value : lightAppBarColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkAppBarColor.value = v
      } else {
        lightAppBarColor.value = v
      }
    },
  })
  const sideBarColor = computed({
    get: () => darkTheme.value ? darkSideBarColor.value : lightSideBarColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkSideBarColor.value = v
      } else {
        lightSideBarColor.value = v
      }
    },
  })

  const primaryColor = computed({
    get: () => darkTheme.value ? darkPrimaryColor.value : lightPrimaryColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkPrimaryColor.value = v
      } else {
        lightPrimaryColor.value = v
      }
    },
  })
  const backgroundColor = computed({
    get: () => darkTheme.value ? darkBackground.value : lightBackground.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkBackground.value = v
      } else {
        lightBackground.value = v
      }
    },
  })
  const infoColor = computed({
    get: () => darkTheme.value ? darkInfoColor.value : lightInfoColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkInfoColor.value = v
      } else {
        lightInfoColor.value = v
      }
    },
  })
  const errorColor = computed({
    get: () => darkTheme.value ? darkErrorColor.value : lightErrorColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkErrorColor.value = v
      } else {
        lightErrorColor.value = v
      }
    },
  })
  const warningColor = computed({
    get: () => darkTheme.value ? darkWarningColor.value : lightWarningColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkWarningColor.value = v
      } else {
        lightWarningColor.value = v
      }
    },
  })
  const successColor = computed({
    get: () => darkTheme.value ? darkSuccessColor.value : lightSuccessColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkSuccessColor.value = v
      } else {
        lightSuccessColor.value = v
      }
    },
  })
  const accentColor = computed({
    get: () => darkTheme.value ? darkAccentColor.value : lightAccentColor.value,
    set: (v: string) => {
      if (darkTheme.value) {
        darkAccentColor.value = v
      } else {
        lightAccentColor.value = v
      }
    },
  })

  function resetDarkToDefault() {
    darkAppBarColor.value = '#111111FF'
    darkSideBarColor.value = '#111111FF'
    darkPrimaryColor.value = '#4caf50'
    darkBackground.value = '#121212'
    darkInfoColor.value = '#2196F3'
    darkErrorColor.value = '#FF5252'
    darkWarningColor.value = '#FB8C00'
    darkSuccessColor.value = '#4CAF50'
    darkAccentColor.value = '#00e676'
  }

  function resetLightToDefault() {
    lightAppBarColor.value = ''
    lightSideBarColor.value = ''
    lightPrimaryColor.value = '#1976D2'
    lightBackground.value = '#FFFFFF'
    lightInfoColor.value = '#2196F3'
    lightErrorColor.value = '#FF5252'
    lightWarningColor.value = '#FB8C00'
    lightSuccessColor.value = '#4CAF50'
    lightAccentColor.value = '#82B1FF'
  }

  function resetToDefault() {
    if (darkTheme.value) {
      resetDarkToDefault()
    } else {
      resetLightToDefault()
    }
  }

  return {
    resetToDefault,
    resetDarkToDefault,
    resetLightToDefault,
    appBarColor,
    sideBarColor,
    primaryColor,
    errorColor,
    warningColor,
    accentColor,
    backgroundColor,
    successColor,
    infoColor,
  }
}
