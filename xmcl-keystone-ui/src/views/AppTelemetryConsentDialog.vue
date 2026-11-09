<template>
  <v-dialog
    :model-value="isShown"
    width="560"
    persistent
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="flex w-full max-h-[85vh] flex-col overflow-hidden">
      <div class="flex items-center px-6 pt-6 pb-4 gap-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style="background-color: rgba(var(--v-theme-primary), 0.12)"
        >
          <v-icon size="22" color="primary">privacy_tip</v-icon>
        </div>
        <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
          {{ t('setting.telemetryConsentTitle') }}
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-2 flex flex-col gap-4">
        <p class="text-body-2 opacity-90">
          {{ t('setting.telemetryConsentDescription') }}
        </p>
        <div class="surface-panel p-4 text-body-2 opacity-80">
          {{ t('setting.telemetryConsentDetail') }}
        </div>
        <a
          class="text-body-2"
          :href="privacyUrl"
          target="_blank"
          @click="onDecideLater"
        >
          {{ t('setting.telemetryConsentLearnMore') }}
          <v-icon end size="14">open_in_new</v-icon>
        </a>
      </div>

      <div class="px-6 py-4 flex flex-col gap-2">
        <div class="flex gap-2">
          <v-btn color="primary" variant="flat" class="flex-grow-1" @click="consent('granted')">
            {{ t('setting.telemetryConsentAllow') }}
          </v-btn>
          <v-btn variant="text" class="flex-grow-1" @click="consent('denied')">
            {{ t('setting.telemetryConsentDeny') }}
          </v-btn>
        </div>
        <v-btn variant="text" size="small" @click="onDecideLater">
          {{ t('setting.telemetryConsentDecideLater') }}
        </v-btn>
        <p class="text-caption opacity-60 text-center">
          {{ t('setting.telemetryConsentChangeAnytime') }}
        </p>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'

const { isShown, hide } = useDialog('telemetry-consent')
const { t, locale } = useI18n()

const emit = defineEmits<{
  (e: 'consent', value: 'granted' | 'denied'): void
}>()

/**
 * Map the launcher locale to an xmcl.app site locale for the privacy
 * notice link; unmapped locales fall back to the English notice.
 */
const siteLocales = ['ar', 'be', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'it', 'jp', 'jv', 'kk', 'ko', 'lol', 'pl', 'pt', 'ru', 'tr', 'uk', 'vi', 'zh', 'zh-TW']
const localeAliases: Record<string, string> = {
  'ar-EG': 'ar', 'en-IN': 'en', 'es-ES': 'es', 'it-IT': 'it', 'ja-JP': 'jp',
  'pt-BR': 'pt', 'zh-CN': 'zh', 'zh-HK': 'zh-TW', lolcat: 'lol', kz: 'kk',
}
const privacyUrl = computed(() => {
  const current = String(locale.value)
  const site = siteLocales.includes(current)
    ? current
    : (siteLocales.includes(localeAliases[current] ?? '') ? localeAliases[current] : 'en')
  return `https://xmcl.app/${site}/privacy`
})

function consent(value: 'granted' | 'denied') {
  localStorage.setItem('telemetryConsentPrompted', 'true')
  emit('consent', value)
  hide()
}

function onDecideLater() {
  localStorage.setItem('telemetryConsentPrompted', 'true')
  hide()
}
</script>
