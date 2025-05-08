<template>
  <v-alert
    v-if="error"
    type="error"
    prominent
    border="left"
  >
    <div class="flex items-center justify-center">
      {{ error }}
      <v-spacer />
      <v-btn
        text
        @click="push('/setting')"
      >
        <v-icon left>
          settings
        </v-icon>
        {{ t('setting.name', 2) }}
      </v-btn>
    </div>
  </v-alert>
</template>
<script setup lang="ts">
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { isOpened, isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus)
const { push } = useRouter()
const getDirErroText = useGetDataDirErrorText()
const error = computed(() => {
  if (!isOpened.value) {
    return t('errors.DatabaseNotOpened')
  }
  if (isNoEmptySpace.value) {
    return t('errors.DiskIsFull')
  }
  // if (invalidGameDataPath.value) {
  //   return getDirErroText(invalidGameDataPath.value)
  // }
  return ''
})
</script>
