import { TaskState, type Tasks } from '@xmcl/runtime-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'
import { useTaskCompletion } from './taskCompletion'

const task = (id: string, state = TaskState.Running): Tasks => ({
  id, key: id, state, type: 'installAuthlibInjector', version: '1', substate: { type: 'download' },
})

describe('task completion badge', () => {
  let scope: EffectScope
  beforeEach(() => {
    vi.useFakeTimers()
    scope = effectScope()
  })
  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  function fixture(initial = [task('active')]) {
    const tasks = shallowRef(initial)
    const { justFinishedTask } = scope.run(() => useTaskCompletion(tasks))!
    const update = async (next: Tasks[]) => {
      tasks.value = next
      await nextTick()
    }
    return { justFinishedTask, update }
  }

  it('uses the latest terminal task by ID, not the old running snapshot or list position', async () => {
    const f = fixture()
    const succeeded = { ...task('active', TaskState.Succeed), key: 'latest' }
    await f.update([task('old', TaskState.Succeed), succeeded])
    expect(f.justFinishedTask.value).toBe(succeeded)
    await vi.advanceTimersByTimeAsync(2999)
    expect(f.justFinishedTask.value).toBe(succeeded)
    await vi.advanceTimersByTimeAsync(1)
    expect(f.justFinishedTask.value).toBeNull()
  })

  it.each([TaskState.Failed, TaskState.Cancelled])('does not show success for terminal state %s', async (state) => {
    const f = fixture()
    await f.update([task('active', state), task('old', TaskState.Succeed)])
    expect(f.justFinishedTask.value).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not mistake cleared tasks or existing history for completion', async () => {
    const f = fixture()
    await f.update([task('old', TaskState.Succeed)])
    expect(f.justFinishedTask.value).toBeNull()
  })

  it('does not show a successful batch when one of the finishing tasks failed', async () => {
    const f = fixture([task('one'), task('two')])
    await f.update([task('one', TaskState.Succeed), task('two', TaskState.Failed)])
    expect(f.justFinishedTask.value).toBeNull()
  })

  it('clears stale completion and its timer when new work starts, even if that work fails', async () => {
    const f = fixture()
    await f.update([task('active', TaskState.Succeed)])
    expect(vi.getTimerCount()).toBe(1)
    await f.update([task('active', TaskState.Succeed), task('next')])
    expect(f.justFinishedTask.value).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    await f.update([task('active', TaskState.Succeed), task('next', TaskState.Cancelled)])
    expect(f.justFinishedTask.value).toBeNull()
  })

  it('clears timers when the component scope is disposed', async () => {
    const f = fixture()
    await f.update([task('active', TaskState.Succeed)])
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(f.justFinishedTask.value).toBeNull()
  })
})
