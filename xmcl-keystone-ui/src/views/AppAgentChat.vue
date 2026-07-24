<template>
  <v-dialog
    v-model="isShown"
    width="800"
    max-width="95vw"
    scrollable
  >
    <v-card data-testid="agent-dialog" class="agent-card flex h-[85vh] max-h-[85vh] flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center gap-2 px-4 py-3 border-b">
        <v-btn-toggle
          v-model="selectedAgent"
          density="compact"
          variant="outlined"
          color="primary"
          mandatory
          divided
        >
          <v-btn value="common" size="small" data-testid="agent-switch-common">
            <v-icon size="small" start>auto_awesome</v-icon>
            {{ t('agent.title') }}
          </v-btn>
          <v-btn value="css" size="small" data-testid="agent-switch-css">
            <v-icon size="small" start>code</v-icon>
            {{ t('setting.customCss.assistantTitle') }}
          </v-btn>
        </v-btn-toggle>
        <div class="flex-1 truncate text-xs text-medium-emphasis">
          {{ statusLabel }}
        </div>
        <v-btn
          icon="restart_alt"
          size="small"
          variant="text"
          :disabled="running || !available"
          :title="t('agent.reset')"
          @click="reset"
        />
        <v-btn
          data-testid="agent-close"
          icon="close"
          size="small"
          variant="text"
          @click="hide"
        />
      </div>

      <!-- Disabled state -->
      <div
        v-if="!available"
        class="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-4 px-8"
      >
        <v-avatar size="72" color="warning" variant="tonal">
          <v-icon size="40">vpn_key_off</v-icon>
        </v-avatar>
        <div class="text-lg font-medium">
          {{ t('agent.notConfiguredTitle') }}
        </div>
        <div class="text-sm text-medium-emphasis max-w-xs">
          {{ t('agent.notConfiguredHint') }}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2 mt-1">
          <v-btn color="primary" variant="flat" prepend-icon="settings" @click="openSettings">
            {{ t('agent.openSettings') }}
          </v-btn>
          <v-btn variant="tonal" prepend-icon="open_in_new" @click="openSetupDoc">
            {{ t('agent.setupGuide') }}
          </v-btn>
        </div>
      </div>

      <!-- Transcript -->
      <div
        v-else
        ref="scrollEl"
        data-testid="agent-transcript"
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-2"
      >
        <div
          v-if="transcriptItems.length === 0"
          class="h-full flex items-center justify-center text-center text-medium-emphasis px-6"
        >
          <div class="w-full max-w-sm">
            <v-icon size="48" class="mb-3 opacity-50">forum</v-icon>
            <div class="text-sm">
              {{ emptyHint }}
            </div>
            <div class="mt-4 flex flex-col gap-2">
              <button
                v-for="s in suggestions"
                :key="s"
                type="button"
                class="suggestion-item"
                @click="quickSend(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>

        <template v-for="item in transcriptItems" :key="item.key">
          <!-- Launcher context notice (injected as a user turn for the LLM) -->
          <div
            v-if="item.kind === 'message' && item.message.role === 'user' && isLauncherNotice(item.message.content)"
            class="flex justify-center"
          >
            <div class="notice">
              <v-icon size="13" class="mr-1 flex-shrink-0">info</v-icon>
              <span>{{ noticeText(item.message.content) }}</span>
            </div>
          </div>

          <!-- User -->
          <div v-else-if="item.kind === 'message' && item.message.role === 'user'" class="flex justify-end">
            <div class="bubble bubble-user">
              {{ messageText(item.message.content) }}
            </div>
          </div>

          <!-- Assistant text -->
          <div
            v-else-if="item.kind === 'message' && item.message.role === 'assistant' && item.message.content"
            class="flex justify-start"
          >
            <div
              class="bubble bubble-assistant md-content"
              v-html="renderAssistant(item.message.content)"
            />
          </div>

          <!-- Tool call and its result -->
          <div
            v-else-if="item.kind === 'tool'"
            class="flex justify-start"
          >
            <div class="agent-tool-stack">
              <AgentToolCall :item="item" />
              <div
                v-if="item.presentation?.type === 'market-project-list'"
                class="agent-rich-message"
              >
                <div class="agent-rich-message__avatar">
                  <v-icon size="15">auto_awesome</v-icon>
                </div>
                <AgentMarketList
                  class="agent-rich-message__content"
                  :presentation="item.presentation"
                  @navigate="hide"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Live progress -->
        <div v-if="running" data-testid="agent-live-status" class="flex items-center gap-2 text-xs text-medium-emphasis pl-2">
          <v-progress-circular indeterminate size="14" width="2" />
          <span>{{ liveStatus }}</span>
        </div>
      </div>

      <!-- Input -->
      <div v-if="available" class="border-t p-3">
        <v-textarea
          v-model="input"
          data-testid="agent-input"
          :placeholder="available ? t('agent.inputPlaceholder') : t('agent.disabledPlaceholder')"
          :disabled="!available || running"
          variant="outlined"
          density="comfortable"
          hide-details
          auto-grow
          rows="1"
          max-rows="6"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @keydown.enter.exact="onInputEnter"
        >
          <template #append-inner>
            <v-btn
              v-if="!running"
              icon="send"
              size="small"
              variant="text"
              color="primary"
              :disabled="!available || !input.trim()"
              @click="onSend"
            />
            <v-btn
              v-else
              icon="stop"
              size="small"
              variant="text"
              color="error"
              @click="abort"
            />
          </template>
        </v-textarea>
        <div class="mt-2 text-xs text-medium-emphasis flex items-center gap-2">
          <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>A</kbd>
          <span>{{ t('agent.toggleHint') }}</span>
          <v-spacer />
          <span v-if="displayError" class="text-error truncate" :title="displayError">{{ displayError }}</span>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <v-dialog
    :model-value="confirmationShown"
    persistent
    width="500"
    max-width="92vw"
  >
    <v-card data-testid="agent-confirm-dialog" class="agent-confirm">
      <div class="agent-confirm__header">
        <div
          class="agent-confirm__icon"
          :class="{ 'agent-confirm__icon--destructive': confirmationRequest?.destructive }"
        >
          <v-icon size="21">{{ confirmationRequest?.destructive ? 'delete_outline' : 'priority_high' }}</v-icon>
        </div>
        <div class="min-w-0">
          <div class="agent-confirm__title">
            {{ confirmationRequest?.title || t('agent.confirmTitle') }}
          </div>
          <div class="agent-confirm__message">
            {{ confirmationRequest?.message }}
          </div>
        </div>
      </div>
      <div v-if="confirmationRequest?.details?.length" class="agent-confirm__details">
        <div v-for="detail in confirmationRequest.details" :key="detail" class="agent-confirm__detail">
          <v-icon size="15" class="flex-shrink-0">subdirectory_arrow_right</v-icon>
          <code>{{ detail }}</code>
        </div>
      </div>
      <div class="agent-confirm__actions">
        <v-btn data-testid="agent-confirm-cancel" variant="text" @click="declineConfirmation">
          {{ t('agent.confirmCancel') }}
        </v-btn>
        <v-btn
          data-testid="agent-confirm-accept"
          :color="confirmationRequest?.destructive ? 'error' : 'primary'"
          variant="flat"
          :prepend-icon="confirmationRequest?.destructive ? 'delete_outline' : 'check'"
          @click="acceptConfirmation"
        >
          {{ confirmationRequest?.confirmLabel || t('agent.confirmAccept') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import AgentMarketList from '@/components/AgentMarketList.vue'
import AgentToolCall from '@/components/AgentToolCall.vue'
import { kAgent, useCssAgent } from '@/composables/agent'
import { useAgentConfirmation } from '@/composables/agent/confirm'
import { getAgentEscapeAction, shouldSubmitAgentInput } from '@/composables/agent/input'
import { projectAgentTranscript } from '@/composables/agent/projection'
import { useAgentRouteReturn } from '@/composables/agent/routeReturn'
import { useAgentChatBus, useAgentChatStatus, useAgnesSetupDocUrl } from '@/composables/agentChat'
import { useMarkdown } from '@/composables/markdown'
import { injection } from '@/util/inject'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentContentPart as ContentPart } from '@xmcl/runtime-api'

const { t } = useI18n()

const commonAgent = injection(kAgent)
useAgentRouteReturn()

// A global-scope CSS assistant shown side-by-side with the common agent and
// switchable from the dialog header. Reuses the global CSS conversation key so
// it continues the same thread used on the settings page.
const cssAgent = useCssAgent()

const selectedAgent = ref<'common' | 'css'>('common')
const activeAgent = computed(() => (selectedAgent.value === 'css' ? cssAgent : commonAgent))

const available = computed(() => activeAgent.value.available.value)
const running = computed(() => activeAgent.value.running.value)
const anyRunning = computed(() => commonAgent.running.value || cssAgent.running.value)
const runError = computed(() => activeAgent.value.runError.value)
const messages = computed(() => activeAgent.value.messages.value)
const events = computed(() => activeAgent.value.events.value)

const { render: renderMd } = useMarkdown()
const setupDocUrl = useAgnesSetupDocUrl()

const chatStatus = useAgentChatStatus()
const isShown = chatStatus.shown
const input = ref('')
const composing = ref(false)
const lastError = ref('')
const scrollEl = ref<HTMLElement | null>(null)

const bus = useAgentChatBus()
bus.on((e) => {
  if (typeof e === 'object' && e.type === 'show') {
    selectedAgent.value = 'common'
    input.value = e.prompt ?? ''
    commonAgent.loadConversationForCurrentInstance()
    isShown.value = true
  }
  else if (e === 'show') {
    commonAgent.loadConversationForCurrentInstance()
    isShown.value = true
  }
  else if (e === 'show-css') {
    // Opened from the Custom CSS settings — jump straight to the CSS assistant.
    selectedAgent.value = 'css'
    isShown.value = true
  }
  else if (e === 'hide') isShown.value = false
  else {
    if (!isShown.value) {
      commonAgent.loadConversationForCurrentInstance()
    }
    isShown.value = !isShown.value
  }
})

const transcriptItems = computed(() => projectAgentTranscript(messages.value))
const {
  request: confirmationRequest,
  shown: confirmationShown,
  accept: acceptConfirmation,
  decline: declineConfirmation,
} = useAgentConfirmation()

const statusLabel = computed(() => {
  if (!available.value) return t('agent.statusDisabled')
  if (running.value) return t('agent.statusWorking')
  return t('agent.statusReady')
})

const liveStatus = computed(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    const e = events.value[i]
    if (e.type === 'tool_start' && e.toolCall) return t('agent.callingTool', { name: e.toolCall.name })
    if (e.type === 'tool_end' || e.type === 'message_delta') return t('agent.thinking')
  }
  return t('agent.thinking')
})
const displayError = computed(() => lastError.value || runError.value)

