<template>
  <v-list
    data-testid="setup-data-root"
    class="non-moveable"
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-list-item-title class="whitespace-pre-wrap">
        {{ t('setup.dataRoot.description') }}
      </v-list-item-title>
    </v-list-item>
    <v-list-item>
      <v-list-item-title>{{ t('setup.path') }}</v-list-item-title>
      <v-list-item-subtitle>{{ modelValue }}</v-list-item-subtitle>
      <v-list-item-action class="self-center">
        <v-btn
          :disabled="modelValue === defaultPath"
          style="margin-right: 10px"
          @click="restore"
          variant="text"
        >
          {{ t('setup.defaultPath') }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
        <v-btn color="primary" style="margin-right: 10px" @click="browse" variant="text">
          {{ t('shared.browse') }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-alert v-if="error" class="mx-2" :type="error === 'exists' ? 'warning' : 'error'">
      {{ errorText }}
    </v-alert>
    <v-list-subheader>
      {{ t('setup.dataRoot.drives') }}
    </v-list-subheader>
    <v-list-item
      v-for="d of drives"
      :key="d.mounted"
      v-ripple
      class="m-2 mx-3 cursor-pointer rounded-lg before:rounded-lg hover:bg-[rgba(123,123,123,0.5)]"
      :class="{ 'v-list-item--active': d.selectedPath === modelValue }"
      @click="onSelect(d)"
    >
      <template #prepend
        ><v-avatar>
          <v-icon>storage</v-icon>
        </v-avatar></template
      >

      <v-list-item-title class="flex w-full flex-grow-0 p-0 align-baseline">
        {{ d.mounted }}
        <div class="flex-grow" />

        <span class="whitespace-normal text-[hsla(0,0%,100%,.7)]" style="font-size: 14px">
          {{ d.selectedPath }}
        </span>
      </v-list-item-title>
      <v-progress-linear class="my-2 p-0" :value="(d.used / (d.available + d.used)) * 100" />
      <v-list-item-subtitle class="flex">
        <span class="">
          {{ t('disk.available') }}: {{ (d.available / 1024 / 1024 / 1024).toFixed(2) }}G
          {{ t('disk.used') }}: {{ (d.used / 1024 / 1024 / 1024).toFixed(2) }}G
        </span>
        <div class="flex-grow" />
        <span>
          {{ d.capacity }}
        </span>
      </v-list-item-subtitle>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { Drive, InvalidDirectoryErrorCode } from '@xmcl/runtime-api'

const props = defineProps<{
  defaultPath: string
  drives: Drive[]
  modelValue: string
  error: InvalidDirectoryErrorCode
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', path: string): void
}>()
const { showOpenDialog } = windowController
const { t } = useI18n()

const getDataDirErrorText = useGetDataDirErrorText()

const errorText = computed(() => getDataDirErrorText(props.error))
async function browse() {
  const { filePaths } = await showOpenDialog({
    title: t('shared.browse'),
    defaultPath: props.modelValue,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (filePaths && filePaths.length !== 0) {
    emit('update:modelValue', filePaths[0])
  }
}
function onSelect(drive: Drive) {
  emit('update:modelValue', drive.selectedPath)
}
function restore() {
  emit('update:modelValue', props.defaultPath)
}
</script>
