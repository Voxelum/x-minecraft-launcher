<template>
  <div
    style="display: flex; flex-direction: column; height: 100%;"
  >
    <v-card-text class="headline font-weight-bold">
      {{ t('universalDrop.title') }}
    </v-card-text>
    <v-divider />
    <v-list
      class="w-full overflow-auto"
    >
      <FileListTile
        v-for="file in previews"
        :key="file.title"
        :value="file"
        @remove="emit('remove', file)"
        @enable="setEnable(file, $event)"
      />
    </v-list>
    <v-spacer />
    <v-divider />
    <v-card-actions class="gap-4 px-10">
      <v-btn
        large
        text
        @click="cancel"
      >
        {{ t('cancel') }}
      </v-btn>
      <v-spacer />
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
  </div>
</template>

<script lang=ts setup>
import { DropItem } from '@/composables/appDropHandler'
import FileListTile from './AppDropDialogFileListTile.vue'

const props = defineProps<{ previews: DropItem[] }>()
const emit = defineEmits(['cancel', 'remove', 'import'])

const loading = computed(() => props.previews.some((v) => v.status === 'loading'))
const pendings = computed(() => props.previews.filter((v) => v.enabled))
const disabled = computed(() => pendings.value.length === 0)
const { t } = useI18n()

function cancel() {
  emit('cancel')
}
function start() {
  emit('import', pendings.value)
}
function setEnable(file: DropItem, enabled?: boolean) {
  file.enabled = enabled ?? true
}
</script>
