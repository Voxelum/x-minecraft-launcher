// Run with: node --test tests/regression/recent-issues.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ui = path.resolve(__dirname, '../../xmcl-keystone-ui')
const uiRequire = createRequire(path.join(ui, 'package.json'))
const ts = uiRequire('typescript')

function evaluate(source, globals) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(js, { exports, require: uiRequire, ...globals })
  return exports
}

function sourceFile(relative) {
  const text = fs.readFileSync(path.join(ui, relative), 'utf8')
  return ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true)
}

// Read the actual production hook/function, not a duplicated implementation.
function findNode(root, predicate) {
  if (predicate(root)) return root
  return ts.forEachChild(root, child => findNode(child, predicate))
}

test('#1641: query-only selection preserves scrolling; path changes reset; hook is disposed', () => {
  const sfc = fs.readFileSync(path.join(ui, 'src/views/HomeLayout.vue'), 'utf8')
  const script = sfc.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]
  const ast = ts.createSourceFile('HomeLayout.ts', script, ts.ScriptTarget.Latest, true)
  const registration = findNode(ast, n => ts.isCallExpression(n) && n.expression.getText(ast) === 'router.afterEach')
  const dispose = findNode(ast, n => ts.isCallExpression(n) && n.expression.getText(ast) === 'onUnmounted' && n.getText(ast).includes('removeAfterEach'))
  assert.ok(registration)
  let hook, cleanup, removed = 0
  const containerRef = { value: { scrollTop: 450 } }
  const document = { title: '' }
  evaluate(`const removeAfterEach = ${registration.getText(ast)};\n${dispose?.getText(ast) || ''}`, {
    router: { afterEach(fn) { hook = fn; return () => { removed++ } } },
    containerRef, document, onUnmounted(fn) { cleanup = fn },
  })
  hook({ path: '/mods', fullPath: '/mods?id=second' }, { path: '/mods' })
  assert.equal(containerRef.value.scrollTop, 450)
  assert.equal(document.title, 'XMCL KeyStone - /mods?id=second')
  hook({ path: '/resourcepacks', fullPath: '/resourcepacks' }, { path: '/mods' })
  assert.equal(containerRef.value.scrollTop, 0)
  containerRef.value = null
  hook({ path: '/', fullPath: '/' }, { path: '/mods' })
  cleanup()
  assert.equal(removed, 1)
})

test('#1761/#1648: expired persistent version cache is rejected without waiting for idle cleanup', () => {
  const storage = new Map()
  const localStorage = {
    get length() { return storage.size },
    key: i => [...storage.keys()][i],
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  let idle
  const { LocalStroageCache } = evaluate(fs.readFileSync(path.join(ui, 'src/util/localStorageCache.ts'), 'utf8'), {
    localStorage, requestIdleCallback: fn => { idle = fn; return 1 }, console: { debug() {} },
  })
  const cache = new LocalStroageCache('/cache', 1000)
  cache.set('/modrinth/versions/test', ['latest'], 1000)
  assert.deepEqual(Array.from(cache.get('/modrinth/versions/test').data), ['latest'])
  const key = '/cache/modrinth/versions/test'
  const now = Date.now()
  storage.set(key, JSON.stringify({ data: ['old'], createdAt: now, expiresAt: now - 1 }))
  assert.equal(cache.get('/modrinth/versions/test'), undefined)
  assert.equal(storage.has(key), false)
  storage.set(key, JSON.stringify({ data: ['old'], createdAt: now - 2000, expiresAt: now + 100000 }))
  assert.equal(cache.get('/modrinth/versions/test'), undefined)
  storage.set(key, JSON.stringify({ data: ['fresh'], createdAt: Date.now(), expiresAt: null }))
  idle()
  assert.ok(storage.has(key), 'JSON-serialized Infinity is null, not an expired deadline')
  assert.deepEqual(Array.from(cache.get('/modrinth/versions/test').data), ['fresh'])
  cache.delete('/modrinth/versions/test')
  assert.equal(storage.has(key), false)
})

test('#1590: resource pack IDs retain directory and archive filenames exactly', () => {
  const ast = sourceFile('src/composables/instanceResourcePack.ts')
  const fn = findNode(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === 'getResourcePackItem')
  assert.ok(fn)
  const format = findNode(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === 'getResourcepackFormat')
  const { getResourcePackItem } = evaluate(`${format.getText(ast)}\nexport ${fn.getText(ast)}`, {
    packFormatVersionRange: { 3: '[*]' }, isPersistedResource: () => false,
  })
  for (const fileName of ['folder-pack', 'pack.zip', 'PACK.ZIP']) {
    const resource = { path: `/instance/resourcepacks/${fileName}`, fileName, name: fileName, metadata: {}, mtime: 0 }
    const pack = getResourcePackItem(resource, new Set([`file/${fileName}`]))
    assert.equal(pack.id, `file/${fileName}`)
    assert.equal(pack.enabled, true)
    assert.equal(pack.path, resource.path)
    assert.equal(getResourcePackItem(resource, new Set()).enabled, false)
  }
})
