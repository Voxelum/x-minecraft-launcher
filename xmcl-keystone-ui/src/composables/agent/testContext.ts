import { ref } from 'vue'
import type { AgentContext } from './tools'

/**
 * Build a fake {@link AgentContext} for unit tests. Every ref/method has a
 * sensible default; pass `overrides` to supply `vi.fn()` spies or specific
 * reactive state for the field under test.
 *
 * Not a `*.test.ts` file, so vitest does not collect it as a suite.
 */
export function makeAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  const base = {
    router: { push: async () => {} },
    instance: ref({ path: '/inst', name: 'Inst', runtime: { minecraft: '1.20.1' } }),
    instances: ref([]),
    selectedInstancePath: ref('/inst'),
    resolvedVersion: ref(undefined),
    javaStatus: ref(undefined),
    java: ref(undefined),
    userProfile: ref({ id: 'u1', username: 'alice', selectedProfile: 'p1', profiles: {}, authority: 'microsoft', invalidated: false, expiredAt: 0 }),
    mods: ref([]),
    resourcePacks: ref([]),
    shaderPacks: ref([]),
    selectedShaderPack: ref(''),
    saves: ref([]),
    gameOptions: ref(undefined),
    installInstruction: ref(undefined),
    fixInstanceInstall: async () => {},
    enableResourcePack: async () => ({}),
    disableResourcePack: async () => ({}),
    selectShaderPack: () => {},
    launch: async () => {},
    killGame: async () => {},
    checkModDependencies: async () => ({}),
    installModDependencies: async () => ({}),
    scanUnusedMods: async () => ({}),
    disableUnusedMods: async () => ({}),
    checkModUpdates: async () => ({}),
    applyModUpdates: async () => ({}),
    javaList: ref([]),
    javaIssue: ref(undefined),
    installJava: async () => ({}),
    getServerStatus: async () => ({}),
    installServer: async () => ({}),
    setServerEula: async () => ({}),
    setServerProperties: async () => ({}),
    deployServerMods: async () => ({}),
    launchServer: async () => ({}),
    setServerFile: async () => ({}),
    accounts: ref([]),
    selectAccount: () => {},
  }
  return { ...base, ...overrides } as unknown as AgentContext
}

/** Find a tool by name (throws if missing, to surface rename regressions). */
export function getTool<T extends { name: string }>(tools: T[], name: string): T {
  const t = tools.find((x) => x.name === name)
  if (!t) throw new Error(`tool not found: ${name} (have: ${tools.map((x) => x.name).join(', ')})`)
  return t
}

/** A throwaway AbortSignal for tools that accept one. */
export const noopSignal = new AbortController().signal
