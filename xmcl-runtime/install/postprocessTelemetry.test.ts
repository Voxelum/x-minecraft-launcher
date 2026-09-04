import type { InstallEvent, InstallJavaTask } from '@xmcl/installer'
import { expect, test, vi } from 'vitest'
import { createPostprocessTelemetryTracker } from './postprocessTelemetry'

function createTask(): InstallJavaTask {
  return {
    id: 'forge:1.20.1:processors',
    type: 'java',
    strategies: [
      [{ executable: 'java', args: ['MultiJarLauncher'] }],
      [{ executable: 'java', args: ['First'] }, { executable: 'java', args: ['Second'] }],
    ],
    outputs: [],
    metadata: {
      telemetryKind: 'postprocess',
      protocolVersion: 'isolated-classloader-v1',
      loader: 'forge',
      minecraftVersion: '1.20.1',
      side: 'client',
      processorCount: 2,
    },
  }
}

function processExit(stderr: string, exitCode = 1) {
  return Object.assign(new Error(stderr), {
    name: 'ProcessExitError',
    stderr,
    exitCode,
  })
}

test('reports a successful isolated batch once', () => {
  const emit = vi.fn()
  const track = createPostprocessTelemetryTracker(emit, () => 'operation-1')
  const task = createTask()
  track({ type: 'task-start', task, at: 0 })
  track({ type: 'java-strategy-start', task, strategy: 0 })
  track({ type: 'task-end', task, at: 120, duration: 120 })

  expect(emit).toHaveBeenCalledOnce()
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    operationId: 'operation-1',
    properties: expect.objectContaining({
      outcome: 'batch-completed',
      protocolVersion: 'isolated-classloader-v1',
      batchErrorCategory: 'none',
    }),
    measurements: { durationMs: 120, processorCount: 2 },
  }))
})

test('reports fallback recovery with a sanitized batch failure category', () => {
  const emit = vi.fn()
  const track = createPostprocessTelemetryTracker(emit, () => 'operation-2')
  const task = createTask()
  const error = processExit('java.lang.ClassNotFoundException: local.private.Processor', 3)
  const events: InstallEvent[] = [
    { type: 'task-start', task, at: 0 },
    { type: 'java-strategy-start', task, strategy: 0 },
    { type: 'java-strategy-failed', task, strategy: 0, error },
    { type: 'java-strategy-start', task, strategy: 1 },
    { type: 'task-end', task, at: 200, duration: 200 },
  ]
  events.forEach(track)

  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    properties: expect.objectContaining({
      outcome: 'fallback-recovered',
      batchErrorCategory: 'class-not-found',
      failureCategory: 'none',
    }),
    measurements: { durationMs: 200, processorCount: 2, batchExitCode: 3 },
  }))
  expect(JSON.stringify(emit.mock.calls)).not.toContain('local.private.Processor')
})

test('reports terminal fallback failure without raw stderr', () => {
  const emit = vi.fn()
  const track = createPostprocessTelemetryTracker(emit, () => 'operation-3')
  const task = createTask()
  const batchError = processExit('java.lang.NoSuchMethodError: secret.path')
  const fallbackError = processExit('java.nio.file.NoSuchFileException: C:\\private\\input.jar', 4)
  track({ type: 'java-strategy-start', task, strategy: 0 })
  track({ type: 'java-strategy-failed', task, strategy: 0, error: batchError })
  track({ type: 'java-strategy-start', task, strategy: 1 })
  track({ type: 'java-strategy-failed', task, strategy: 1, error: fallbackError })
  track({ type: 'task-end', task, at: 300, duration: 300, error: fallbackError })

  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    properties: expect.objectContaining({
      outcome: 'fallback-failed',
      batchErrorCategory: 'no-such-method',
      failureCategory: 'missing-input',
    }),
    measurements: {
      durationMs: 300,
      processorCount: 2,
      batchExitCode: 1,
      failureExitCode: 4,
    },
  }))
  expect(JSON.stringify(emit.mock.calls)).not.toContain('private')
})

test('distinguishes a direct processor failure from a batch failure', () => {
  const emit = vi.fn()
  const track = createPostprocessTelemetryTracker(emit, () => 'operation-4')
  const task = createTask()
  task.strategies = [task.strategies[1]!]
  task.metadata = { ...task.metadata, protocolVersion: 'direct' }
  const error = processExit('processor failed')
  track({ type: 'java-strategy-start', task, strategy: 0 })
  track({ type: 'java-strategy-failed', task, strategy: 0, error })
  track({ type: 'task-end', task, at: 100, duration: 100, error })

  expect(emit).toHaveBeenCalledWith(expect.objectContaining({
    properties: expect.objectContaining({
      outcome: 'direct-failed',
      protocolVersion: 'direct',
    }),
  }))
})