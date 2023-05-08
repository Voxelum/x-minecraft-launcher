<template>
  <div class="flex gap-3 items-center justify-end">
    <v-btn
      v-shared-tooltip="t('resourcepack.name', 2)"
      icon
      large
      @click="showDirectory()"
    >
      <v-icon>folder</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceResourcePacksServiceKey)

const { t } = useI18n()
const { push } = useRouter()
const onInstall = () => {
  push('/mod-add')
}
</script>
