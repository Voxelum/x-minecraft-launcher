import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useInstanceLoading } from './instanceLoading'

describe(useInstanceLoading.name, () => {
  it('only reports work for the selected instance', () => {
    const path = ref('instance-a')
    const { begin, isLoading } = useInstanceLoading(path)
    const endA = begin('instance-a')
    const endB = begin('instance-b')

    expect(isLoading.value).toBe(true)
    path.value = 'instance-b'
    expect(isLoading.value).toBe(true)

    endB()
    expect(isLoading.value).toBe(false)
    path.value = 'instance-a'
    expect(isLoading.value).toBe(true)

    endA()
    expect(isLoading.value).toBe(false)
  })

  it('tracks overlapping operations independently', () => {
    const path = ref('instance-a')
    const { begin, isLoading } = useInstanceLoading(path)
    const endFirst = begin('instance-a')
    const endSecond = begin('instance-a')

    endFirst()
    expect(isLoading.value).toBe(true)
    endFirst()
    expect(isLoading.value).toBe(true)

    endSecond()
    expect(isLoading.value).toBe(false)
  })
})