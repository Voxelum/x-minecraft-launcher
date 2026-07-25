<template>
  <details data-testid="agent-tool-call" class="agent-tool">
    <summary class="agent-tool__summary">
      <v-icon size="16" class="agent-tool__chevron">chevron_right</v-icon>
      <v-icon size="16" class="flex-shrink-0">build</v-icon>
      <code class="agent-tool__name">{{ item.call.name }}</code>
      <span v-if="argumentPreview" class="agent-tool__preview">{{ argumentPreview }}</span>
      <v-spacer />
      <v-progress-circular
        v-if="!item.result"
        indeterminate
        size="14"
        width="2"
        class="flex-shrink-0"
      />
      <v-icon
        v-else
        :color="item.result.isError ? 'error' : 'success'"
        size="15"
        class="flex-shrink-0"
      >
        {{ item.result.isError ? 'error_outline' : 'check_circle' }}
      </v-icon>
    </summary>
    <div class="agent-tool__content">
      <div v-if="hasArguments" class="agent-tool__section">
        <div class="agent-tool__label">{{ t('agent.toolArguments') }}</div>
        <pre>{{ JSON.stringify(item.call.arguments, null, 2) }}</pre>
      </div>
      <div class="agent-tool__section">
        <div class="agent-tool__label">{{ t('agent.toolResult') }}</div>
        <pre :class="{ 'text-error': item.result?.isError }">{{ resultText }}</pre>
      </div>
    </div>
  </details>
</template>

<script lang="ts" setup>
import type { AgentTranscriptItem } from '@/composables/agent/projection'

const props = defineProps<{
  item: Extract<AgentTranscriptItem, { kind: 'tool' }>
}>()

const { t } = useI18n()
const hasArguments = computed(() => Object.keys(props.item.call.arguments).length > 0)
const argumentPreview = computed(() => {
  if (!hasArguments.value) return ''
  const value = JSON.stringify(props.item.call.arguments)
  return value.length > 110 ? `${value.slice(0, 110)}...` : value
})
const resultText = computed(() => {
  if (!props.item.result) return t('agent.toolRunning')
  const content = props.item.result.content
  if (typeof content === 'string') return content
  return content?.map(part => part.type === 'text' ? part.text ?? '' : '[image]').join('') ?? ''
})
</script>

<style scoped>
.agent-tool {
  width: 100%;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.055);
  overflow: hidden;
}
.agent-tool__summary {
  display: flex;
  align-items: center;
  min-height: 34px;
  gap: 6px;
  padding: 3px 8px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.agent-tool__summary::-webkit-details-marker {
  display: none;
}
.agent-tool__chevron {
  transition: transform 0.15s ease;
}
.agent-tool[open] .agent-tool__chevron {
  transform: rotate(90deg);
}
.agent-tool__name {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
}
.agent-tool__preview {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}
.agent-tool__content {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding: 8px;
}
.agent-tool__section + .agent-tool__section {
  margin-top: 7px;
}
.agent-tool__label {
  margin-bottom: 4px;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
pre {
  max-height: 240px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
