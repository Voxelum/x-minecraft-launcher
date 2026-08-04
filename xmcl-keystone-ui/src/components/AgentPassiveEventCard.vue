<template>
  <div
    data-testid="agent-passive-event"
    class="agent-passive-event"
    :class="toneClass"
    :data-event-type="event.type"
  >
    <div class="agent-passive-event__icon">
      <v-icon :size="18">{{ icon }}</v-icon>
    </div>
    <div class="agent-passive-event__content">
      <div class="agent-passive-event__title">{{ title }}</div>
      <div class="agent-passive-event__summary">{{ summary }}</div>
      <div v-if="details.length" class="agent-passive-event__details">
        <div v-for="(detail, index) in details" :key="`${index}:${detail}`" class="agent-passive-event__detail">
          {{ detail }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AgentPassiveTranscriptEvent } from '@/composables/agent/projection'

const props = defineProps<{ event: AgentPassiveTranscriptEvent }>()
const { t } = useI18n()

function valueText(value: unknown, fallback = '-') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    : []
}

function durationText(value: unknown) {
  if (typeof value !== 'number') return '-'
  if (value < 1000) return `${value} ms`
  const seconds = value / 1000
  return `${seconds.toFixed(seconds < 10 && !Number.isInteger(seconds) ? 1 : 0)} s`
}

const crashed = computed(() => props.event.type === 'game-exit' && props.event.payload.crashed === true)
const diagnosisStatus = computed(() => valueText(props.event.payload.status, 'unknown'))
const incompatibilities = computed(() => records(props.event.payload.incompatibilities))
const duplicates = computed(() => records(props.event.payload.duplicates))

const title = computed(() => {
  if (props.event.type === 'game-start') return t('agent.passiveGameStarted')
  if (props.event.type === 'game-exit') return crashed.value ? t('agent.passiveGameCrashed') : t('agent.passiveGameExited')
  return t('agent.passiveModDiagnosis')
})

const icon = computed(() => {
  if (props.event.type === 'game-start') return 'sports_esports'
  if (props.event.type === 'game-exit') return crashed.value ? 'error_outline' : 'check_circle_outline'
  return diagnosisStatus.value === 'compatible' ? 'extension' : 'extension_off'
})

const toneClass = computed(() => ({
  'agent-passive-event--success': props.event.type === 'game-start' || diagnosisStatus.value === 'compatible',
  'agent-passive-event--warning': props.event.type === 'mod-diagnosis' && diagnosisStatus.value !== 'compatible',
  'agent-passive-event--error': crashed.value,
}))

const summary = computed(() => {
  const payload = props.event.payload
  if (props.event.type === 'game-start') {
    return t('agent.passiveGameStartedSummary', {
      minecraft: valueText(payload.minecraft),
      version: valueText(payload.version),
      pid: valueText(payload.pid),
    })
  }
  if (props.event.type === 'game-exit') {
    const result = payload.code !== undefined
      ? t('agent.passiveGameExitCode', { code: valueText(payload.code) })
      : payload.signal !== undefined
        ? t('agent.passiveGameExitSignal', { signal: valueText(payload.signal) })
        : t('agent.passiveGameExitUnknown')
    return t('agent.passiveGameExitSummary', { duration: durationText(payload.duration), result })
  }
  if (diagnosisStatus.value === 'error') return valueText(payload.error, t('agent.passiveModDiagnosisError'))
  return t('agent.passiveModDiagnosisSummary', {
    checked: valueText(payload.checkedMods, '0'),
    incompatibilities: incompatibilities.value.length,
    duplicates: duplicates.value.length,
  })
})

const details = computed(() => {
  if (props.event.type !== 'mod-diagnosis') return []
  const incompatibilityDetails = incompatibilities.value.map((item) => {
    const dependency = valueText(item.dependency)
    const required = item.required ? ` ${valueText(item.required)}` : ''
    const installed = item.installedVersion ? ` (${t('agent.passiveModInstalled', { version: valueText(item.installedVersion) })})` : ''
    return `${valueText(item.mod)} -> ${dependency}${required}${installed}`
  })
  const duplicateDetails = duplicates.value.map((item) => {
    const files = Array.isArray(item.files) ? item.files.map(file => valueText(file)).join(', ') : '-'
    return t('agent.passiveModDuplicate', { mod: valueText(item.mod), files })
  })
  const note = typeof props.event.payload.note === 'string' ? [props.event.payload.note] : []
  return [...incompatibilityDetails, ...duplicateDetails, ...note]
})
</script>

<style scoped>
.agent-passive-event {
  display: grid;
  width: min(78%, 640px);
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.82);
}
.agent-passive-event__icon {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.agent-passive-event__content {
  min-width: 0;
}
.agent-passive-event__title {
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
}
.agent-passive-event__summary {
  margin-top: 1px;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 11.5px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.agent-passive-event__details {
  display: flex;
  max-height: 150px;
  flex-direction: column;
  gap: 3px;
  margin-top: 7px;
  overflow: auto;
}
.agent-passive-event__detail {
  padding: 5px 7px;
  border-radius: 5px;
  color: rgba(var(--v-theme-on-surface), 0.76);
  background: rgba(var(--v-theme-on-surface), 0.055);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.agent-passive-event--success {
  border-left-color: rgb(var(--v-theme-success));
}
.agent-passive-event--success .agent-passive-event__icon {
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.12);
}
.agent-passive-event--warning {
  border-left-color: rgb(var(--v-theme-warning));
}
.agent-passive-event--warning .agent-passive-event__icon {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.12);
}
.agent-passive-event--error {
  border-left-color: rgb(var(--v-theme-error));
}
.agent-passive-event--error .agent-passive-event__icon {
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.12);
}
@media (max-width: 700px) {
  .agent-passive-event {
    width: 94%;
  }
}
</style>