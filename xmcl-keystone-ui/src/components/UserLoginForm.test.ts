import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as RuntimeApi from '@xmcl/runtime-api'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { useRefreshable } from '../composables/refreshable'
import { useLoginValidation } from '../composables/user'

const source = readFileSync(new URL('./UserLoginForm.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'login-form-test' })
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

const login = vi.fn()
const select = vi.fn()
const notify = vi.fn()
const emit = vi.fn()
let scope: Vue.EffectScope

interface LoginState {
  authority: Vue.Ref<string>
  error: Vue.Ref<unknown>
  errorMessage: Vue.ComputedRef<string>
  isMicrosoftAuthError: Vue.ComputedRef<boolean>
  accountInput: Vue.Ref<{ blur: () => void }>
  data: { username: string; password: string; verificationUri: string }
  onLogin: () => Promise<void>
}

function setup() {
  scope = Vue.effectScope()
  const modules: Record<string, unknown> = {
    vue: Vue,
    '@xmcl/runtime-api': RuntimeApi,
    '@/components/Hint.vue': {},
    './UserLoginAuthoritySelect.vue': {},
    '@/composables': {
      useRefreshable,
      useService: () => ({ login, abortLogin: vi.fn(), on: vi.fn() }),
    },
    '@vueuse/core': { useLocalStorage: () => Vue.ref(false) },
    '@/composables/yggrasil': { kSupportedAuthorityMetadata: 'metadata' },
    '@/util/inject': {
      injection: () => ({
        select,
        data: Vue.ref([
          { authority: RuntimeApi.AUTHORITY_MICROSOFT, flow: ['device-code'] },
          { authority: RuntimeApi.AUTHORITY_DEV, flow: [] },
          { authority: 'https://auth.example.com', flow: ['password'] },
        ]),
      }),
    },
    '@/composables/notifier': { useNotifier: () => ({ notify }) },
    '../composables/login': {
      useAccountSystemHistory: () => ({
        authority: Vue.ref(RuntimeApi.AUTHORITY_MICROSOFT),
        history: Vue.ref([]),
      }),
      useAuthorityItems: () => Vue.ref([]),
    },
    '../composables/user': { kUserContext: 'user', useLoginValidation },
  }
  const module = { exports: {} as { default: { setup: (props: object, context: object) => LoginState } } }
  new Function('require', 'module', 'exports', compiled)((id: string) => {
    if (!(id in modules)) throw new Error(`Unmocked dependency: ${id}`)
    return modules[id]
  }, module, module.exports)
  const state = scope.run(() => module.exports.default.setup(
    { inside: false },
    { expose: () => {}, emit },
  ))!
  state.accountInput.value = { blur: vi.fn() }
  return state
}

const profileError = {
  message: 'Failed to get Microsoft account game profile',
  exception: { type: 'fetchMinecraftProfileFailed', errorType: 'ProfileNotFoundError' },
}

beforeEach(() => {
  vi.resetAllMocks()
  for (const [name, value] of Object.entries(Vue)) vi.stubGlobal(name, value)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
})

afterEach(() => {
  scope?.stop()
  vi.unstubAllGlobals()
})

describe('login authority error state', () => {
  it('clears Microsoft errors and authorization details when switching to offline', async () => {
    const state = setup()
    state.error.value = profileError
    state.data.password = 'device-code'
    state.data.verificationUri = 'https://microsoft.com/link'
    await Vue.nextTick()
    expect(state.errorMessage.value).toBe('loginError.noProfileForNewUser')
    expect(state.isMicrosoftAuthError.value).toBe(true)
    expect(notify).toHaveBeenCalledOnce()

    state.authority.value = RuntimeApi.AUTHORITY_DEV
    await Vue.nextTick()

    expect(state.error.value).toBeUndefined()
    expect(state.errorMessage.value).toBe('')
    expect(state.isMicrosoftAuthError.value).toBe(false)
    expect(state.data.password).toBe('')
    expect(state.data.verificationUri).toBe('')
    expect(emit).toHaveBeenCalledWith('seed')
  })

  it('does not display a late Microsoft failure in offline mode', async () => {
    let reject!: (reason: unknown) => void
    login.mockReturnValue(new Promise((_resolve, rejectLogin) => { reject = rejectLogin }))
    const state = setup()
    state.data.username = 'player@example.com'
    const pending = state.onLogin()
    await Vue.nextTick()
    state.authority.value = RuntimeApi.AUTHORITY_DEV
    await Vue.nextTick()
    reject(profileError)
    await pending
    await Vue.nextTick()

    expect(state.errorMessage.value).toBe('')
    expect(state.isMicrosoftAuthError.value).toBe(false)
    expect(notify).not.toHaveBeenCalled()

    state.authority.value = RuntimeApi.AUTHORITY_MICROSOFT
    await Vue.nextTick()
    expect(state.errorMessage.value).toBe('')
  })

  it('still reports offline validation errors without Microsoft help', async () => {
    const state = setup()
    state.authority.value = RuntimeApi.AUTHORITY_DEV
    await Vue.nextTick()
    state.data.username = 'invalid name'
    await state.onLogin()

    expect(state.errorMessage.value).toBe('loginError.illegalOfflineUsername')
    expect(state.isMicrosoftAuthError.value).toBe(false)
    expect(login).not.toHaveBeenCalled()
  })

  it('can log in offline after a Microsoft error', async () => {
    const state = setup()
    state.error.value = profileError
    state.authority.value = RuntimeApi.AUTHORITY_DEV
    await Vue.nextTick()
    state.data.username = 'OfflinePlayer'
    login.mockResolvedValue({ id: 'offline-user' })
    await state.onLogin()

    expect(login).toHaveBeenCalledWith(expect.objectContaining({
      authority: RuntimeApi.AUTHORITY_DEV, username: 'OfflinePlayer',
    }))
    expect(select).toHaveBeenCalledWith('offline-user')
    expect(emit).toHaveBeenCalledWith('login', { id: 'offline-user' })
    expect(state.errorMessage.value).toBe('')
  })

  it('clears errors when switching to a third-party service', async () => {
    const state = setup()
    state.error.value = profileError
    state.authority.value = 'https://auth.example.com'
    await Vue.nextTick()
    state.data.username = 'player'
    state.data.password = 'password'
    login.mockRejectedValue(new Error('Invalid credentials'))
    await state.onLogin()

    expect(state.errorMessage.value).toBe('Invalid credentials')
    expect(state.isMicrosoftAuthError.value).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })
})