const suggestions = computed(() => (selectedAgent.value === 'css'
  ? [
    t('setting.customCss.assistantSuggestion1'),
    t('setting.customCss.assistantSuggestion2'),
  ]
  : [
    t('agent.suggestion1'),
    t('agent.suggestion2'),
    t('agent.suggestion3'),
  ]))

const emptyHint = computed(() => (selectedAgent.value === 'css'
  ? t('setting.customCss.assistantHint')
  : t('agent.emptyHint')))

// Clear any transient error when switching agents.
watch(selectedAgent, () => { lastError.value = '' })
watch(anyRunning, value => { chatStatus.running.value = value }, { immediate: true })

function messageText(content: string | ContentPart[] | null | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  return content.map((p) => (p.type === 'text' ? p.text : '[image]')).join('')
}

const LAUNCHER_NOTICE_PREFIX = '[launcher event]'
function isLauncherNotice(content: string | ContentPart[] | null | undefined): boolean {
  return messageText(content).trimStart().startsWith(LAUNCHER_NOTICE_PREFIX)
}
function noticeText(content: string | ContentPart[] | null | undefined): string {
  return messageText(content).replace(LAUNCHER_NOTICE_PREFIX, '').trim()
}

function renderAssistant(content: string | ContentPart[] | null | undefined): string {
  return renderMd(messageText(content))
}

