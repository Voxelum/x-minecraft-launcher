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
          class="font-mono text-caption min-w-[140px]"
          @click="toggleRecording"
        >
          <v-icon start size="x-small">{{ recording ? 'keyboard' : 'edit' }}</v-icon>
          {{ recordingText }}
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
import { formatShortcutDisplay } from '@/util/shortcut'
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
const pendingShortcut = ref('')

const displayShortcut = computed(() => {
  if (props.modelValue) {
    return formatShortcutDisplay(props.modelValue)
  }
  return formatShortcutDisplay(props.defaultShortcut || 'Ctrl+Shift+C')
})

const recordingText = computed(() => {
  if (!recording.value) return displayShortcut.value
  if (pendingShortcut.value) {
    return `${formatShortcutDisplay(pendingShortcut.value)}...`
  }
  return t('setting.pressKeyToRecord')
})

function getShortcutFromEvent(e: KeyboardEvent): { string: string; isComplete: boolean } | null {
  if (e.key === 'Escape') return null

  const isCtrl = e.ctrlKey || e.key === 'Control'
  const isAlt = e.altKey || e.key === 'Alt'
  const isShift = e.shiftKey || e.key === 'Shift'
  const isMeta = e.metaKey || e.key === 'Meta'

  const modifiers: string[] = []
  if (isCtrl) modifiers.push('Ctrl')
  if (isAlt) modifiers.push('Alt')
  if (isShift) modifiers.push('Shift')
  if (isMeta) modifiers.push('Meta')

  const uniqueMods = Array.from(new Set(modifiers))
  const isModifierKeyOnly = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta'

  if (isModifierKeyOnly) {
    return {
      string: uniqueMods.join('+'),
      isComplete: false,
    }
  }

  let mainKey = ''
  if (e.code.startsWith('Key')) {
    mainKey = e.code.replace('Key', '')
  } else if (e.code.startsWith('Digit')) {
    mainKey = e.code.replace('Digit', '')
  } else if (e.code.startsWith('Numpad')) {
    mainKey = e.code.replace('Numpad', 'Num')
  } else if (e.key.length === 1) {
    mainKey = e.key.toUpperCase()
  } else {
    mainKey = e.key
  }

  uniqueMods.push(mainKey)
  return {
    string: uniqueMods.join('+'),
    isComplete: true,
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!recording.value) return

  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    stopRecording()
    return
  }

  const result = getShortcutFromEvent(e)
  if (!result) return

  if (result.isComplete) {
    emit('update:modelValue', result.string)
    stopRecording()
  } else {
    pendingShortcut.value = result.string
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (!recording.value) return

  e.preventDefault()
  e.stopPropagation()

  if (pendingShortcut.value) {
    emit('update:modelValue', pendingShortcut.value)
    stopRecording()
  }
}

function startRecording() {
  recording.value = true
  pendingShortcut.value = ''
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
}

function stopRecording() {
  recording.value = false
  pendingShortcut.value = ''
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
}

function toggleRecording() {
  if (recording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function reset() {
  emit('update:modelValue', '')
  stopRecording()
}

onUnmounted(() => {
  stopRecording()
})
</script>
