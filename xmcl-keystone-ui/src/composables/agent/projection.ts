import type { AgentRunEvent } from '@xmcl/runtime-api'

export function selectPendingRunEvents(events: AgentRunEvent[], runId: string, afterSeq: number) {
  return events
    .filter(event => event.runId === runId && event.seq > afterSeq)
    .sort((a, b) => a.seq - b.seq)
}
