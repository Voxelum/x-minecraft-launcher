<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="_ => 'Alt'"
      icon
      large
      :class="{ 'v-btn--active': isEnabledState }"
      @click="isEnabledState = !isEnabledState"
    >
      <v-icon>translate</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="_ => t('mod.showDirectory')"
      icon
      large
      @click="showDirectory(path)"
    >
      <v-icon>folder</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kLocalizedContent } from '@/composables/localizedContent'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const { isEnabledState } = injection(kLocalizedContent)
const { t } = useI18n()
</script>

<style scoped>
.sun {
  opacity: 1;
}

.moon {
  opacity: 0;
}

.dark .sun {
  opacity: 0;
}

.dark .moon {
  opacity: 1;
}

.dark .VPSwitchAppearance :deep(.check) {
  /*rtl:ignore*/
  transform: translateX(28px);
}
</style>
