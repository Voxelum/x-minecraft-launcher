import { describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { useVersionAutoSelect } from './versionAutoSelect'

describe('useVersionAutoSelect', () => {
  test('does not overwrite an imported Forge choice and clear its standalone version pin', async () => {
    const props = reactive({ value: '10.13.4.1614', autoSelect: '', items: [] as { name: string }[] })
    const select = vi.fn()
    const scope = effectScope()
    scope.run(() => useVersionAutoSelect(props, select))
    props.autoSelect = '10.13.4.1614'
    props.items = [{ name: '10.13.4.1614' }]
    await nextTick()
    expect(select).not.toHaveBeenCalled()
    scope.stop()
  })

  test('auto-selects once for an empty manual creation form', async () => {
    const props = reactive({ value: '', autoSelect: '', items: [] as { name: string }[] })
    const select = vi.fn()
    const scope = effectScope()
    scope.run(() => useVersionAutoSelect(props, select))
    props.autoSelect = '47.3.0'
    props.items = [{ name: '47.3.0' }]
    await nextTick()
    expect(select).toHaveBeenCalledExactlyOnceWith('47.3.0')
    props.items = [{ name: '47.3.0' }]
    await nextTick()
    expect(select).toHaveBeenCalledOnce()
    scope.stop()
  })
})
