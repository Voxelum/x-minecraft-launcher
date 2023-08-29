<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="t('shaderPack.showDirectory')"
      icon
      large
      @click="showDirectory(path)"
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
import { kInstance } from '@/composables/instance'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceShaderPacksServiceKey)
const { path } = injection(kInstance)

const { t } = useI18n()
</script>