async function onSend() {
  const text = input.value.trim()
  if (!text || running.value || !available.value) return
  input.value = ''
  lastError.value = ''
  try {
    await activeAgent.value.send(text)
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : String(err)
  }
}

function onInputEnter(event: KeyboardEvent) {
  if (!shouldSubmitAgentInput(event, composing.value)) return
  event.preventDefault()
  void onSend()
}

function quickSend(text: string) {
  input.value = text
  onSend()
}

function hide() { isShown.value = false }
function reset() {
  activeAgent.value.reset()
  lastError.value = ''
}
function abort() { activeAgent.value.abort() }

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!isShown.value || event.key !== 'Escape' || event.isComposing || composing.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (getAgentEscapeAction(running.value) === 'abort') abort()
  else hide()
}, { capture: true })

const { push } = useRouter()
function openSettings() {
  hide()
  push('/setting')
}
function openSetupDoc() {
  window.open(setupDocUrl.value, 'browser')
}

// Auto-scroll on new messages / events.
watch([transcriptItems, events], async () => {
  await nextTick()
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}, { deep: true })

watch(isShown, async (v) => {
  if (v) {
    await nextTick()
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
})
</script>

<style scoped>
.bubble {
  max-width: 100%;
  min-width: 0;
  padding: 9px 13px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
}
.bubble-user {
  background: rgba(var(--v-theme-primary), 0.9);
  color: rgb(var(--v-theme-on-primary));
  border-color: rgb(var(--v-theme-primary));
  border-bottom-right-radius: 4px;
  max-width: 85%;
}
.bubble-assistant {
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-color: rgba(var(--v-theme-on-surface), 0.26);
  border-bottom-left-radius: 4px;
  max-width: 95%;
}
.notice {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  max-width: 90%;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.16);
}
.md-content {
  white-space: normal;
}
.md-content :deep(> *:first-child) {
  margin-top: 0;
}
.md-content :deep(> *:last-child) {
  margin-bottom: 0;
}
.md-content :deep(p) {
  margin: 0 0 8px;
}
.md-content :deep(ul),
.md-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}
.md-content :deep(li) {
  margin: 2px 0;
}
.md-content :deep(li > ul),
.md-content :deep(li > ol) {
  margin: 2px 0;
}
.md-content :deep(h1),
.md-content :deep(h2),
.md-content :deep(h3),
.md-content :deep(h4) {
  margin: 10px 0 6px;
  font-weight: 600;
  line-height: 1.3;
}
.md-content :deep(h1) { font-size: 1.25em; }
.md-content :deep(h2) { font-size: 1.15em; }
.md-content :deep(h3) { font-size: 1.05em; }
.md-content :deep(h4) { font-size: 1em; }
.md-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: rgba(var(--v-theme-on-surface), 0.12);
  padding: 1px 4px;
  border-radius: 4px;
  word-break: break-word;
}
.md-content :deep(pre) {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  overflow-x: auto;
  max-width: 100%;
}
.md-content :deep(pre code) {
  background: transparent;
  padding: 0;
  white-space: pre;
  word-break: normal;
  font-size: 0.85em;
}
.md-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  word-break: break-word;
}
.md-content :deep(blockquote) {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.2);
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.md-content :deep(table) {
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 0 0 8px;
}
.md-content :deep(th),
.md-content :deep(td) {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  padding: 4px 8px;
  text-align: left;
}
.md-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  margin: 10px 0;
}
.md-content :deep(img) {
  max-width: 100%;
  height: auto;
}
.suggestion-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  cursor: pointer;
  white-space: normal;
  overflow-wrap: anywhere;
  transition: background 0.15s ease;
}
.suggestion-item:hover {
  background: rgba(var(--v-theme-primary), 0.18);
}
.agent-card {
  position: fixed;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 800px;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}
