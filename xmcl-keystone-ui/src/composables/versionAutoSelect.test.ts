import { describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { useVersionAutoSelect } from './versionAutoSelect'

describe('useVersionAutoSelect', () => {
  test.each([
    { cached: false, includesImported: true },
    { cached: true, includesImported: true },
    { cached: false, includesImported: false },
    { cached: true, includesImported: false },
  ])('preserves the DeceasedCraft Forge version (cached=$cached, listed=$includesImported)', async ({ cached, includesImported }) => {
    const items = [
      { name: '47.4.23' },
      ...(includesImported ? [{ name: '47.4.10' }] : []),
    ]
    const props = reactive({
      value: '47.4.10',
      autoSelect: cached ? '47.4.23' : '',
      items: cached ? items : [],
    })
    const select = vi.fn((version: string) => { props.value = version })
    const scope = effectScope()
    try {
      scope.run(() => useVersionAutoSelect(props, select))
      props.autoSelect = '47.4.23'
      props.items = items
      await nextTick()
      props.items = [...items]
      await nextTick()

      expect(select).not.toHaveBeenCalled()
      expect(props.value).toBe('47.4.10')
    } finally {
      scope.stop()
    }
  })

  test('checks the imported choice when a queued metadata update is processed', async () => {
    const props = reactive({ value: '', autoSelect: '', items: [] as { name: string }[] })
    const select = vi.fn((version: string) => { props.value = version })
    const scope = effectScope()
    try {
      scope.run(() => useVersionAutoSelect(props, select))
      props.autoSelect = '47.4.23'
      props.items = [{ name: '47.4.23' }, { name: '47.4.10' }]
      props.value = '47.4.10'
      await nextTick()

      expect(select).not.toHaveBeenCalled()
      expect(props.value).toBe('47.4.10')
    } finally {
      scope.stop()
    }
  })

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
