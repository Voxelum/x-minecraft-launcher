<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="_ => isInstanceLinked ? t('resourcepack.shared') : t('resourcepack.independent')"
      icon
      :loading="loading"
      large
      @click="onLinkClicked"
    >
      <v-icon>{{ isInstanceLinked ? 'account_tree' : 'looks_one' }}</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="_ => t('shaderPack.showDirectory')"
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
import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const { showDirectory, link, unlink, isLinked, scan } = useService(InstanceShaderPacksServiceKey)
const { path } = injection(kInstance)

const { data: isInstanceLinked, isValidating, mutate } = useSWRV(computed(() => path.value), isLinked)
const linking = ref(false)
const loading = computed(() => linking.value || isValidating.value)
const onLinkClicked = async () => {
  linking.value = true
  if (isInstanceLinked.value) {
    unlink(path.value).finally(() => {
      linking.value = false
      mutate()
    })
  } else {
    await scan(path.value)
    await link(path.value, true).finally(() => {
      linking.value = false
      mutate()
    })
  }
}

const { t } = useI18n()
</script>
