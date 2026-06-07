<template>
  <div>
    <v-alert
      v-if="error"
      type="error"
      prominent
      border="start"
    >
      <div class="flex items-center justify-center">
        {{ error }}
        <v-spacer />
        <v-btn
          @click="push('/setting')"
         variant="text">
          <v-icon start>
            settings
          </v-icon>
          {{ t('setting.name', 2) }}
        </v-btn>
      </div>
    </v-alert>
    <v-alert
      v-if="corruptedResourceCount > 0"
      type="warning"
      border="start"
      class="mt-2"
    >
      <div class="flex items-center justify-center">
        {{ t('errors.CorruptedResourceMetadata', { count: corruptedResourceCount }) }}
        <v-spacer />
        <v-btn
          variant="text"
          @click="push('/mods')"
        >
          <v-icon start>
            extension
          </v-icon>
          {{ t('mod.name', 2) }}
        </v-btn>
      </div>
    </v-alert>
  </div>
</template>
<script setup lang="ts">
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { isOpened, isNoEmptySpace, invalidGameDataPath, corruptedResourceCount } = injection(kCriticalStatus)
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
