import { injection } from '@/util/inject'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorageCacheBool } from './cache'
import { kEnvironment } from './environment'
import { kSettingsState, useGlobalSettings } from './setting'

/**
 * Optional badge rendered next to a setting's title in the palette to
 * indicate a scope or category — e.g. the global-instance items show a
 * "Global" chip mirroring the one on the Global Settings page.
 */
export interface SettingsSearchChip {
  text: string
  icon?: string
  color?: string
}

/**
 * A searchable global setting item shown in the command palette. Currently
 * only `switch` (boolean toggle) and `select` (single-value pick from a
 * list) entries are supported. Both kinds need to be backed by a writable
 * computed so the palette can mutate them in place.
 */
export type SettingsSearchItem =
  | {
      kind: 'switch'
      id: string
      title: string
      description: string
      icon?: string
      group: string
      keywords: string
      chip?: SettingsSearchChip
      get value(): boolean
      set value(v: boolean)
    }
  | {
      kind: 'select'
      id: string
      title: string
      description: string
      icon?: string
      group: string
      keywords: string
      chip?: SettingsSearchChip
      items: { text: string; value: string }[]
      get value(): string
      set value(v: string)
    }

/**
 * Returns the searchable setting entries for the global Settings page.
 *
 * Keep this list scoped to the **General** section for now — the palette
 * only knows how to render `switch` and `select` entries, and other
 * sections (Network, Game, Update…) include text inputs / sliders which
 * would need bespoke editors.
 *
 * The returned items reuse the same locale keys as the Settings page so
 * users see consistent wording, and they read state directly from
 * {@link kSettingsState} so toggles in the palette are reflected
 * everywhere immediately.
 */
