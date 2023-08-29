<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="t('mod.showDirectory')"
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
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceModsServiceKey)
const { path, runtime: version } = injection(kInstance)
const { t } = useI18n()
const { push } = useRouter()
</script>
