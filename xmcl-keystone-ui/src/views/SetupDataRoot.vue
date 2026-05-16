<template>
  <v-list
    data-testid="setup-data-root"
    class="setup-step-content"
    lines="three"
    bg-color="transparent"
  >
    <v-list-item class="px-6 pt-5">
      <v-list-item-title class="whitespace-pre-wrap">
        <div class="text-lg font-semibold mb-2">{{ t('setup.dataRoot.name') }}</div>
        {{ t('setup.dataRoot.description') }}
      </v-list-item-title>
    </v-list-item>
    <v-list-item class="px-6">
      <v-list-item-title>{{ t('setup.path') }}</v-list-item-title>
      <v-list-item-subtitle>{{ modelValue }}</v-list-item-subtitle>
      <template #append>
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <v-btn
            :disabled="modelValue === defaultPath"
            @click="restore"
            variant="tonal"
          >
            {{ t('setup.defaultPath') }}
          </v-btn>
          <v-btn color="primary" @click="browse" variant="flat">
            {{ t('shared.browse') }}
          </v-btn>
        </div>
      </template>
    </v-list-item>
    <v-alert v-if="error" class="mx-6 my-2" :type="error === 'exists' ? 'warning' : 'error'" variant="tonal">
      {{ errorText }}
    </v-alert>
    <v-list-subheader class="px-6 pt-2">
      {{ t('setup.dataRoot.drives') }}
    </v-list-subheader>
    <v-list-item
      v-for="d of drives"
      :key="d.mounted"
      v-ripple
      class="mx-6 mb-2 cursor-pointer rounded-xl border before:rounded-xl"
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
      <v-progress-linear class="my-2 p-0" :model-value="(d.used / (d.available + d.used)) * 100" />
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

<style scoped>
.setup-step-content :deep(.v-list-item) {
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.setup-step-content :deep(.v-list-item.v-list-item--active) {
  border-color: rgba(var(--v-theme-primary), 0.45) !important;
  background: rgba(var(--v-theme-primary), 0.1) !important;
}

.setup-step-content :deep(.v-list-item:not(.v-list-item--active)) {
  border-color: rgba(var(--v-theme-on-surface), 0.1);
}

.setup-step-content :deep(.v-list-item:not(.v-list-item--active):hover) {
  background: rgba(var(--v-theme-on-surface), 0.05) !important;
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.setup-step-content :deep(.v-list-item.v-list-item--active) {
  box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.14);
}

@media (prefers-reduced-motion: reduce) {
  .setup-step-content :deep(.v-list-item) {
    transition: none;
  }

  .setup-step-content :deep(.v-list-item:not(.v-list-item--active):hover) {
    transform: none;
  }
}
</style>
