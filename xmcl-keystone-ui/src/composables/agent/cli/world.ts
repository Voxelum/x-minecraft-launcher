import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const WORLD_USAGE = 'world <import|export|clone|link> ...'

export function createWorldCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'world',
    usage: WORLD_USAGE,
    description: 'Import, export, clone, or link worlds.',
    help: [
      '`world import <absoluteSource> [saveName]` imports a world zip or folder; the source name is used by default.',
      '`world export <saveName> <absoluteDestination> [--folder]` exports a zip by default.',
      '`world clone <saveName> [newSaveName] [destinationInstancePath]` defaults to the current instance.',
      '`world link <saveName>` uses a singleplayer world as the local dedicated-server world.',
      'Use the world folder name from `vfs_list saves`, and quote names or paths containing spaces.',
      'World deletion uses `vfs_rm` with `saves/<saveName>` and requires confirmation.',
    ],
    execute: async (argv) => {
      const operation = argv[0]
      let valid = false
      if (operation === 'import') valid = argv.length >= 2 && argv.length <= 3
      else if (operation === 'export') valid = argv.length >= 3 && argv.length <= 4 && (argv.length < 4 || argv[3] === '--folder')
      else if (operation === 'clone') valid = argv.length >= 2 && argv.length <= 4
      else if (operation === 'link') valid = argv.length === 2
      if (!valid) return usageError(WORLD_USAGE, 'Invalid world command arguments.')
      const inst = cli.ctx.instance.value.path
      if (!inst) return { error: 'no instance selected' }
      if (operation === 'import') {
        return { ok: true, importedPath: await cli.savesService.importSave({ instancePath: inst, path: argv[1], saveName: argv[2] }) }
      }
      if (operation === 'export') {
        const zip = argv[3] !== '--folder'
        const saveName = argv[1]
        const destination = argv[2]
        if (!cli.ctx.saves.value.some((save) => save.name === saveName || save.path === saveName)) return { error: `world not found: ${saveName}\nUsage: world export <saveName> <destination> [--folder]` }
        await cli.savesService.exportSave({ instancePath: inst, saveName, destination, zip })
        return { ok: true, saveName, destination, zip }
      }
      if (operation === 'clone') {
        const saveName = argv[1]
        if (!cli.ctx.saves.value.some((save) => save.name === saveName || save.path === saveName)) return { error: `world not found: ${saveName}\nUsage: world clone <saveName> [newSaveName] [destinationInstancePath]` }
        await cli.savesService.cloneSave({ srcInstancePath: inst, destInstancePath: argv[3] || inst, saveName, newSaveName: argv[2] })
        return { ok: true, saveName, newSaveName: argv[2], destinationInstancePath: argv[3] || inst }
      }
      const saveName = argv[1]
      if (!cli.ctx.saves.value.some((save) => save.name === saveName || save.path === saveName)) return { error: `world not found: ${saveName}\nUsage: world link <saveName>` }
      await cli.savesService.linkSaveAsServerWorld({ instancePath: inst, saveName })
      return { ok: true, linked: saveName }
    },
  }
}
