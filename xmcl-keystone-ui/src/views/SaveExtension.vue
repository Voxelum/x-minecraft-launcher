<template>
  <div
    class="z-5 flex flex-shrink flex-grow-0 items-center gap-2"
    outlined
    elevation="1"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div class="flex flex-grow-0 flex-row items-center justify-center gap-1">
      <AvatarItemList :items="items" />
    </div>
    <v-spacer />
    <v-text-field
      class="max-w-60"
      small
      hide-details
      outlined
      filled
      dense
      prepend-inner-icon="search"
    />
    <!-- <v-btn
      text
      @click="isCopyFromDialogShown = true"
    >
      <v-icon left>
        input
      </v-icon>
      {{ t('save.copyFrom.title') }}
    </v-btn>
    <v-btn
      text
      @click="doImport"
    >
      <v-icon left>
        move_to_inbox
      </v-icon>
      {{ t('save.import') }}
    </v-btn> -->
  </div>
</template>

<script lang="ts" setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kCompact } from '@/composables/scrollTop'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

// const { importSave } = useInstanceSaves()
const { path, runtime: version } = injection(kInstance)
const { isSaveLinked } = useService(InstanceSavesServiceKey)
const { data: isInstanceLinked, isValidating, mutate } = useSWRV(computed(() => path.value), isSaveLinked)
const { t } = useI18n()

const items = computed(() => {
  return [
    ...getExtensionItemsFromRuntime({ minecraft: version.value.minecraft }),
    {
      icon: isInstanceLinked.value ? 'account_tree' : 'looks_one',
      title: t('save.name', 2),
      text: isInstanceLinked.value ? t('save.shared') : t('save.independent'),
    },
  ]
})
const { showOpenDialog } = windowController
// const { isShown: isCopyFromDialogShown } = useDialog('save-copy-from')
// async function doImport() {
//   const { filePaths } = await showOpenDialog({
//     title: t('save.importTitle'),
//     message: t('save.importMessage'),
//     filters: [{ extensions: ['zip'], name: 'zip' }],
//   })
//   for (const file of filePaths) {
//     importSave({ path: file })
//   }
// }
const compact = injection(kCompact)
</script>
