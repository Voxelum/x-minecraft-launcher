import { readFileSync } from 'node:fs'
import { ModuleKind, transpileModule } from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { useRefreshable } from '../composables/refreshable'
import { getErrorMessage } from '../util/error'

const source = readFileSync(new URL('./BaseSettingServerService.vue', import.meta.url), 'utf8')
const compiled = transpileModule(compileScript(parse(source).descriptor, {
  id: 'server-service-test',
}).content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText

async function harness(target = 'local') {
  const instanceKey = Symbol('instance')
  const launchKey = Symbol('launch')
  const serverKey = Symbol('server')
  const userKey = Symbol('user')
  const instanceServiceKey = Symbol('instance-service')
  const serviceKey = Symbol('service')
  const editInstance = vi.fn(async () => {})
  const prepareServer = vi.fn(async () => 'server-version')
  const generateLaunchOptions = vi.fn(async (..._args: unknown[]) => ({ version: 'server-version' }))
  const result = { ok: true, message: 'service action completed' }
  const status = { installed: true, active: false, manager: 'windows-service' }
  const service = {
    getStatus: vi.fn(async () => status),
    install: vi.fn(async (..._args: unknown[]) => result),
    start: vi.fn(async (..._args: unknown[]) => result),
    stop: vi.fn(async (..._args: unknown[]) => result),
    restart: vi.fn(async (..._args: unknown[]) => result),
    uninstall: vi.fn(async (..._args: unknown[]) => result),
  }
  const injections = new Map<symbol, unknown>([
    [instanceKey, { path: vue.ref('/test/server'), instance: vue.ref({ name: 'Test', remoteServer: {} }) }],
    [launchKey, { generateLaunchOptions }], [serverKey, { prepareServer }],
    [userKey, { userProfile: vue.ref({ id: 'test' }) }],
  ])
  const load = (name: string) => {
    if (name === 'vue') return vue
    if (name === '@/composables') return { useRefreshable, useService: (key: symbol) => key === instanceServiceKey ? { editInstance } : service }
    if (name === '@/composables/instance') return { kInstance: instanceKey }
    if (name === '@/composables/instanceLaunch') return { kInstanceLaunch: launchKey }
    if (name === '@/composables/instanceServerLaunch') return { kInstanceServerLaunch: serverKey }
    if (name === '@/composables/user') return { kUserContext: userKey }
    if (name === '@/util/error') return { getErrorMessage }
    if (name === '@/util/inject') return { injection: (key: symbol) => injections.get(key) }
    if (name === '@xmcl/runtime-api') return { InstanceServiceKey: instanceServiceKey, ServerServiceKey: serviceKey }
    if (name.endsWith('.vue')) return { default: {} }
    throw new Error(`Unexpected dependency: ${name}`)
  }
  const exports = { default: undefined as any }
  new Function('require', 'exports', 'ref', 'computed', 'watch', 'useI18n', compiled)(
    load, exports, vue.ref, vue.computed, vue.watch, () => ({ t: (key: string) => key }),
  )
  const scope = vue.effectScope()
  const panel = scope.run(() => exports.default.setup({ target }, { expose: () => {} }))
  // The immediate status watcher completes before testing individual operations.
  await Promise.resolve()
  return { panel, service, editInstance, prepareServer, generateLaunchOptions, result, stop: () => scope.stop() }
}

describe('server service panel operations', () => {
  it.each(['prepareServer', 'generateLaunchOptions', 'editInstance'] as const)('shows %s rejection without installing, then recovers on retry', async (dependency) => {
    const h = await harness()
    try {
      h[dependency].mockRejectedValueOnce(new Error(`${dependency} failed`))
      await h.panel.onInstall()
      expect(h.panel.operationError.value).toBe(`${dependency} failed`)
      expect(h.panel.actionMessage.value).toBeUndefined()
      expect(h.service.install).not.toHaveBeenCalled()
      expect(h.panel.installing.value).toBe(false)
      await h.panel.onInstall()
      expect(h.panel.operationError.value).toBe('')
      expect(h.panel.actionMessage.value).toEqual(h.result)
      expect(h.service.install).toHaveBeenCalledOnce()
    } finally { h.stop() }
  })

  it.each([
    ['install', 'onInstall', 'installing'], ['start', 'onStart', 'starting'],
    ['stop', 'onStop', 'stopping'], ['restart', 'onRestart', 'restarting'],
    ['uninstall', 'onUninstall', 'uninstalling'],
  ] as const)('clears stale feedback, catches %s rejection and resets loading on retry', async (method, action, loading) => {
    const h = await harness()
    try {
      await h.panel[action]()
      expect(h.panel.actionMessage.value).toEqual(h.result)
      let reject!: (error: Error) => void
      h.service[method].mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
      const pending = h.panel[action]()
      expect(h.panel.actionMessage.value).toBeUndefined()
      expect(h.panel[loading].value).toBe(true)
      // Install first persists settings and prepares launch options.
      await vi.waitFor(() => expect(reject).toBeTypeOf('function'))
      reject(new Error(`${method} failed`))
      await pending
      expect(h.panel.operationError.value).toBe(`${method} failed`)
      expect(h.panel[loading].value).toBe(false)
      await h.panel[action]()
      expect(h.panel.operationError.value).toBe('')
      expect(h.panel.actionMessage.value).toEqual(h.result)
    } finally { h.stop() }
  })

  it('handles status rejection without losing the action result, and clears stale status errors on refresh', async () => {
    const h = await harness()
    try {
      const failedResult = { ok: false, message: 'service refused' }
      h.service.start.mockResolvedValueOnce(failedResult)
      h.service.getStatus.mockRejectedValueOnce(new Error('status unavailable'))
      await h.panel.onStart()
      expect(h.panel.actionMessage.value).toEqual(failedResult)
      expect(h.panel.operationError.value).toBe('status unavailable')
      expect(h.panel.statusLoading.value).toBe(false)
      h.panel.status.value = { error: 'old status error' }
      const pending = h.panel.refreshStatus()
      expect(h.panel.operationError.value).toBe('')
      expect(h.panel.actionMessage.value).toBeUndefined()
      expect(h.panel.status.value.error).toBeUndefined()
      await pending
      h.service.getStatus.mockRejectedValueOnce('connection lost')
      await h.panel.refreshStatus()
      expect(h.panel.operationError.value).toBe('connection lost')
      expect(h.panel.statusLoading.value).toBe(false)
      await h.panel.refreshStatus()
      expect(h.panel.operationError.value).toBe('')
    } finally { h.stop() }
  })

  it.each([new Error(''), { message: 'IPC preparation failure' }, ''])('does not hide empty or serialized rejections: %j', async (error) => {
    const h = await harness()
    try {
      h.prepareServer.mockRejectedValueOnce(error)
      await h.panel.onInstall()
      expect(h.panel.operationError.value).toBe(getErrorMessage(error) || 'dataMigration.unknownError')
      expect(h.panel.operationError.value).not.toBe('')
      expect(h.service.install).not.toHaveBeenCalled()
    } finally { h.stop() }
  })

  it('reports settings save failures and clears them after a successful save', async () => {
    const h = await harness()
    try {
      h.editInstance.mockRejectedValueOnce(new Error('settings failed'))
      await h.panel.saveDesiredService()
      expect(h.panel.operationError.value).toBe('settings failed')
      await h.panel.saveDesiredService()
      expect(h.panel.operationError.value).toBe('')
    } finally { h.stop() }
  })

  it('keeps remote installs independent of local preparation', async () => {
    const h = await harness('remote')
    try {
      await h.panel.onInstall()
      expect(h.prepareServer).not.toHaveBeenCalled()
      expect(h.generateLaunchOptions).not.toHaveBeenCalled()
      expect(h.service.install).toHaveBeenCalledWith(expect.objectContaining({ target: 'remote', launchOptions: undefined }))
    } finally { h.stop() }
  })
})
