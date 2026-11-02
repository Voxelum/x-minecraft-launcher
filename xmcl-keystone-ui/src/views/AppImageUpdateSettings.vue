<template>
  <div v-if="isAppImage && state" class="px-4 py-2">
    <v-select
      :model-value="state.appImageUpdateMode"
      :label="t('setting.appImageUpdateMode')"
      :items="modes"
      @update:model-value="state.appImageUpdateModeSet($event)"
    />
    <v-alert type="info" variant="tonal" class="mb-2">
      {{ t(state.appImageUpdateMode === 'self-managed' ? 'setting.appImageSelfUpdateHint' : 'setting.appImageExternalUpdateHint') }}
    </v-alert>
    <template v-if="state.appImageUpdateMode === 'self-managed'">
      <v-checkbox
        :model-value="state.autoDownload"
        :label="t('setting.appImageAutoDownload')"
        @update:model-value="state.autoDownloadSet(!!$event)"
      />
      <v-checkbox
        :model-value="state.autoInstallOnAppQuit"
        :label="t('setting.appImageAutoInstall')"
        @update:model-value="state.autoInstallOnAppQuitSet(!!$event)"
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { kEnvironment } from '@/composables/environment'
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'

const { t } = useI18n()
const environment = injection(kEnvironment)
const { state } = injection(kSettingsState)
const isAppImage = computed(() => environment.value?.env === 'appimage')
const modes = computed(() => [
  { title: t('setting.appImageExternalMode'), value: 'external' },
  { title: t('setting.appImageSelfMode'), value: 'self-managed' },
])
</script>
