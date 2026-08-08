<template>
  <div data-testid="agent-dialog" class="agent-surface">
      <!-- Disabled state -->
      <div
        v-if="!available"
        class="agent-disabled-card"
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
        </div>
      </div>

      <!-- Transcript -->
      <div
        v-else
        ref="scrollEl"
        data-testid="agent-transcript"
        class="agent-transcript"
        @scroll.passive="onTranscriptScroll"
      >
        <div
          v-if="transcriptItems.length === 0 && !displayError"
          class="agent-empty-wrap"
        >
          <div class="agent-empty-card">
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
          <!-- User -->
          <div v-if="item.kind === 'message' && item.message.role === 'user'" class="flex justify-end">
            <div class="bubble bubble-user">
              {{ messageText(item.message.content) }}
            </div>
          </div>

          <!-- Assistant text -->
          <div
            v-else-if="item.kind === 'message' && item.message.role === 'assistant' && messageText(item.message.content)"
            class="flex justify-start"
          >
            <div
              class="bubble bubble-assistant md-content"
              v-html="renderAssistant(item.message.content)"
            />
          </div>

          <div v-else-if="item.kind === 'reasoning'" class="flex justify-start">
            <button
              v-shared-tooltip.top="() => ({ text: item.content, ariaLabel: t('agent.reasoning') })"
              type="button"
              class="agent-reasoning"
              :class="{ 'agent-reasoning--running': running && item.key === latestReasoningKey }"
            >
              <v-icon size="16">psychology</v-icon>
              <span>{{ t('agent.reasoning') }}</span>
            </button>
          </div>

          <div v-else-if="item.kind === 'passive'" class="flex justify-start">
            <AgentPassiveEventCard :event="item.event" />
          </div>

          <!-- Tool call and its result -->
          <div
            v-else-if="item.kind === 'tool'"
            class="flex justify-start"
          >
            <AgentToolCall :item="item" />
          </div>
        </template>

        <!-- Live progress -->
        <div v-if="running" class="flex justify-start">
          <div data-testid="agent-live-status" class="agent-live-card">
            <v-progress-circular indeterminate size="14" width="2" />
            <span>{{ liveStatus }}</span>
          </div>
        </div>

        <!-- User confirmation -->
        <div v-if="confirmationShown" class="flex justify-start">
          <div data-testid="agent-confirm-dialog" class="agent-confirm">
            <div class="agent-confirm__header">
              <div
                class="agent-confirm__icon"
                :class="{ 'agent-confirm__icon--destructive': confirmationRequest?.destructive }"
              >
                <v-icon size="18">{{ confirmationRequest?.destructive ? 'delete_outline' : 'priority_high' }}</v-icon>
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
            <div v-if="confirmationRequest?.presentations?.length" class="agent-confirm__presentations">
              <AgentMarketList
                v-for="presentation in confirmationRequest.presentations"
                :key="presentation.source"
                :presentation="presentation"
                readonly
              />
            </div>
            <div class="agent-confirm__actions">
              <v-btn data-testid="agent-confirm-cancel" size="small" variant="text" @click="declineConfirmation">
                {{ t('agent.confirmCancel') }}
              </v-btn>
              <v-btn
                v-if="confirmationRequest?.allowAll"
                data-testid="agent-confirm-allow-all"
                size="small"
                variant="text"
                @click="allowAllConfirmations"
              >
                {{ t('agent.confirmAllowAll') }}
              </v-btn>
              <v-btn
                data-testid="agent-confirm-accept"
                size="small"
                :color="confirmationRequest?.destructive ? 'error' : 'primary'"
                variant="flat"
                :prepend-icon="confirmationRequest?.destructive ? 'delete_outline' : 'check'"
                @click="acceptConfirmation"
              >
                {{ confirmationRequest?.confirmLabel || t('agent.confirmAccept') }}
              </v-btn>
            </div>
          </div>
        </div>

        <!-- Failures belong in the transcript: they are part of the conversation
             and are easy to miss tucked into the footer. -->
        <div v-if="displayError && !running" data-testid="agent-error" class="flex justify-start">
          <div class="agent-error">
            <v-icon size="small" color="error" class="agent-error__icon">error_outline</v-icon>
            <div class="min-w-0 flex-1">
              <div class="agent-error__title">
                {{ t('agent.errorTitle') }}
              </div>
              <div class="agent-error__body">
                {{ displayError }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Teleport v-if="isShown" defer to="#omni-mode-specific-controls">
        <div class="agent-mode-controls">
          <div class="agent-mode-meta text-xs text-medium-emphasis flex min-w-0 items-center gap-2">
            <span v-if="!available" class="agent-composer-status">{{ t('agent.statusDisabled') }}</span>
            <span v-else-if="developerMode" data-testid="agent-context-usage" class="tabular-nums" :title="contextUsageTitle">
              Context {{ contextUsageLabel }}
            </span>
            <v-spacer />
            <span v-if="displayError" class="text-error truncate" :title="displayError">{{ displayError }}</span>
          </div>
          <v-btn
            class="agent-new-conversation"
            icon="add_comment"
            size="small"
            variant="text"
            :disabled="running || !available"
            :title="t('agent.reset')"
            @click="startNewConversation"
          />
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                class="agent-selector"
                size="small"
                variant="text"
                :prepend-icon="selectedAgent === 'css' ? 'code' : 'smart_toy'"
                append-icon="arrow_drop_down"
                :aria-label="selectedAgent === 'css' ? t('setting.customCss.assistantTitle') : t('agent.title')"
              >
                {{ selectedAgent === 'css' ? t('setting.customCss.assistantTitle') : t('agent.title') }}
              </v-btn>
            </template>
            <v-list density="compact" nav min-width="180">
              <v-list-item
                data-testid="agent-switch-common"
                prepend-icon="smart_toy"
                :active="selectedAgent === 'common'"
                :aria-label="t('agent.title')"
                @click="selectedAgent = 'common'"
              >
                <v-list-item-title>{{ t('agent.title') }}</v-list-item-title>
              </v-list-item>
              <v-list-item
                data-testid="agent-switch-css"
                prepend-icon="code"
                :active="selectedAgent === 'css'"
                :aria-label="t('setting.customCss.assistantTitle')"
                @click="selectedAgent = 'css'"
              >
                <v-list-item-title>{{ t('setting.customCss.assistantTitle') }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
      </div>
      </Teleport>
  </div>
</template>

<script lang="ts" setup>
import AgentMarketList from '@/components/AgentMarketList.vue'
import AgentPassiveEventCard from '@/components/AgentPassiveEventCard.vue'
import AgentToolCall from '@/components/AgentToolCall.vue'
import { kAgent, useCssAgent } from '@/composables/agent'
import { useAgentConfirmation } from '@/composables/agent/confirm'
import { projectAgentTranscript } from '@/composables/agent/projection'
import { useAgentRouteReturn } from '@/composables/agent/routeReturn'
import { useAgentChatStatus, usePendingAgentKind } from '@/composables/agentChat'
import { useMarkdown } from '@/composables/markdown'
import { useOmniDialog } from '@/composables/omniDialog'
import { kSettingsState } from '@/composables/setting'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentContentPart as ContentPart } from '@xmcl/runtime-api'

const { t } = useI18n()

const commonAgent = injection(kAgent)
const { state: settingsState } = injection(kSettingsState)
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
const contextUsage = computed(() => activeAgent.value.contextUsage.value)
const developerMode = computed(() => settingsState.value?.developerMode ?? false)
const numberFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const contextUsageLabel = computed(() => {
  const { usedTokens, contextWindow } = contextUsage.value
  const used = usedTokens ? numberFormat.format(usedTokens) : '—'
  const percent = usedTokens ? ` (${Math.round(usedTokens / contextWindow * 100)}%)` : ''
  return `${used} / ${numberFormat.format(contextWindow)}${percent}`
})
const contextUsageTitle = computed(() => {
  const { usedTokens, contextWindow } = contextUsage.value
  return `${usedTokens.toLocaleString('en-US')} / ${contextWindow.toLocaleString('en-US')} tokens`
})

const { render: renderMd } = useMarkdown()
const chatStatus = useAgentChatStatus()
const isShown = chatStatus.shown
const input = useOmniDialog().agentInput
const lastError = ref('')
const scrollEl = ref<HTMLElement | null>(null)
const followTranscript = ref(true)

const pendingAgentKind = usePendingAgentKind()
// Select the requested agent and (for the common agent) load its conversation
// only on a fresh open, not while flipping tabs with the surface left open.
watch(isShown, (visible, wasVisible) => {
  if (!visible || wasVisible) return
  const kind = pendingAgentKind.value
  pendingAgentKind.value = 'common'
  if (kind === 'css') {
    selectedAgent.value = 'css'
  } else {
    selectedAgent.value = 'common'
    commonAgent.loadConversationForCurrentInstance()
  }
})

const transcriptItems = computed(() => projectAgentTranscript(messages.value))
const latestReasoningKey = computed(() => transcriptItems.value.findLast(item => item.kind === 'reasoning')?.key)
const {
  request: confirmationRequest,
  shown: confirmationShown,
  accept: acceptConfirmation,
  allowAll: allowAllConfirmations,
  decline: declineConfirmation,
} = useAgentConfirmation()

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
watch(selectedAgent, () => {
  lastError.value = ''
  followTranscript.value = true
})
watch(anyRunning, value => { chatStatus.running.value = value }, { immediate: true })

function messageText(content: string | ContentPart[] | null | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  return content.map((p) => (p.type === 'text' ? p.text : '[image]')).join('')
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

function quickSend(text: string) {
  input.value = text
  onSend()
}

function hide() { isShown.value = false }
function startNewConversation() {
  activeAgent.value.reset()
  lastError.value = ''
}
function abort() { activeAgent.value.abort() }

defineExpose({
  available,
  running,
  send: onSend,
  abort,
})

const { push } = useRouter()
function openSettings() {
  hide()
  push('/setting')
}

function onTranscriptScroll() {
  const el = scrollEl.value
  if (el) followTranscript.value = el.scrollHeight - el.scrollTop - el.clientHeight <= 32
}

function scrollTranscriptToBottom() {
  const el = scrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  followTranscript.value = true
}

// Follow new output and failures only while the user remains at the bottom.
watch([transcriptItems, events, confirmationShown, displayError], async () => {
  if (!followTranscript.value) return
  await nextTick()
  if (followTranscript.value) scrollTranscriptToBottom()
}, { deep: true })

watch(isShown, async (v) => {
  if (v) {
    followTranscript.value = true
    await nextTick()
    scrollTranscriptToBottom()
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
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
}
.bubble-user {
  background: rgba(var(--v-theme-primary), 0.9);
  color: rgb(var(--v-theme-on-primary));
  border-color: rgb(var(--v-theme-primary));
  border-bottom-right-radius: 4px;
  max-width: 85%;
}
.bubble-assistant {
  background: rgb(var(--v-theme-surface));
  border-color: rgba(var(--v-theme-on-surface), 0.18);
  border-bottom-left-radius: 4px;
  max-width: 95%;
}
.agent-reasoning {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 8px;
  border: 0;
  border-left: 2px solid rgba(var(--v-theme-primary), 0.45);
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.72);
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}
.agent-reasoning:hover,
.agent-reasoning:focus-visible,
.agent-reasoning--running {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.agent-reasoning:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.6);
  outline-offset: 2px;
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
.agent-surface {
  display: flex;
  width: var(--omni-content-width, 720px);
  height: auto;
  max-height: none;
  max-width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  align-self: center;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  overflow: hidden;
  --surface-blur: 0px;
  --surface-border: none;
  --surface-shadow: none;
  --surface-bg: transparent;
  --surface-dialog-radius: 0px;
  background: transparent !important;
  box-shadow: none !important;
}
.agent-empty-card,
.agent-disabled-card,
.agent-live-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.22);
}
.agent-mode-controls {
  display: flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.agent-mode-meta {
  flex: 1 1 260px;
}
.agent-new-conversation {
  margin-inline-start: auto;
}
.agent-composer-status {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-transcript {
  display: flex;
  width: calc(100% + 6px);
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  margin-inline: -3px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 3px;
  scrollbar-gutter: stable;
}
.agent-empty-wrap {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
}
.agent-empty-card {
  width: 100%;
  max-width: 420px;
  padding: 24px;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
.agent-disabled-card {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  text-align: center;
}
.agent-live-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 12px;
}
.agent-error {
  display: flex;
  max-width: 85%;
  min-width: 0;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 13px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-error), 0.5);
  background: rgba(var(--v-theme-error), 0.12);
}
.agent-error__icon {
  margin-top: 1px;
  flex-shrink: 0;
}
.agent-error__title {
  color: rgb(var(--v-theme-error));
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}
.agent-error__body {
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.8);
  font-size: 12.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.agent-confirm {
  display: flex;
  width: 78%;
  max-width: 640px;
  max-height: calc(100vh - 16px);
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
}
.agent-confirm__header {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  flex-shrink: 0;
  padding: 12px 13px 9px;
}
.agent-confirm__icon {
  display: flex;
  width: 32px;
  height: 32px;
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
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.agent-confirm__message {
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 12.5px;
  line-height: 1.45;
}
.agent-confirm__details {
  display: flex;
  max-height: 160px;
  min-height: 0;
  flex-direction: column;
  gap: 4px;
  margin: 0 13px 9px 54px;
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
.agent-confirm__presentations {
  display: flex;
  max-height: 280px;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  margin: 0 13px 9px;
  overflow: auto;
}
.agent-confirm__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.025);
}
@media (max-width: 700px) {
  .agent-mode-controls {
    gap: 4px;
  }
  .agent-composer-status {
    display: none;
  }
  .agent-confirm {
    width: 94%;
  }
  .agent-confirm__details {
    margin-left: 13px;
  }
  .agent-surface {
    width: 100%;
    max-width: 100%;
  }
}
</style>
