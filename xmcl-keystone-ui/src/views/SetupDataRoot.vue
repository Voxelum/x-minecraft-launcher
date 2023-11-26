<template>
  <v-list
    class="non-moveable"
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="whitespace-pre-wrap">
          {{ t('setup.dataRoot.description') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ t('setup.path') }}</v-list-item-title>
        <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="self-center">
        <v-btn
          :disabled="value === defaultPath"
          outlined
          text
          style="margin-right: 10px;"
          @click="restore"
        >
          {{ t('setup.defaultPath') }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
        <v-btn
          outlined
          color="primary"
          text
          style="margin-right: 10px;"
          @click="browse"
        >
          {{ t('browse') }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-alert
      v-if="error"
      class="mx-2"
      :type="error === 'exists' ? 'warning' : 'error'"
    >
      {{ errorText }}
    </v-alert>
    <v-subheader>
      {{ t('setup.dataRoot.drives') }}
    </v-subheader>
    <v-list-item
      v-for="d of drives"
      :key="d.mounted"
      v-ripple
      class="m-2 mx-3 cursor-pointer rounded-lg before:rounded-lg hover:bg-[rgba(123,123,123,0.5)]"
      :class="{'v-list-item--active': d.selectedPath === value }"
      @click="onSelect(d)"
    >
      <v-list-item-avatar>
        <v-icon>storage</v-icon>
      </v-list-item-avatar>

      <v-list-item-content>
        <v-list-item-title class="flex w-full flex-grow-0 p-0 align-baseline">
          {{ d.mounted }}
          <div class="flex-grow" />

          <span
            class="whitespace-normal text-[hsla(0,0%,100%,.7)]"
            style="font-size: 14px;"
          >
            {{ d.selectedPath }}
          </span>
        </v-list-item-title>
        <v-progress-linear
          class="my-2 p-0"
          :value="d.used / (d.available + d.used) * 100"
        />
        <v-list-item-subtitle class="flex">
          <span class="">
            {{ t('disk.available') }}:
            {{ (d.available / 1024 / 1024 / 1024).toFixed(2) }}G
            {{ t('disk.used') }}:
            {{ (d.used / 1024 / 1024 / 1024).toFixed(2) }}G
          </span>
          <div class="flex-grow" />
          <span>
            {{ d.capacity }}
          </span>
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { Drive } from '@xmcl/runtime-api'

const props = defineProps<{
  defaultPath: string
  drives: Drive[]
  value: string
  error: '' | 'noperm' | 'bad' | 'nondictionary' | 'exists'
}>()
const emit = defineEmits<{
  (event: 'input', path: string): void
}>()
const { showOpenDialog } = windowController
const { t } = useI18n()

const errorText = computed(() => {
  if (!props.error) {
    return ''
  }
  if (props.error === 'bad') {
    return t('setup.error.badDataRoot')
  }
  if (props.error === 'nondictionary') {
    return t('setup.error.nonDictionary')
  }
  if (props.error === 'noperm') {
    return t('setup.error.noPermission')
  }
  return t('setup.error.exists')
})
async function browse() {
  const { filePaths } = await showOpenDialog({
    title: t('browse'),
    defaultPath: props.value,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (filePaths && filePaths.length !== 0) {
    emit('input', filePaths[0])
  }
}
function onSelect(drive: Drive) {
  emit('input', drive.selectedPath)
}
function restore() {
  emit('input', props.defaultPath)
}
</script>