.agent-tool-stack {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 5px;
}
.agent-rich-message {
  display: flex;
  width: 78%;
  max-width: 640px;
  min-width: 0;
  align-items: flex-start;
  gap: 7px;
}
.agent-rich-message__avatar {
  display: flex;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  margin-top: 3px;
  border: 1px solid rgba(var(--v-theme-primary), 0.24);
  border-radius: 50%;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}
.agent-rich-message__content {
  min-width: 0;
  flex: 1;
}
.agent-confirm {
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 8px;
}
.agent-confirm__header {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: start;
  gap: 11px;
  padding: 16px 18px 12px;
}
.agent-confirm__icon {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.13);
}
.agent-confirm__icon--destructive {
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.13);
}
.agent-confirm__title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
}
.agent-confirm__message {
  margin-top: 3px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 13px;
  line-height: 1.45;
}
.agent-confirm__details {
  display: flex;
  max-height: 160px;
  flex-direction: column;
  gap: 4px;
  margin: 0 18px 12px 67px;
  overflow: auto;
}
.agent-confirm__detail {
  display: flex;
  min-height: 32px;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 6px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  background: rgba(var(--v-theme-on-surface), 0.055);
}
.agent-confirm__detail code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.agent-confirm__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.025);
}
@media (max-width: 700px) {
  .agent-rich-message {
    width: 94%;
  }
  .agent-confirm__details {
    margin-left: 18px;
  }
}
kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}
</style>
