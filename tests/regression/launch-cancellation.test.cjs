// Exercise the real composable with service/reactivity boundaries stubbed.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ui = path.resolve(__dirname, '../../xmcl-keystone-ui')
const ts = createRequire(path.join(ui, 'package.json'))('typescript')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function setup({ refresh = async () => {}, permission = async () => {}, spawn = async () => 42, auth, voice = false } = {}) {
  const calls = [], killed = []
  const ref = value => ({ value })
  const computed = fn => ({ get value() { return fn() } })
  const services = {
    user: { refreshUser: refresh },
    launch: { launch: async options => { calls.push(options); return spawn() }, kill: async pid => { killed.push(pid) }, on() {}, getGameProcesses: async () => [], reportOperation() {} },
    auth: { getOrInstallAuthlibInjector: auth },
  }
  const api = { UserServiceKey: 'user', LaunchServiceKey: 'launch', AuthlibInjectorServiceKey: 'auth',
    generateLaunchOptionsWithGlobal: async (instance, user, version, opts) => {
      if (auth) { try { await opts.track(opts.token, auth(), 'preparing-authlib', opts.operationId) } catch {} }
      return { gameDirectory: instance.path, ...opts.overrides }
    } }
  const exports = {}
  const source = fs.readFileSync(path.join(ui, 'src/composables/instanceLaunch.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => name === '@xmcl/runtime-api' ? api : name === '@/composables' ? { useService: key => services[key] } : name === './setting' ? { useGlobalSettings: () => new Proxy({}, { get: () => ref(undefined) }) } : name === 'swrv' ? { default: () => ({ data: ref([]), mutate() {} }) } : {},
    ref, shallowRef: ref, computed, markRaw: x => x, watch() {}, AbortController, performance, crypto: require('node:crypto').webcrypto,
    console: { log() {}, error() {} }, windowController: { queryAudioPermission: permission },
  })
  const hook = exports.useInstanceLaunch(ref({ path: '/test', runtime: {} }), ref('1'), ref(), ref({ path: 'java' }), ref({ id: 'user' }), {}, ref(voice ? [{ modId: 'voicechat' }] : []))
  return { hook, calls, killed }
}
async function settles(p) {
  let timeout
  try { await Promise.race([p, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('did not settle')), 500) })]) } finally { clearTimeout(timeout) }
}
test('normal launch and nonfatal refresh failure retain behavior', async () => {
  for (const refresh of [async () => {}, async () => { throw Error('offline') }]) {
    const { hook, calls } = setup({ refresh })
    hook.abort()
    await hook.launch()
    assert.equal(calls.length, 1)
    assert.equal(hook.launching.value, false)
    assert.equal(hook.error.value, undefined)
  }
})
for (const stage of ['refresh', 'permission', 'auth']) {
  test(`cancel never-settling ${stage}, late resolution, and restart`, async () => {
    const pending = deferred()
    let first = true
    const service = () => first ? pending.promise : Promise.resolve()
    const { hook, calls } = setup({ [stage]: service, voice: stage === 'permission' })
    const run = hook.launch()
    await tick()
    hook.abort()
    await settles(run)
    assert.equal(hook.launching.value, false)
    assert.equal(calls.length, 0)
    assert.equal(hook.error.value, undefined)
    first = false
    await hook.launch()
    assert.equal(calls.length, 1)
    pending.resolve()
    await tick()
    assert.equal(calls.length, 1)
    assert.equal(hook.launching.value, false)
  })
  test(`skip ${stage} independently continues launch`, async () => {
    const { hook, calls } = setup({ [stage]: () => new Promise(() => {}), voice: stage === 'permission' })
    const run = hook.launch()
    await tick()
    hook[{ refresh: 'skipRefresh', permission: 'skipPermission', auth: 'skipAuthLib' }[stage]]()
    await settles(run)
    assert.equal(calls.length, 1)
    assert.equal(hook.error.value, undefined)
  })
}
test('cancel during spawning kills late pid without contaminating next launch', async () => {
  const pending = deferred()
  let first = true
  const { hook, killed } = setup({ spawn: () => first ? pending.promise : Promise.resolve(43) })
  const run = hook.launch()
  await tick()
  hook.abort()
  await settles(run)
  first = false
  await hook.launch()
  pending.resolve(42)
  await tick()
  assert.deepEqual(killed, [42])
  assert.equal(hook.count.value, 1)
  assert.equal(hook.gameProcesses.value[0].pid, 43)
  assert.equal(hook.error.value, undefined)
})
test('ordinary spawn errors still reject and populate error', async () => {
  const failure = Error('spawn failed')
  const { hook } = setup({ spawn: async () => { throw failure } })
  await assert.rejects(hook.launch(), /spawn failed/)
  assert.equal(hook.error.value, failure)
  assert.equal(hook.launching.value, false)
})
test('cancelled service may reject late without surfacing an ordinary error or unhandled rejection', async () => {
  const pending = deferred()
  const { hook, calls } = setup({ refresh: () => pending.promise })
  const run = hook.launch()
  await tick()
  hook.abort()
  await settles(run)
  pending.reject(Error('late network failure'))
  await tick()
  assert.equal(calls.length, 0)
  assert.equal(hook.error.value, undefined)
})
