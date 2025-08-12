<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-if="i18nEnabled"
      v-shared-tooltip="_ => 'Alt'"
      icon
      large
      :class="{ 'v-btn--active': isEnabledState }"
      @click="isEnabledState = !isEnabledState"
    >
      <v-icon>translate</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="() => t('resourcepack.showDirectory')"
      icon
      large
      @click="showDirectory(path)"
    >
      <v-icon>folder</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useAutoI18nEnabled, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kLocalizedContent } from '@/composables/localizedContent'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'

const i18nEnabled = useAutoI18nEnabled()
const { showDirectory } = useService(InstanceResourcePacksServiceKey)
const { path } = injection(kInstance)
const { isEnabledState } = injection(kLocalizedContent)

const { t } = useI18n()
</script>
