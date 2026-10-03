import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { parseModpackUrlInput, routeModpackUrlInput } from './modpackUrlInput'

describe('modpack URL input ownership', () => {
  it.each([
    'https://example.com/pack.zip',
    'https://example.com/pack.mrpack?token=abc',
    'https://example.com/download?id=123',
    'https://example.com/redirect',
    'https://example.com/get?filename=pack.zip',
    'https://github.com/owner/repo/releases/download/latest/archive',
    'https://cdn.modrinth.com/data/project/versions/version/pack.mrpack',
  ])('keeps %s in the archive flow, not the generic HTTP protocol handler', (url) => {
    expect(parseModpackUrlInput(url)).toEqual({ url, kind: 'http' })
  })

  it.each([
    'https://modrinth.com/modpack/test',
    'https://www.curseforge.com/minecraft/modpacks/test',
    'https://atlauncher.com/pack/Test',
    'https://bbsmc.net/project/test',
    'https://www.technicpack.net/modpack/test.123',
    'https://github.com/owner/repo/releases',
    'https://www.planetminecraft.com/mod/test',
  ])('preserves provider URL %s for provider-specific resolution first', (url) => {
    expect(parseModpackUrlInput(url)).toEqual({ url, kind: 'http' })
  })

  it.each([
    'curseforge://install?addonId=1&fileId=2',
    'modrinth://test',
    'technic://modpack/test.123',
    'xmcl://launcher/app?url=https%3A%2F%2Fexample.com',
  ])('preserves supported deep-link handling for %s', (url) => {
    expect(parseModpackUrlInput(url)).toEqual({ url, kind: 'protocol' })
  })

  it.each([null, '', ' ', 'not-a-url', 'http://', 'file:///pack.zip', 'javascript:alert(1)'])('rejects invalid input %s without throwing', (value) => {
    expect(parseModpackUrlInput(value).kind).toBe('invalid')
  })

  it('normalizes cleared input and permits a valid retry', () => {
    const value = ref<string | null>(' not-a-url ')
    const input = computed(() => parseModpackUrlInput(value.value))
    expect(input.value.kind).toBe('invalid')
    value.value = null
    expect(input.value).toEqual({ url: '', kind: 'invalid' })
    value.value = '  HTTPS://example.com/pack.zip  '
    expect(input.value).toEqual({ url: 'https://example.com/pack.zip', kind: 'http' })
  })

  it.each([
    'https://example.com/a/pack.zip',
    'https://example.com/b/pack.zip',
    'https://example.com/download?id=123',
    'https://example.com/redirect',
  ])('imports %s without allowing the generic HTTP handler to consume it', async (url) => {
    const importArchive = vi.fn().mockResolvedValue(undefined)
    const handleProtocol = vi.fn().mockResolvedValue(true)
    expect(await routeModpackUrlInput(parseModpackUrlInput(url), importArchive, handleProtocol)).toBe(true)
    expect(importArchive).toHaveBeenCalledExactlyOnceWith(url)
    expect(handleProtocol).not.toHaveBeenCalled()
  })

  it.each([true, false])('preserves the launcher protocol handler result (%s)', async (handled) => {
    const url = 'xmcl://launcher/app?url=https%3A%2F%2Fexample.com'
    const importArchive = vi.fn()
    const handleProtocol = vi.fn().mockResolvedValue(handled)
    expect(await routeModpackUrlInput(parseModpackUrlInput(url), importArchive, handleProtocol)).toBe(handled)
    expect(handleProtocol).toHaveBeenCalledExactlyOnceWith(url)
    expect(importArchive).not.toHaveBeenCalled()
  })

  it('propagates archive errors without falling back to the generic HTTP handler', async () => {
    const error = new Error('Invalid ZIP')
    const handleProtocol = vi.fn()
    await expect(routeModpackUrlInput(parseModpackUrlInput('https://example.com/download'),
      vi.fn().mockRejectedValue(error), handleProtocol)).rejects.toBe(error)
    expect(handleProtocol).not.toHaveBeenCalled()
  })

  it('does not dispatch a cleared input', async () => {
    const importArchive = vi.fn()
    const handleProtocol = vi.fn()
    expect(await routeModpackUrlInput(parseModpackUrlInput(null), importArchive, handleProtocol)).toBe(false)
    expect(importArchive).not.toHaveBeenCalled()
    expect(handleProtocol).not.toHaveBeenCalled()
  })
})
