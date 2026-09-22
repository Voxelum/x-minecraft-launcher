<template>
  <div data-testid="agent-dialog" class="agent-surface">
      <!-- Disabled state -->
      <div
        v-if="!available"
        class="agent-disabled-wrapper flex items-center justify-center flex-1 p-6"
      >
        <div class="agent-setup-card relative overflow-hidden flex flex-col items-center text-center p-8 max-w-lg w-full rounded-2xl">
          <!-- Ambient warm glow -->
          <div class="agent-setup-glow pointer-events-none" />

          <!-- Icon badge -->
          <div class="agent-setup-icon-badge flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 p-4 shadow-lg shadow-amber-950/40 mb-4">
            <v-icon size="36">smart_toy</v-icon>
          </div>

          <h2 class="text-xl font-bold tracking-tight mb-2">
            {{ t('agent.notConfiguredTitle') }}
          </h2>

          <p class="text-sm opacity-75 max-w-sm mb-6 leading-relaxed">
            {{ t('agent.accessRequiredHint') }}
          </p>

          <!-- 2 Action Option Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
            <!-- Option 1: Subscribe / Official Cloud -->
            <button
              type="button"
              data-testid="agent-subscribe-btn"
              class="agent-option-card agent-option-card--primary"
              @click="openSubscription"
            >
              <div class="agent-option-icon">
                <v-icon size="24" color="amber">workspace_premium</v-icon>
              </div>
              <div class="agent-option-info">
                <div class="agent-option-title">{{ t('agent.subscribeXmcl') }}</div>
                <div class="agent-option-desc">XMCL Cloud AI</div>
              </div>
              <v-icon size="16" class="agent-option-arrow">arrow_forward</v-icon>
            </button>

            <!-- Option 2: Settings / Custom Provider -->
            <button
              type="button"
              data-testid="agent-settings-btn"
              class="agent-option-card agent-option-card--secondary"
              @click="openSettings"
            >
              <div class="agent-option-icon">
                <v-icon size="24" color="primary">settings</v-icon>
              </div>
              <div class="agent-option-info">
                <div class="agent-option-title">{{ t('agent.openSettings') }}</div>
                <div class="agent-option-desc">OpenAI, Claude, Ollama...</div>
              </div>
              <v-icon size="16" class="agent-option-arrow">arrow_forward</v-icon>
            </button>
          </div>
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
            <span v-if="!available" class="agent-status-pill agent-status-pill--disabled">
              <v-icon size="13" class="mr-1">warning_amber</v-icon>
              {{ t('agent.statusDisabled') }}
            </span>
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
import { useAgentSettings } from '@/composables/agent/settings'
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
const agentSettings = useAgentSettings()
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
// Select the requested agent, load its conversation, then scroll to the latest
// message — all in one watcher so the scroll happens after the async load.
watch(isShown, async (visible, wasVisible) => {
  if (!visible || wasVisible) return
  await agentSettings.refreshStatus().catch((error) => {
    lastError.value = error instanceof Error ? error.message : String(error)
  })
  const kind = pendingAgentKind.value
  pendingAgentKind.value = 'common'
  if (kind === 'css') {
    selectedAgent.value = 'css'
  } else {
    selectedAgent.value = 'common'
    await commonAgent.loadConversationForCurrentInstance()
  }
  followTranscript.value = true
  await nextTick()
  scrollTranscriptToBottom()
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
  push({ path: '/setting', query: { target: 'agent' } })
}
function openSubscription() {
  hide()
  push({ path: '/multiplayer', query: { target: 'billing' } })
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
.agent-disabled-wrapper {
  min-height: 100%;
}

.agent-setup-card {
  background: rgba(var(--v-theme-surface), 0.94) !important;
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(var(--v-theme-on-surface), 0.04);
}

.agent-setup-glow {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 240px;
  height: 160px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(249, 115, 22, 0.08) 50%, transparent 70%);
  filter: blur(36px);
}

.agent-setup-icon-badge {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.agent-setup-icon-badge:hover {
  transform: scale(1.08) rotate(4deg);
}

.agent-option-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
  width: 100%;
  color: inherit;
}

.agent-option-card:hover {
  transform: translateY(-2px);
  background: rgba(var(--v-theme-on-surface), 0.07);
  box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.25);
}

.agent-option-card:active {
  transform: translateY(0);
}

.agent-option-card--primary:hover {
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 8px 20px -4px rgba(245, 158, 11, 0.2);
}

.agent-option-card--secondary:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 8px 20px -4px rgba(var(--v-theme-primary), 0.2);
}

.agent-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  flex-shrink: 0;
}

.agent-option-info {
  flex: 1;
  min-width: 0;
}

.agent-option-title {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.25;
  color: rgb(var(--v-theme-on-surface));
}

.agent-option-desc {
  font-size: 0.725rem;
  opacity: 0.6;
  margin-top: 2px;
  line-height: 1.2;
}

.agent-option-arrow {
  opacity: 0.4;
  transition: transform 0.2s ease, opacity 0.2s ease;
  flex-shrink: 0;
}

.agent-option-card:hover .agent-option-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.agent-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.725rem;
  font-weight: 500;
  white-space: nowrap;
}

.agent-status-pill--disabled {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
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
