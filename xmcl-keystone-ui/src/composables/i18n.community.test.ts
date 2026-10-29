import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/telemetry', () => ({ trackRendererException: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@xmcl/runtime-api', () => ({ resolveXmclApiEndpoints: () => ({ common: 'https://example.invalid' }) }))
vi.mock('./flights', () => ({ kFlights: Symbol(), useI18nSearchFlights: vi.fn() }))

describe('community translation composable integration', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('skips disallowed locale, preserves original-content fallback and reports failures once', async () => {
    vi.useFakeTimers()
    const locale = ref('en')
    const fetch = vi.fn().mockResolvedValue(new Response('private response', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('useI18n', () => ({ locale }))
    vi.stubGlobal('inject', () => ({}))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { trackRendererException } = await import('@/telemetry')
    vi.mocked(trackRendererException).mockRejectedValueOnce(new Error('telemetry unavailable'))
    const { useAutoI18nCommunityContent } = await import('./i18n')
    const { getContent } = useAutoI18nCommunityContent(['zh-CN', 'ja'])
    expect(await getContent('modrinth', 'secret-project')).toBe('')
    expect(fetch).not.toHaveBeenCalled()
    locale.value = 'zh-CN'
    const a = getContent('modrinth', 'secret-project')
    const b = getContent('modrinth', 'secret-project')
    await vi.advanceTimersByTimeAsync(250)
    expect(await Promise.all([a, b])).toEqual(['', ''])
    expect(await getContent('modrinth', 'secret-project')).toBe('')
    expect(trackRendererException).toHaveBeenCalledTimes(1)
    const diagnostic = vi.mocked(trackRendererException).mock.calls[0][0] as Error
    expect(diagnostic.message).toBe('Community translation unavailable (modrinth, 503)')
    expect(diagnostic.message).not.toMatch(/secret|https/)
    locale.value = 'ja'
    fetch.mockResolvedValue(new Response('日本語'))
    const translated = getContent('modrinth', 'secret-project')
    await vi.advanceTimersByTimeAsync(250)
    expect(await translated).toBe('日本語')
  })
})
