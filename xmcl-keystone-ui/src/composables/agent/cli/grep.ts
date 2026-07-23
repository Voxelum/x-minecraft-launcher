import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const GREP_USAGE = 'grep [-i] <pattern> [config/...]'

export function createGrepCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'grep',
    usage: GREP_USAGE,
    description: 'Search instance config files with a regular expression.',
    help: [
      '`-i` makes matching case-insensitive. With no path, all files under `config/` are searched.',
      'A path may name one config file or a config subdirectory. Results contain file, line, and text.',
      'At most 200 matches are returned; config files larger than 512 KiB are skipped.',
    ],
    execute: async (argv) => {
      let ignoreCase = false
      const positionals: string[] = []
      for (const arg of argv) {
        if (arg.startsWith('-') && arg.length > 1) {
          if (arg !== '-i' || ignoreCase) return usageError(GREP_USAGE, 'Unknown or repeated grep option.')
          ignoreCase = true
        } else positionals.push(arg)
      }
      if (!positionals.length) return usageError(GREP_USAGE, 'grep expects a search pattern.')
      const [pattern, ...paths] = positionals
      let re: RegExp
      try { re = new RegExp(pattern, ignoreCase ? 'i' : '') }
      catch (e) { return { error: `invalid grep pattern: ${e instanceof Error ? e.message : String(e)}` } }
      const inst = cli.ctx.instance.value.path
      if (!inst) return { error: 'no instance selected' }
      const prefixes: string[] = []
      for (const path of (paths.length ? paths : ['config'])) {
        const { kind, rest } = cli.pathKind(path)
        if (kind !== 'config') return { error: `grep only searches files under config/. Got: ${path}` }
        prefixes.push(rest)
      }
      const allFiles = await cli.optionsService.getInstanceConfigFiles(inst).catch(() => [] as string[])
      const selected = new Set<string>()
      for (const prefix of prefixes) {
        if (!prefix) { allFiles.forEach((file) => selected.add(file)); continue }
        for (const file of allFiles) if (file === prefix || file.startsWith(prefix + '/')) selected.add(file)
      }
      if (!selected.size) return { matches: [], note: 'no matching config files' }
      const matches: { file: string; line: number; text: string }[] = []
      let truncated = false
      for (const file of selected) {
        let content: string
        try { content = await cli.optionsService.getInstanceConfig(inst, file) }
        catch { continue }
        if (content.length > 512 * 1024) continue
        for (const [index, line] of content.split('\n').entries()) {
          if (re.test(line)) {
            matches.push({ file: `config/${file}`, line: index + 1, text: line.slice(0, 400) })
            if (matches.length >= 200) { truncated = true; break }
          }
        }
        if (truncated) break
      }
      return truncated ? { matches, truncated: true } : { matches }
    },
  }
}
