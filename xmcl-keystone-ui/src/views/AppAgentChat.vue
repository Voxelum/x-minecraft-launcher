<template>
  <v-dialog
    v-model="isShown"
    width="800"
    max-width="95vw"
    scrollable
  >
    <v-card class="agent-card flex h-[85vh] max-h-[85vh] flex-col overflow-hidden">
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
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3"
      >
        <div
          v-if="visibleMessages.length === 0"
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

        <template v-for="(msg, i) in visibleMessages" :key="i">
          <!-- Launcher context notice (injected as a user turn for the LLM) -->
          <div v-if="msg.role === 'user' && isLauncherNotice(msg.content)" class="flex justify-center">
            <div class="notice">
              <v-icon size="13" class="mr-1 flex-shrink-0">info</v-icon>
              <span>{{ noticeText(msg.content) }}</span>
            </div>
          </div>

          <!-- User -->
          <div v-else-if="msg.role === 'user'" class="flex justify-end">
            <div class="bubble bubble-user">
              {{ messageText(msg.content) }}
            </div>
          </div>

          <!-- Assistant text -->
          <div v-else-if="msg.role === 'assistant' && msg.content" class="flex justify-start">
            <div
              class="bubble bubble-assistant md-content"
              v-html="renderAssistant(msg.content)"
            />
          </div>

          <!-- Assistant tool calls -->
          <div
            v-else-if="msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0"
            class="flex justify-start"
          >
            <div class="w-full">
              <div
                v-for="call in msg.tool_calls"
                :key="call.id"
                class="tool-call"
              >
                <v-icon size="small" class="mr-1 flex-shrink-0">build</v-icon>
                <code class="text-xs flex-shrink-0">{{ call.function.name }}</code>
                <span
                  v-if="call.function.arguments && call.function.arguments !== '{}'"
                  class="text-xs text-medium-emphasis ml-2 truncate flex-1 min-w-0"
                >
                  {{ call.function.arguments }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tool result (collapsed) -->
          <div v-else-if="msg.role === 'tool'" class="flex justify-start">
            <details class="bubble bubble-tool w-full">
              <summary class="cursor-pointer text-xs flex items-center gap-1 min-w-0">
                <v-icon size="x-small" class="flex-shrink-0">arrow_drop_down</v-icon>
                <code class="flex-shrink-0">{{ msg.name }}</code>
                <span class="text-medium-emphasis truncate min-w-0 flex-1">
                  {{ toolResultPreview(msg.content) }}
                </span>
              </summary>
              <pre class="mt-2 text-xs whitespace-pre-wrap break-all">{{ messageText(msg.content) }}</pre>
            </details>
          </div>
        </template>

        <!-- Live progress -->
        <div v-if="running" class="flex items-center gap-2 text-xs text-medium-emphasis pl-2">
          <v-progress-circular indeterminate size="14" width="2" />
          <span>{{ liveStatus }}</span>
        </div>
      </div>

      <!-- Input -->
      <div v-if="available" class="border-t p-3">
        <v-textarea
          v-model="input"
          :placeholder="available ? t('agent.inputPlaceholder') : t('agent.disabledPlaceholder')"
          :disabled="!available || running"
          variant="outlined"
          density="comfortable"
          hide-details
          auto-grow
          rows="1"
          max-rows="6"
          @keydown.enter.exact.prevent="onSend"
          @keydown.esc="hide"
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
          <span v-if="lastError" class="text-error truncate">{{ lastError }}</span>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kAgent, useCssAgent } from '@/composables/agent'
import { useAgentChatBus, useAgnesSetupDocUrl } from '@/composables/agentChat'
import { kCustomCss } from '@/composables/customCss'
import { kTheme } from '@/composables/theme'
import { useMarkdown } from '@/composables/markdown'
import { injection } from '@/util/inject'
import { computed, nextTick, ref, watch } from 'vue'
import type { ContentPart } from '@/composables/agent'

const { t } = useI18n()

const commonAgent = injection(kAgent)

// A global-scope CSS assistant shown side-by-side with the common agent and
// switchable from the dialog header. Reuses the global CSS conversation key so
// it continues the same thread used on the settings page.
const globalCustomCss = injection(kCustomCss)
const themeCtx = injection(kTheme)
const cssAgent = useCssAgent({
  context: {
    getCss: () => globalCustomCss.css.value,
    setCss: (v) => globalCustomCss.save(v),
    getEnabled: () => themeCtx.customCssEnabled.value,
    setEnabled: (v) => { themeCtx.customCssEnabled.value = v },
  },
  storageKey: 'cssAgentConversationV1',
})

const selectedAgent = ref<'common' | 'css'>('common')
const activeAgent = computed(() => (selectedAgent.value === 'css' ? cssAgent : commonAgent))

const available = computed(() => activeAgent.value.available.value)
const running = computed(() => activeAgent.value.running.value)
const messages = computed(() => activeAgent.value.messages.value)
const events = computed(() => activeAgent.value.events.value)

const { render: renderMd } = useMarkdown()
const setupDocUrl = useAgnesSetupDocUrl()

const isShown = ref(false)
const input = ref('')
const lastError = ref('')
const scrollEl = ref<HTMLElement | null>(null)

const bus = useAgentChatBus()
bus.on((e) => {
  if (e === 'show') {
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

const visibleMessages = computed(() => messages.value.filter((m) => m.role !== 'system'))

const statusLabel = computed(() => {
  if (!available.value) return t('agent.statusDisabled')
  if (running.value) return t('agent.statusWorking')
  return t('agent.statusReady')
})

const liveStatus = computed(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    const e = events.value[i]
    if (e.type === 'tool_call' && e.toolCall) return t('agent.callingTool', { name: e.toolCall.name })
    if (e.type === 'assistant') return t('agent.thinking')
  }
  return t('agent.thinking')
})

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

function toolResultPreview(content: string | ContentPart[] | null | undefined): string {
  const text = messageText(content)
  if (text.length <= 80) return text
  return text.slice(0, 80) + '…'
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
function reset() {
  activeAgent.value.reset()
  lastError.value = ''
}
function abort() { activeAgent.value.abort() }

const { push } = useRouter()
function openSettings() {
  hide()
  push('/setting')
}
function openSetupDoc() {
  window.open(setupDocUrl.value, 'browser')
}

// Auto-scroll on new messages / events.
watch([visibleMessages, events], async () => {
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
.bubble-tool {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
  padding: 6px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.bubble-tool pre {
  margin: 0;
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.tool-call {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 8px;
  margin-bottom: 4px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
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
kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}
</style>
