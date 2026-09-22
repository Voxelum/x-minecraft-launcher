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
          <template #prepend-inner>
            <v-icon
              :color="mode === 'command' ? undefined : 'primary'"
              class="omni-input-icon"
              size="20"
            >
              {{ mode === 'command' ? 'search' : 'smart_toy' }}
            </v-icon>
          </template>
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
        <div class="omni-divider" />
        <div class="omni-mode-controls">
          <div
            class="omni-mode-tabs"
            role="tablist"
            :aria-label="t('commandPalette.commands')"
          >
            <button
              type="button"
              role="tab"
              data-testid="omni-tab-command"
              :aria-selected="mode === 'command'"
              class="omni-tab-btn"
              :class="{ 'omni-tab-btn--active': mode === 'command' }"
              @click="mode = 'command'"
            >
              <v-icon size="15" class="tab-icon">search</v-icon>
              <span>{{ t('commandPalette.commands') }}</span>
            </button>
            <button
              v-if="agentEnabled"
              type="button"
              role="tab"
              data-testid="omni-tab-agent"
              :aria-selected="mode === 'agent'"
              class="omni-tab-btn"
              :class="{ 'omni-tab-btn--active': mode === 'agent' }"
              @click="switchToAgentMode"
            >
              <v-icon size="15" class="tab-icon">smart_toy</v-icon>
              <span>{{ t('agent.title') }}</span>
              <span
                v-if="!agentAvailable"
                class="tab-status-dot"
                :title="t('agent.statusDisabled')"
              />
            </button>
          </div>
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
import { useNotifier } from '@/composables/notifier'
import AppAgentChat from '@/views/AppAgentChat.vue'
import AppCommandPalette from '@/views/AppCommandPalette.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  agentEnabled: boolean
}>()

const { t } = useI18n()
const { notify } = useNotifier()
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

function switchToAgentMode() {
  if (!props.agentEnabled) return
  if (commandInput.value.trim()) {
    agentInput.value = commandInput.value.trim()
  }
  mode.value = 'agent'
  if (!agentAvailable.value) {
    notify({
      title: t('agent.notConfiguredTitle'),
      body: t('agent.accessRequiredHint'),
      level: 'warning',
    })
  } else if (agentInput.value.trim()) {
    void nextTick(() => {
      sendAgentInput()
    })
  }
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
    switchToAgentMode()
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
  gap: 10px;
  --surface-blur: 0px;
  --surface-border: none;
  --surface-shadow: none;
  --surface-bg: transparent;
  --surface-dialog-radius: 0px;
  --omni-content-width: 740px;
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
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.94) !important;
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(var(--v-theme-on-surface), 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.omni-input-card:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.45);
  box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(var(--v-theme-primary), 0.25);
}

.omni-input {
  padding: 8px 14px 4px;
}

.omni-input-icon {
  margin-top: 4px;
  margin-right: 4px;
  opacity: 0.55;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.omni-input-card:focus-within .omni-input-icon {
  opacity: 0.9;
}

.omni-input :deep(textarea) {
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

.omni-divider {
  height: 1px;
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.omni-mode-controls {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.omni-mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  flex-shrink: 0;
}

.omni-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 0.775rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.65);
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
  background: transparent;
  border: none;
  outline: none;
}

.omni-tab-btn:hover:not(.omni-tab-btn--active) {
  color: rgba(var(--v-theme-on-surface), 0.95);
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.omni-tab-btn--active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.14);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.omni-tab-btn--active .tab-icon {
  color: rgb(var(--v-theme-primary));
}

.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #f59e0b;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  flex-shrink: 0;
  margin-left: 2px;
}

.omni-mode-specific-controls {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .omni-surface {
    width: 100%;
    max-width: 100%;
  }
}
</style>