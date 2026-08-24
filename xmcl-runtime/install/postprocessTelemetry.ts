import type { InstallEvent, InstallJavaTask } from '@xmcl/installer'

export interface PostprocessTelemetryResult {
  operationId: string
  properties: Record<string, string>
  measurements: Record<string, number>
}

interface PostprocessState {
  operationId: string
  startedStrategies: Set<number>
  batchErrorCategory: string
  batchExitCode?: number
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { category: 'unknown' }
  const value = error as Error & { code?: string; exitCode?: number | null; stderr?: string }
  const message = `${value.stderr ?? ''}\n${value.message ?? ''}`
  let category = 'java-error'
  if (value.name === 'AbortError') category = 'aborted'
  else if (value.code === 'ENOENT') category = 'executable-not-found'
  else if (value.code === 'EACCES' || value.code === 'EPERM') category = 'permission-denied'
  else if (/UnsupportedClassVersionError/.test(message)) category = 'unsupported-class-version'
  else if (/ClassNotFoundException/.test(message)) category = 'class-not-found'
  else if (/NoClassDefFoundError/.test(message)) category = 'dependency-missing'
  else if (/NoSuchMethodError/.test(message)) category = 'no-such-method'
  else if (/NoSuchFieldError/.test(message)) category = 'no-such-field'
  else if (/IllegalAccessError/.test(message)) category = 'illegal-access'
  else if (/OutOfMemoryError/.test(message)) category = 'out-of-memory'
  else if (/Patch expected/.test(message)) category = 'processor-validation'
  else if (/NoSuchFileException/.test(message)) category = 'missing-input'
  else if (/invalid output/i.test(message)) category = 'invalid-output'
  else if (value.name === 'ProcessExitError') category = 'process-exit'
  return {
    category,
    exitCode: typeof value.exitCode === 'number' ? value.exitCode : undefined,
  }
}

function isPostprocessTask(task: InstallEvent['task']): task is InstallJavaTask {
  return task.type === 'java' && task.metadata?.telemetryKind === 'postprocess'
}

export function createPostprocessTelemetryTracker(
  emit: (result: PostprocessTelemetryResult) => void,
  createOperationId: () => string,
) {
  const states = new WeakMap<InstallJavaTask, PostprocessState>()

  const getState = (task: InstallJavaTask) => {
    let state = states.get(task)
    if (!state) {
      state = {
        operationId: createOperationId(),
        startedStrategies: new Set(),
        batchErrorCategory: 'none',
      }
      states.set(task, state)
    }
    return state
  }

  return (event: InstallEvent) => {
    if (!isPostprocessTask(event.task)) return
    const task = event.task
    const state = getState(task)

    if (event.type === 'java-strategy-start') {
      state.startedStrategies.add(event.strategy)
      return
    }
    if (event.type === 'java-strategy-failed') {
      if (event.strategy === 0 && task.strategies.length > 1) {
        const details = errorDetails(event.error)
        state.batchErrorCategory = details.category
        state.batchExitCode = details.exitCode
      }
      return
    }
    if (event.type !== 'task-end') return

    const hasBatch = task.strategies.length > 1
    const batchStarted = state.startedStrategies.has(0)
    const fallbackStarted = state.startedStrategies.has(1)
    const failure = errorDetails(event.error)
    let outcome: string
    if (!batchStarted) outcome = event.error ? 'failed-before-execution' : 'cached'
    else if (event.error) outcome = hasBatch
      ? fallbackStarted ? 'fallback-failed' : 'batch-failed'
      : 'direct-failed'
    else if (hasBatch && fallbackStarted) outcome = 'fallback-recovered'
    else outcome = hasBatch ? 'batch-completed' : 'direct-completed'

    const metadata = task.metadata ?? {}
    const result: PostprocessTelemetryResult = {
      operationId: state.operationId,
      properties: {
        outcome,
        protocolVersion: String(metadata.protocolVersion ?? 'unknown'),
        loader: String(metadata.loader ?? 'unknown'),
        minecraftVersion: String(metadata.minecraftVersion ?? 'unknown'),
        side: String(metadata.side ?? 'unknown'),
        batchErrorCategory: state.batchErrorCategory,
        failureCategory: event.error ? failure.category : 'none',
      },
      measurements: {
        durationMs: event.duration,
        processorCount: typeof metadata.processorCount === 'number'
          ? metadata.processorCount
          : task.strategies.at(-1)?.length ?? 0,
      },
    }
    if (state.batchExitCode !== undefined) result.measurements.batchExitCode = state.batchExitCode
    if (failure.exitCode !== undefined) result.measurements.failureExitCode = failure.exitCode
    states.delete(task)
    emit(result)
  }
}