import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createModMaintenanceTools } from './modMaintenanceTools'
import { createJavaTools } from './javaTools'
import { makeAgentContext, getTool, noopSignal } from './testContext'

// These two factories are merged into the `troubleshoot` pack (see tools.ts).
describe('troubleshoot pack — mod maintenance tools', () => {
  test('exposes the expected tool set with the right readonly flags', () => {
    const tools = createModMaintenanceTools(makeAgentContext())
    expect(tools.map((t) => t.name).sort()).toEqual([
      'apply_mod_updates',
      'check_mod_dependencies',
      'check_mod_updates',
      'disable_unused_mods',
      'install_mod_dependencies',
      'scan_unused_mods',
    ].sort())
    const ro = tools.filter((t) => t.readonly).map((t) => t.name).sort()
    expect(ro).toEqual(['check_mod_dependencies', 'check_mod_updates', 'scan_unused_mods'].sort())
  })

  test('each tool delegates to its ctx method', async () => {
    const ctx = makeAgentContext({
      checkModDependencies: vi.fn().mockResolvedValue({ missing: [] }),
      installModDependencies: vi.fn().mockResolvedValue({ installed: 0 }),
      scanUnusedMods: vi.fn().mockResolvedValue({ unused: [] }),
      disableUnusedMods: vi.fn().mockResolvedValue({ disabled: 0 }),
      applyModUpdates: vi.fn().mockResolvedValue({ upgraded: 0 }),
    })
    const tools = createModMaintenanceTools(ctx)
    expect(await getTool(tools, 'check_mod_dependencies').execute({}, noopSignal)).toEqual({ missing: [] })
    expect(await getTool(tools, 'install_mod_dependencies').execute({}, noopSignal)).toEqual({ installed: 0 })
    expect(await getTool(tools, 'scan_unused_mods').execute({}, noopSignal)).toEqual({ unused: [] })
    expect(await getTool(tools, 'disable_unused_mods').execute({}, noopSignal)).toEqual({ disabled: 0 })
    expect(await getTool(tools, 'apply_mod_updates').execute({}, noopSignal)).toEqual({ upgraded: 0 })
    expect(ctx.checkModDependencies).toHaveBeenCalledTimes(1)
  })

  test('check_mod_updates forwards policy + skipVersion', async () => {
    const checkModUpdates = vi.fn().mockResolvedValue({ updates: [] })
    const tools = createModMaintenanceTools(makeAgentContext({ checkModUpdates }))
    await getTool(tools, 'check_mod_updates').execute({ policy: 'modrinthOnly', skipVersion: true }, noopSignal)
    expect(checkModUpdates).toHaveBeenCalledWith({ policy: 'modrinthOnly', skipVersion: true })
  })

  test('check_mod_updates leaves omitted options undefined (use user defaults)', async () => {
    const checkModUpdates = vi.fn().mockResolvedValue({ updates: [] })
    const tools = createModMaintenanceTools(makeAgentContext({ checkModUpdates }))
    await getTool(tools, 'check_mod_updates').execute({}, noopSignal)
    expect(checkModUpdates).toHaveBeenCalledWith({ policy: undefined, skipVersion: undefined })
  })
})

describe('troubleshoot pack — java tools', () => {
  test('exposes diagnose_java (readonly) and install_java', () => {
    const tools = createJavaTools(makeAgentContext())
    expect(tools.map((t) => t.name).sort()).toEqual(['diagnose_java', 'install_java'])
    expect(getTool(tools, 'diagnose_java').readonly).toBe(true)
    expect(getTool(tools, 'install_java').readonly).toBeFalsy()
  })

  test('diagnose_java reports unavailable when there is no java status', async () => {
    const tools = createJavaTools(makeAgentContext({ javaStatus: ref(undefined) as any }))
    const res = await getTool(tools, 'diagnose_java').execute({}, noopSignal) as any
    expect(res.available).toBe(false)
  })

  test('diagnose_java summarizes the status and installed runtimes', async () => {
    const ctx = makeAgentContext({
      javaStatus: ref({ java: { path: '/jdk17', version: '17', majorVersion: 17, valid: true }, javaVersion: { majorVersion: 17 }, compatible: 0, noJava: false }) as any,
      javaIssue: ref(undefined) as any,
      javaList: ref([{ path: '/jdk17', version: '17', majorVersion: 17, valid: true }]) as any,
    })
    const res = await getTool(createJavaTools(ctx), 'diagnose_java').execute({}, noopSignal) as any
    expect(res).toMatchObject({
      available: true,
      issue: 'none',
      requiredMajorVersion: 17,
      compatibility: 'matched',
      selectedJava: { path: '/jdk17', majorVersion: 17 },
    })
    expect(res.installedJavas).toHaveLength(1)
  })

  test('install_java delegates to ctx.installJava', async () => {
    const installJava = vi.fn().mockResolvedValue({ ok: true, path: '/jdk17' })
    const tools = createJavaTools(makeAgentContext({ installJava }))
    const res = await getTool(tools, 'install_java').execute({}, noopSignal)
    expect(installJava).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ ok: true, path: '/jdk17' })
  })
})
