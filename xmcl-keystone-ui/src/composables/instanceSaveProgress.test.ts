import { InstanceSaveProgress } from '@xmcl/runtime-api'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useInstanceSaveProgress } from './instanceSaveProgress'

const { getProgress } = vi.hoisted(() => ({ getProgress: vi.fn() }))
const locale = ref('en')
vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale }) }))
vi.mock('./service', () => ({ useService: () => ({ getInstanceSaveProgress: getProgress }) }))

function data(name: string): InstanceSaveProgress {
  return { savePath: 'save', saveName: name, lastPlayed: 0, advancements: { completed: 0, categories: {}, items: [] } }
}
const scopes: ReturnType<typeof effectScope>[] = []
function create(save = ref<string | undefined>('save'), instance = ref('instance'), version = ref('old')) {
  const scope = effectScope()
  scopes.push(scope)
  return { state: scope.run(() => useInstanceSaveProgress(save, instance, version))!, save, instance, version }
}
beforeEach(() => {
  locale.value = 'en'
  getProgress.mockReset()
})
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop() })

describe('save progress requests', () => {
  test('deduplicates only in-flight requests and reloads changed locale/version', async () => {
    const pending = Promise.withResolvers<InstanceSaveProgress>()
    getProgress.mockReturnValueOnce(pending.promise).mockResolvedValue(data('updated'))
    const first = create()
    const second = create()
    expect(getProgress).toHaveBeenCalledTimes(1)
    pending.resolve(data('initial'))
    await vi.waitFor(() => expect(second.state.loading.value).toBe(false))
    expect(first.state.progress.value?.saveName).toBe('initial')
    locale.value = 'fr'
    await nextTick()
    await vi.waitFor(() => expect(first.state.progress.value?.saveName).toBe('updated'))
    expect(getProgress).toHaveBeenLastCalledWith({ savePath: 'save', instancePath: 'instance', locale: 'fr' })
    first.version.value = 'new'
    await nextTick()
    await vi.waitFor(() => expect(first.state.loading.value).toBe(false))
    expect(getProgress).toHaveBeenCalledTimes(3)
    await first.state.refresh()
    expect(getProgress).toHaveBeenCalledTimes(4)
  })

  test('ignores late results from the previous language', async () => {
    const old = Promise.withResolvers<InstanceSaveProgress>()
    getProgress.mockReturnValueOnce(old.promise).mockResolvedValue(data('French'))
    const { state } = create()
    locale.value = 'fr'
    await nextTick()
    await vi.waitFor(() => expect(state.progress.value?.saveName).toBe('French'))
    old.resolve(data('English'))
    await nextTick()
    await nextTick()
    expect(state.progress.value?.saveName).toBe('French')
  })

  test('surfaces errors on refresh instead of reusing previously successful progress', async () => {
    getProgress.mockResolvedValueOnce(data('cached')).mockRejectedValueOnce(new SyntaxError('Invalid quest'))
    const { state } = create()
    await vi.waitFor(() => expect(state.loading.value).toBe(false))
    expect(state.progress.value?.saveName).toBe('cached')
    await state.refresh()
    expect(state.progress.value).toBeUndefined()
    expect(state.error.value).toBeInstanceOf(SyntaxError)
    getProgress.mockResolvedValueOnce(data('repaired'))
    await state.refresh()
    expect(state.error.value).toBeUndefined()
    expect(state.progress.value?.saveName).toBe('repaired')
  })

  test('does not publish an old save response after navigation', async () => {
    const old = Promise.withResolvers<InstanceSaveProgress>()
    getProgress.mockReturnValueOnce(old.promise)
    const { state, save } = create()
    save.value = undefined
    await nextTick()
    old.resolve(data('old'))
    await nextTick()
    await nextTick()
    expect(state.progress.value).toBeUndefined()
    expect(state.loading.value).toBe(false)
  })

  test('does not publish a response after disposal', async () => {
    const pending = Promise.withResolvers<InstanceSaveProgress>()
    getProgress.mockReturnValueOnce(pending.promise)
    const { state } = create()
    scopes[0].stop()
    pending.resolve(data('disposed'))
    await nextTick()
    await nextTick()
    expect(state.progress.value).toBeUndefined()
  })
})
