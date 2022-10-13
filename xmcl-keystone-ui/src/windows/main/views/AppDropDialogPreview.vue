<template>
  <v-flex
    style="display: flex; flex-direction: column; height: 100%;"
  >
    <v-card-text class="headline font-weight-bold">
      {{ t('universalDrop.title') }}
    </v-card-text>
    <v-divider />
    <v-list
      class="w-full overflow-auto"
    >
      <file-list-tile
        v-for="file in previews"
        :key="file.name"
        :value="file"
        @remove="emit('remove', file)"
        @enable="setEnable(file, $event)"
      />
    </v-list>
    <v-spacer />
    <v-divider />
    <v-card-actions class="px-10 gap-4">
      <v-btn
        large
        text
        @click="cancel"
      >
        {{ t('cancel') }}
      </v-btn>
      <v-spacer />
      <v-checkbox
        v-model="enableMods"
        style="flex-grow: 0; margin-top: 0; padding-top: 0;"
        :label="t('universalDrop.enableModsAfterImport')"
        hide-details
      />
      <v-btn
        large
        text
        style="margin-left: 10px;"
        color="primary"
        :loading="loading"
        :disabled="disabled"
        @click="start"
      >
        {{ t('universalDrop.start') }}
      </v-btn>
    </v-card-actions>
  </v-flex>
</template>

<script lang=ts setup>
import { useFileDrop, useI18n } from '/@/composables'
import FileListTile from './AppDropDialogFileListTile.vue'
import { FilePreview } from '/@/composables/dropService'

const props = defineProps<{ previews: FilePreview[] }>()
const emit = defineEmits(['cancel', 'remove'])

const enableMods = ref(true)
const { importFile } = useFileDrop()
const loading = computed(() => props.previews.some((v) => v.status === 'loading'))
const pendings = computed(() => props.previews.filter((v) => (v.status === 'idle' || v.status === 'failed') && v.enabled))
const disabled = computed(() => pendings.value.length === 0)
const { t } = useI18n()

function cancel() {
  emit('cancel')
}
function start() {
  const promises = [] as Promise<any>[]
  for (const preview of pendings.value) {
    preview.status = 'loading'
    const promise = importFile({
      resource: {
        name: preview.name,
        path: preview.path,
        uri: preview.url,
      },
      modpackPolicy: {
        import: true,
      },
    }).then(() => {
      preview.status = 'saved'
    }, (e) => {
      console.log(`Failed to import resource ${preview.path}`)
      console.log(e)
      preview.status = 'failed'
    })
    promises.push(promise)
  }
  Promise.all(promises).then(() => cancel())
}
function setEnable(file: FilePreview, enabled?: boolean) {
  file.enabled = enabled ?? true
}
</script>
