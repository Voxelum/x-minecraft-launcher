<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="_ => isInstanceLinked ? t('save.shared') : t('save.independent')"
      icon
      :loading="loading"
      large
      @click="onLinkClicked"
    >
      <v-icon>{{ isInstanceLinked ? 'account_tree' : 'looks_one' }}</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip.left="_ => t('save.showDirectory')"
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
import { kInstanceSave } from '@/composables/instanceSave'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const { path } = injection(kInstance)
const { showDirectory, linkSharedSave, unlinkSharedSave, isSaveLinked } = useService(InstanceSavesServiceKey)
const { t } = useI18n()
const { data: isInstanceLinked, isValidating, mutate } = useSWRV(computed(() => path.value), isSaveLinked)
const { revalidate } = injection(kInstanceSave)

const linking = ref(false)
const loading = computed(() => linking.value || isValidating.value)
const onLinkClicked = async () => {
  linking.value = true
  if (isInstanceLinked.value) {
    unlinkSharedSave(path.value).finally(() => {
      linking.value = false
      mutate()
      revalidate()
    })
  } else {
    await linkSharedSave(path.value).finally(() => {
      linking.value = false
      mutate()
      revalidate()
    })
  }
}
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
