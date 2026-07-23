import type { InstanceFile } from '@xmcl/instance'
import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const MV_USAGE = 'mv <src> <dest>'

function asInstanceFile(resource: { path: string; hash: string; size: number; modrinth?: InstanceFile['modrinth']; curseforge?: InstanceFile['curseforge'] }, path: string): InstanceFile {
  return {
    path,
    hashes: { sha1: resource.hash },
    size: resource.size,
    ...(resource.modrinth ? { modrinth: resource.modrinth } : {}),
    ...(resource.curseforge ? { curseforge: resource.curseforge } : {}),
  }
}

export function createMvCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'mv',
    usage: MV_USAGE,
    description: 'Add enabling or disabling a mod, resourcepack, or shaderpack to the instance change list.',
    help: [
      'Only toggles the trailing `.disabled` suffix; changing the base file name or directory is refused.',
      'Disable with `mv mods/foo.jar mods/foo.jar.disabled`; enable by reversing it.',
      'The file is not moved immediately. Inspect with `instance change status`, then run `instance change apply`.',
    ],
    execute: async (argv) => {
      if (argv.length !== 2 || argv.some((arg) => arg.startsWith('-'))) return usageError(MV_USAGE, 'mv expects exactly two paths.')
      const [src, dest] = argv
      const s = cli.pathKind(src)
      const d = cli.pathKind(dest)
      if (s.kind !== d.kind) return { error: `mv cannot move across directories (${s.kind} -> ${d.kind})` }
      if (s.kind !== 'mods' && s.kind !== 'resourcepacks' && s.kind !== 'shaderpacks') return { error: `mv only operates under mods/, resourcepacks/, shaderpacks/. Got: ${src}` }
      if (cli.stripDisabled(s.rest) !== cli.stripDisabled(d.rest)) return { error: 'mv may only toggle the `.disabled` suffix.' }
      const srcDisabled = s.rest.endsWith('.disabled')
      const dstDisabled = d.rest.endsWith('.disabled')
      if (srcDisabled === dstDisabled) return { error: 'mv is a no-op: append `.disabled` to disable, or strip it to enable.' }
      if (!cli.ctx.instance.value.path) return { error: 'no instance selected' }
      const enabling = !dstDisabled
      let resource!: { path: string; hash: string; size: number; modrinth?: InstanceFile['modrinth']; curseforge?: InstanceFile['curseforge'] }
      let name!: string
      if (s.kind === 'mods') {
        const mod = cli.modByPathOrId(s.rest) ?? cli.modByPathOrId(cli.stripDisabled(s.rest))
        if (!mod) return { error: `mod not found: ${s.rest}` }
        resource = mod
        name = mod.fileName
      } else if (s.kind === 'resourcepacks') {
        const pack = cli.findResourcePack(s.rest)
        if (!pack) return { error: `resourcepack not found: ${s.rest}` }
        resource = pack
        name = pack.fileName
      } else {
        const shader = cli.findShaderPack(s.rest)
        if (!shader) return { error: `shaderpack not found: ${s.rest}` }
        resource = shader
        name = shader.fileName
      }
      const oldFile = asInstanceFile(resource, resource.path)
      const newFile = asInstanceFile(resource, `${d.kind}/${d.rest}`)
      const change = await cli.ctx.instanceChanges.add({
        label: `${enabling ? 'enable' : 'disable'} ${s.kind}/${name}`,
        oldFiles: [oldFile],
        files: [newFile],
      })
      return { ok: true, queued: true, action: enabling ? 'enable' : 'disable', kind: s.kind, file: name, change }
    },
  }
}