export function useSettingsSearchItems() {
  const { t } = useI18n()
  const { state } = injection(kSettingsState)
  const env = injection(kEnvironment)

  // streamerMode is provided at the App root via `provide('streamerMode', …)`.
  // Fall back to a fresh local-storage ref so the composable still works in
  // isolated tests / storybook contexts.
  const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false)) as { value: boolean }

  const groupGeneral = computed(() => t('setting.general'))
  const groupGlobalInstance = computed(() => t('setting.globalSetting'))
  const globalChip = computed<SettingsSearchChip>(() => ({
    text: t('settingLabel.global'),
    icon: 'public',
    color: 'purple-lighten-2',
  }))

  const {
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalVmOptions,
    globalMcOptions,
    globalFastLaunch,
    globalHideLauncher,
    globalShowLog,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalPrependCommand,
    globalPreExecuteCommand,
    globalEnv,
    globalResolution,
    setGlobalSettings,
  } = useGlobalSettings()

  /**
   * `setGlobalSettings` requires the full payload, so to flip a single
   * boolean we snapshot every other current value and override only the
   * one being changed. Uses the live computed refs from {@link useGlobalSettings}.
   */
  const patchGlobal = (patch: Partial<{
    globalFastLaunch: boolean
    globalHideLauncher: boolean
    globalShowLog: boolean
    globalDisableAuthlibInjector: boolean
    globalDisableElyByAuthlib: boolean
  }>) => {
    setGlobalSettings({
      globalAssignMemory: globalAssignMemory.value,
      globalMinMemory: globalMinMemory.value,
      globalMaxMemory: globalMaxMemory.value,
      globalVmOptions: [...globalVmOptions.value],
      globalMcOptions: [...globalMcOptions.value],
      globalFastLaunch: globalFastLaunch.value,
      globalHideLauncher: globalHideLauncher.value,
      globalShowLog: globalShowLog.value,
      globalDisableAuthlibInjector: globalDisableAuthlibInjector.value,
      globalDisableElyByAuthlib: globalDisableElyByAuthlib.value,
      globalPrependCommand: globalPrependCommand.value,
      globalPreExecuteCommand: globalPreExecuteCommand.value,
      globalEnv: { ...globalEnv.value },
      globalResolution: { ...(globalResolution.value ?? {}) },
      ...patch,
    })
  }

  const items = computed<SettingsSearchItem[]>(() => {
    const list: SettingsSearchItem[] = []
    const s = state.value
    if (!s) return list

    list.push({
      kind: 'select',
      id: 'setting.locale',
      title: t('setting.language'),
      description: t('setting.languageDescription'),
      icon: 'language',
      group: groupGeneral.value,
      keywords: 'language locale i18n translation',
      get value() {
        return s.locales.find(l => l.locale === s.locale)?.locale || 'en'
      },
      set value(v: string) {
        s.localeSet(v)
      },
      items: s.locales.map(l => ({ text: l.name, value: l.locale })),
    })

    list.push({
      kind: 'switch',
      id: 'setting.disableTelemetry',
      title: t('setting.disableTelemetry'),
      description: t('setting.disableTelemetryDescription'),
      icon: 'privacy_tip',
      group: groupGeneral.value,
      keywords: 'telemetry analytics privacy data collection',
      get value() {
        return s.disableTelemetry
      },
      set value(v: boolean) {
        s.disableTelemetrySet(v)
      },
    })

    if (env.value?.os === 'linux' || env.value?.os === 'windows') {
      list.push({
        kind: 'switch',
        id: 'setting.enableDedicatedGPUOptimization',
        title: t('setting.enableDedicatedGPUOptimization'),
        description: t('setting.enableDedicatedGPUOptimizationDescription'),
        icon: 'memory',
        group: groupGeneral.value,
        keywords: 'gpu graphics dedicated nvidia amd performance',
        get value() {
          return s.enableDedicatedGPUOptimization
        },
        set value(v: boolean) {
          s.enableDedicatedGPUOptimizationSet(v)
        },
      })
    }

    list.push({
      kind: 'switch',
      id: 'setting.enableDiscord',
      title: t('setting.enableDiscord'),
      description: t('setting.enableDiscordDescription'),
      icon: 'discord',
      group: groupGeneral.value,
      keywords: 'discord rich presence rpc',
      get value() {
        return s.discordPresence
      },
      set value(v: boolean) {
        s.discordPresenceSet(v)
      },
    })

    list.push({
      kind: 'switch',
      id: 'setting.developerMode',
      title: t('setting.developerMode'),
      description: t('setting.developerModeDescription'),
      icon: 'code',
      group: groupGeneral.value,
      keywords: 'developer dev debug mode',
      get value() {
        return s.developerMode
      },
      set value(v: boolean) {
        s.developerModeSet(v)
      },
    })

    list.push({
      kind: 'switch',
      id: 'setting.streamerMode',
      title: t('setting.streamerMode'),
      description: t('setting.streamerModeDescription'),
      icon: 'videocam',
      group: groupGeneral.value,
      keywords: 'streamer streaming twitch obs hide private',
      get value() {
        return streamerMode.value
      },
      set value(v: boolean) {
        streamerMode.value = v
      },
    })

    list.push({
      kind: 'select',
      id: 'setting.replaceNative',
      title: t('setting.replaceNative'),
      description: t('setting.replaceNativeDescription'),
      icon: 'swap_horiz',
      group: groupGeneral.value,
      keywords: 'native libraries replace lwjgl arch arm',
      get value() {
        const v = s.replaceNatives
        return v === false ? '' : v
      },
      set value(v: string) {
        const target = !v ? false : (v as 'legacy-only' | 'all')
        s.replaceNativesSet(target)
      },
      items: [
        { text: t('shared.disable'), value: '' },
        { text: t('setting.replaceNatives.legacy'), value: 'legacy-only' },
        { text: t('setting.replaceNatives.all'), value: 'all' },
      ],
    })

    // ── Global Instance Settings ────────────────────────────────────────────
    // Defaults that apply to every instance unless overridden locally. We
    // expose only the boolean toggles here; numeric / text fields (memory,
    // VM options, env vars) need richer editors than the palette offers.
    const chip = globalChip.value
    const globalGroup = groupGlobalInstance.value

    list.push({
      kind: 'switch',
      id: 'globalInstance.fastLaunch',
      title: t('instanceSetting.fastLaunch'),
      description: t('instanceSetting.fastLaunchHint'),
      icon: 'flash_on',
      group: globalGroup,
      keywords: 'fast turbo launch skip checks ignore problems',
      chip,
      get value() {
        return globalFastLaunch.value
      },
      set value(v: boolean) {
        patchGlobal({ globalFastLaunch: v })
      },
    })

    list.push({
      kind: 'switch',
      id: 'globalInstance.hideLauncher',
      title: t('instanceSetting.hideLauncher'),
      description: t('instanceSetting.hideLauncher'),
      icon: 'visibility_off',
      group: globalGroup,
      keywords: 'hide launcher window minimize after launch',
      chip,
      get value() {
        return globalHideLauncher.value
      },
      set value(v: boolean) {
        patchGlobal({ globalHideLauncher: v })
      },
    })

    list.push({
      kind: 'switch',
      id: 'globalInstance.showLog',
      title: t('instanceSetting.showLog'),
      description: t('instanceSetting.showLogHint'),
      icon: 'subject',
      group: globalGroup,
      keywords: 'show minecraft log console output stream',
      chip,
      get value() {
        return globalShowLog.value
      },
      set value(v: boolean) {
        patchGlobal({ globalShowLog: v })
      },
    })

    list.push({
      kind: 'switch',
      id: 'globalInstance.disableAuthlibInjector',
      title: t('instanceSetting.disableAuthlibInjector'),
      description: t('instanceSetting.disableAuthlibInjectorDescription'),
      icon: 'no_accounts',
      group: globalGroup,
      keywords: 'authlib injector disable third party auth yggdrasil',
      chip,
      get value() {
        return globalDisableAuthlibInjector.value
      },
      set value(v: boolean) {
        patchGlobal({ globalDisableAuthlibInjector: v })
      },
    })

    list.push({
      kind: 'switch',
      id: 'globalInstance.disableElyByAuthlib',
      title: t('instanceSetting.disableElyByAuthlib'),
      description: t('instanceSetting.disableElyByAuthlibDescription'),
      icon: 'block',
      group: globalGroup,
      keywords: 'ely.by authlib disable replacement skin',
      chip,
      get value() {
        return globalDisableElyByAuthlib.value
      },
      set value(v: boolean) {
        patchGlobal({ globalDisableElyByAuthlib: v })
      },
    })

    return list
  })

  return items
}
