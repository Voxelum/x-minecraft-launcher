<template>
  <v-dialog
    v-model="shown"
    width="800"
    max-width="95vw"
    scrollable
    transition="dialog-top-transition"
  >
    <div class="omni-surface" :class="`omni-surface--${mode}`">
      <div class="omni-input-card">
        <v-textarea
          ref="inputRef"
          v-model="activeInput"
          :data-testid="mode === 'command' ? 'command-palette-input' : 'agent-input'"
          :placeholder="inputPlaceholder"
          :disabled="inputDisabled"
          :readonly="inputReadonly"
          variant="plain"
          density="comfortable"
          hide-details
          auto-grow
          rows="1"
          :max-rows="mode === 'agent' ? 6 : 1"
          class="omni-input"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @keydown="onInputKeydown"
        >
          <template v-if="mode === 'agent'" #append-inner>
            <v-btn
              v-if="!agentRunning"
              icon="send"
              size="small"
              variant="text"
              color="primary"
              :disabled="inputDisabled || !activeInput.trim()"
              @click="sendAgentInput"
            />
            <v-btn
              v-else
              data-testid="agent-abort"
              icon="stop"
              size="small"
              variant="text"
              color="error"
              :title="t('agent.abort')"
              :aria-label="t('agent.abort')"
              @click="agentPanel?.abort()"
            />
          </template>
        </v-textarea>
        <v-divider />
        <div class="omni-mode-controls">
          <v-btn-toggle
            v-model="mode"
            density="compact"
            variant="outlined"
            color="primary"
            mandatory
            divided
          >
            <v-btn value="command" size="x-small">
              <v-icon size="small" start>search</v-icon>
              {{ t('commandPalette.commands') }}
            </v-btn>
            <v-btn v-if="agentEnabled" value="agent" size="x-small">
              <v-icon size="small" start>smart_toy</v-icon>
              {{ t('agent.title') }}
            </v-btn>
          </v-btn-toggle>
          <div id="omni-mode-specific-controls" class="omni-mode-specific-controls" />
        </div>
      </div>
      <AppCommandPalette
        ref="commandPanel"
        v-show="mode === 'command'"
        :agent-enabled="agentEnabled"
      />
      <AppAgentChat
        v-if="agentEnabled"
        ref="agentPanel"
        v-show="mode === 'agent'"
      />
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useOmniDialog } from '@/composables/omniDialog'
import { shouldSubmitAgentInput } from '@/composables/agent/input'
import AppAgentChat from '@/views/AppAgentChat.vue'
import AppCommandPalette from '@/views/AppCommandPalette.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  agentEnabled: boolean
}>()

const { t } = useI18n()
const { shown, mode, commandInput, agentInput, open, close } = useOmniDialog()
const commandPanel = ref<InstanceType<typeof AppCommandPalette> | null>(null)
const agentPanel = ref<InstanceType<typeof AppAgentChat> | null>(null)
const inputRef = ref<{ $el: HTMLElement } | null>(null)
const composing = ref(false)

const activeInput = computed({
  get: () => mode.value === 'command' ? commandInput.value : agentInput.value,
  set: value => {
    if (mode.value === 'command') commandInput.value = value
    else agentInput.value = value
  },
})
const agentAvailable = computed(() => agentPanel.value?.available ?? false)
const agentRunning = computed(() => agentPanel.value?.running ?? false)
const inputDisabled = computed(() => mode.value === 'agent' && !agentAvailable.value)
const inputReadonly = computed(() => mode.value === 'command' && (commandPanel.value?.inputReadonly ?? false))
const inputPlaceholder = computed(() => mode.value === 'command'
  ? t('commandPalette.placeholder')
  : agentAvailable.value ? t('agent.inputPlaceholder') : t('agent.disabledPlaceholder'))

function sendAgentInput() {
  void agentPanel.value?.send()
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (mode.value === 'agent') {
    if (!shouldSubmitAgentInput(event, composing.value)) return
    event.preventDefault()
    sendAgentInput()
    return
  }
  if (event.altKey && event.key === 'Enter') {
    event.preventDefault()
    commandPanel.value?.askAi()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    commandPanel.value?.moveSelection(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'ArrowRight') {
    commandPanel.value?.onArrowForward(event)
  } else if (event.key === 'ArrowLeft') {
    commandPanel.value?.onArrowBack(event)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    commandPanel.value?.invokeSelected()
  }
}

watch(() => props.agentEnabled, (enabled) => {
  if (!enabled && mode.value === 'agent') close()
})

watch([shown, mode], async ([visible]) => {
  if (!visible) return
  await nextTick()
  requestAnimationFrame(() => {
    inputRef.value?.$el.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')?.focus()
  })
})
</script>

<style scoped>
.omni-surface {
  display: flex;
  width: 100%;
  height: 85vh;
  max-height: 85vh;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  --surface-blur: 0px;
  --surface-border: none;
  --surface-shadow: none;
  --surface-bg: transparent;
  --surface-dialog-radius: 0px;
  --omni-content-width: 720px;
  transform: translateY(clamp(24px, 5vh, 48px));
  background: transparent !important;
}

.omni-surface--command {
  align-items: center;
}

.omni-input-card {
  width: var(--omni-content-width);
  max-width: 100%;
  flex: 0 0 auto;
  align-self: center;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.22);
}

.omni-input {
  padding: 6px 10px 3px;
}

.omni-input :deep(textarea) {
  font-size: 13px;
  line-height: 1.45;
}

.omni-mode-controls {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.omni-mode-specific-controls {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
}

@media (max-width: 700px) {
  .omni-surface {
    width: 100%;
    max-width: 100%;
  }
}
</style>