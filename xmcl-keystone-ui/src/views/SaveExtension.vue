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
    <!-- <span class="text-lg">{{ t('save.name', 2) }}</span> -->
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
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'

// const { importSave } = useInstanceSaves()
const { t } = useI18n()
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
