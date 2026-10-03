import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useModpackUrlPaste, isModpackUrl } from './modpackPaste'
import { useAppDropHandler } from './appDropHandler'
import type { DropHandler } from './dropHandler'

const mocks = vi.hoisted(() => ({
  show: vi.fn(), mounts: [] as (() => void)[], unmounts: [] as (() => void)[],
  registerHandler: vi.fn(),
}))
vi.mock('vue', async () => ({
  ...await vi.importActual('vue'),
  onMounted: (run: () => void) => mocks.mounts.push(run),
  onBeforeUnmount: (run: () => void) => mocks.unmounts.push(run),
}))
vi.mock('./dialog', () => ({ useDialog: () => ({ show: mocks.show }) }))
vi.mock('@/util/inject', () => ({ injection: () => ({
  registerHandler: mocks.registerHandler, dragover: ref(false), path: ref('instance'),
}) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mounts.length = 0
  mocks.unmounts.length = 0
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
})
afterEach(() => vi.unstubAllGlobals())

function paste(text: string, target = {}) {
  const event = new Event('paste', { cancelable: true })
  Object.defineProperties(event, {
    clipboardData: { value: { getData: () => text } },
    target: { value: target },
  })
  window.dispatchEvent(event)
  return event
}

describe('production clipboard and drop event wiring', () => {
  it('registers once, imports recognizable URLs, and unregisters on unmount', () => {
    useModpackUrlPaste()
    mocks.mounts.forEach(run => run())
    expect(paste(' https://example.com/pack.zip#download ').defaultPrevented).toBe(true)
    expect(mocks.show).toHaveBeenCalledExactlyOnceWith({ url: 'https://example.com/pack.zip#download' })
    mocks.unmounts.forEach(run => run())
    paste('https://example.com/pack.zip')
    expect(mocks.show).toHaveBeenCalledTimes(1)
  })

  it.each([{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { isContentEditable: true }])('does not steal editing-field paste (%j)', (target) => {
    useModpackUrlPaste()
    mocks.mounts.forEach(run => run())
    expect(paste('https://example.com/pack.zip', target).defaultPrevented).toBe(false)
    expect(mocks.show).not.toHaveBeenCalled()
  })

  it.each(['https://example.com/?next=https://github.com/owner/repo', 'https://notmodrinth.com/modpack/test', 'C:\\pack.zip', 'hello'])('preserves unrelated clipboard content (%s)', (text) => {
    expect(isModpackUrl(text)).toBe(false)
    useModpackUrlPaste()
    mocks.mounts.forEach(run => run())
    expect(paste(text).defaultPrevented).toBe(false)
  })

  it('routes URL drops while retaining auth-service drop behavior', async () => {
    const drop = useAppDropHandler()
    const handler = mocks.registerHandler.mock.calls[0][0] as DropHandler
    const transfer = (value: string) => ({
      items: [{ kind: 'string', getAsString: (callback: (text: string) => void) => callback(value) }],
      files: { length: 0 },
    }) as unknown as DataTransfer
    await handler.onDrop!(transfer('https://example.com/pack.zip'))
    expect(mocks.show).toHaveBeenCalledWith({ url: 'https://example.com/pack.zip' })
    await handler.onDrop!(transfer('authlib-injector:yggdrasil-server:https://example.com/auth'))
    expect(drop.previews.value[0].type).toEqual(['Yggdrasil'])
    expect(mocks.show).toHaveBeenCalledTimes(1)
  })
})
