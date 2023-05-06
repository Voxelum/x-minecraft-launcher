<template>
  <div class="flex gap-3 items-center justify-end">
    <v-btn
      v-shared-tooltip="t('mod.showDirectory')"
      icon
      large
      @click="showDirectory()"
    >
      <v-icon>folder</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="t('instance.addMod')"
      icon
      :disabled="noModLoader"
      large
      @click="onInstall"
    >
      <v-icon>
        playlist_add
      </v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceModsServiceKey)
const { version } = injection(kInstanceContext)
const noModLoader = computed(() =>
  !version.value.forge && !version.value.fabricLoader && !version.value.quiltLoader,
)
const { t } = useI18n()
const { push } = useRouter()
const onInstall = () => {
  push('/install')
}
</script>
