<template>
  <div class="flex gap-3 items-center justify-end">
    <v-btn
      v-shared-tooltip="t('shaderPack.showDirectory')"
      icon
      large
      @click="showDirectory()"
    >
      <v-icon>folder</v-icon>
    </v-btn>
    <!-- <v-btn
      v-shared-tooltip="t('instance.addMod')"
      icon
      large
      @click="onInstall"
    >
      <v-icon>
        playlist_add
      </v-icon>
    </v-btn> -->
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceShaderPacksServiceKey)

const { t } = useI18n()
const { push } = useRouter()
const onInstall = () => {
  push('/mod-add')
}
</script>
