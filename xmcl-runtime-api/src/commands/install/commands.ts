import { z } from 'zod'
import { defineCommand } from '../registry'
import { InstanceModsServiceKey } from '../../services/InstanceModsService'
import { InstanceResourcePacksServiceKey } from '../../services/InstanceResourcePacksService'
import { InstanceShaderPacksServiceKey } from '../../services/InstanceShaderPacksService'
import { InstanceSavesServiceKey } from '../../services/InstanceSavesService'
import { MarketRefInputSchema, assertInstallable, installResource } from './installResource'

const baseInputShape = {
  ref: MarketRefInputSchema,
  instance: z.string().min(1),
}

/** Stage a mod (Modrinth, CurseForge, or local file) for an instance. */
export const installModCommand = defineCommand({
  id: 'mod.install',
  title: 'Install Mod',
  description: 'Stage a mod using exactly one ref: modrinth:<project>@<version>, curseforge:<projectId>/<fileId>, or a local file path.',
  category: 'mod',
  input: z.object({ ...baseInputShape, dependencies: z.boolean().default(true) }),
  cli: {
    name: 'install-mod',
    positionals: ['ref'],
    flags: {
      instance: { alias: 'i', description: 'Instance path or name' },
      dependencies: { type: 'boolean', description: 'Resolve and stage required dependencies (default: true)' },
    },
  },
  ui: { icon: 'extension' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const staged = await ctx.task('Stage Mod', () => installResource(ctx, InstanceModsServiceKey, inst.path, input.ref))
    if (ctx.mode !== 'renderer') ctx.out.log(`Staged ${staged.length} file(s) for ${inst.path}/mods`)
    ctx.out.json({ ok: true, command: 'mod.install', data: { files: staged, instance: inst.path, staged: true } })
    return staged
  },
})

/** Stage a resource pack for an instance. */
export const installResourcePackCommand = defineCommand({
  id: 'resourcepack.install',
  title: 'Install Resource Pack',
  description: 'Stage a resource pack using exactly one ref: modrinth:<project>@<version>, curseforge:<projectId>/<fileId>, or a local file path.',
  category: 'resourcepack',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-resourcepack',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'palette' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const staged = await ctx.task('Stage ResourcePack', () => installResource(ctx, InstanceResourcePacksServiceKey, inst.path, input.ref))
    if (ctx.mode !== 'renderer') ctx.out.log(`Staged ${staged.length} file(s) for ${inst.path}/resourcepacks`)
    ctx.out.json({ ok: true, command: 'resourcepack.install', data: { files: staged, instance: inst.path, staged: true } })
    return staged
  },
})

/** Stage a shader pack for an instance. */
export const installShaderPackCommand = defineCommand({
  id: 'shaderpack.install',
  title: 'Install Shader Pack',
  description: 'Stage a shader pack using exactly one ref: modrinth:<project>@<version>, curseforge:<projectId>/<fileId>, or a local file path.',
  category: 'shaderpack',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-shaderpack',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'smart_toy' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const staged = await ctx.task('Stage ShaderPack', () => installResource(ctx, InstanceShaderPacksServiceKey, inst.path, input.ref))
    if (ctx.mode !== 'renderer') ctx.out.log(`Staged ${staged.length} file(s) for ${inst.path}/shaderpacks`)
    ctx.out.json({ ok: true, command: 'shaderpack.install', data: { files: staged, instance: inst.path, staged: true } })
    return staged
  },
})

/** Stage a save (world) for an instance. */
export const installSaveCommand = defineCommand({
  id: 'save.install',
  title: 'Install Save',
  description: 'Stage a save (world) using exactly one ref: modrinth:<project>@<version>, curseforge:<projectId>/<fileId>, or a local file path.',
  category: 'save',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-save',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'public' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const staged = await ctx.task('Stage Save', () => installResource(ctx, InstanceSavesServiceKey, inst.path, input.ref))
    if (ctx.mode !== 'renderer') ctx.out.log(`Staged ${staged.length} file(s) for ${inst.path}/saves`)
    ctx.out.json({ ok: true, command: 'save.install', data: { files: staged, instance: inst.path, staged: true } })
    return staged
  },
})
