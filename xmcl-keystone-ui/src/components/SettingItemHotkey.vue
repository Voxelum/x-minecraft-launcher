<template>
  <SettingItem :description="description">
    <template #title>
      <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
      {{ title }}
    </template>
    <template #action>
      <div class="flex items-center gap-2">
        <v-btn
          :color="recording ? 'warning' : 'primary'"
          variant="tonal"
          size="small"
          class="font-mono text-caption min-w-[120px]"
          @click="toggleRecording"
        >
          <v-icon start size="x-small">{{ recording ? 'keyboard' : 'edit' }}</v-icon>
          {{ recording ? t('setting.pressKeyToRecord') : displayShortcut }}
        </v-btn>
        <v-btn
          v-if="modelValue"
          v-shared-tooltip.bottom="() => t('setting.resetShortcut')"
          icon
          variant="text"
          size="small"
          color="error"
          @click="reset"
        >
          <v-icon size="small">restart_alt</v-icon>
        </v-btn>
      </div>
    </template>
  </SettingItem>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import SettingItem from './SettingItem.vue'
import { formatShortcutDisplay, eventToShortcutString } from '@/util/shortcut'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const { t } = useI18n()

const props = defineProps<{
  title: string
  description?: string
  icon?: string
  modelValue?: string
  defaultShortcut?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const recording = ref(false)

const displayShortcut = computed(() => {
  if (props.modelValue) {
    return formatShortcutDisplay(props.modelValue)
  }
  return formatShortcutDisplay(props.defaultShortcut || 'Ctrl+Shift+C')
})

function onKeyDown(e: KeyboardEvent) {
  if (!recording.value) return

  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    recording.value = false
    window.removeEventListener('keydown', onKeyDown, true)
    return
  }

  const shortcut = eventToShortcutString(e)
  if (shortcut) {
    emit('update:modelValue', shortcut)
    recording.value = false
    window.removeEventListener('keydown', onKeyDown, true)
  }
}

function toggleRecording() {
  if (recording.value) {
    recording.value = false
    window.removeEventListener('keydown', onKeyDown, true)
  } else {
    recording.value = true
    window.addEventListener('keydown', onKeyDown, true)
  }
}

function reset() {
  emit('update:modelValue', '')
  if (recording.value) {
    recording.value = false
    window.removeEventListener('keydown', onKeyDown, true)
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, true)
})
</script>
