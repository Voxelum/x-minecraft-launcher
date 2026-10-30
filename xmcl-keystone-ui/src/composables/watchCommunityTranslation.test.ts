import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { watchCommunityTranslation } from './watchCommunityTranslation'

describe.each(['modrinth', 'curseforge'] as const)('%s description watcher', (provider) => {
  it('clears on locale change and rejects late results from another locale or project', async () => {
    const id = ref<string | number>(provider === 'modrinth' ? 'project-one' : 1)
    const locale = ref('zh-CN')
    const content = ref('')
    const requests: Array<{ resolve: (value: string) => void; id: string | number; locale: string }> = []
    const getContent = vi.fn((id: string | number) => new Promise<string>((resolve) => {
      requests.push({ resolve, id, locale: locale.value })
    }))
    const stop = watchCommunityTranslation(id, locale, content, getContent)
    try {
      expect(requests[0].locale).toBe('zh-CN')
      locale.value = 'ja'
      await nextTick()
      expect(content.value).toBe('')
      requests[1].resolve('current Japanese')
      await nextTick()
      expect(content.value).toBe('current Japanese')
      requests[0].resolve('late Chinese')
      await nextTick()
      expect(content.value).toBe('current Japanese')
      locale.value = 'en'
      await nextTick()
      expect(content.value).toBe('')
      id.value = provider === 'modrinth' ? 'project-two' : 2
      await nextTick()
      requests[2].resolve('late previous project')
      await nextTick()
      expect(content.value).toBe('')
      requests[3].resolve('new project English')
      await nextTick()
      expect(content.value).toBe('new project English')
      expect(requests).toHaveLength(4)
    } finally {
      stop()
    }
  })
})
