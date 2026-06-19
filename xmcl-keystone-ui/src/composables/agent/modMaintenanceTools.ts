import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Lazy-loaded mod maintenance tools. Part of the `troubleshoot` pack
 * (`load_tools(["troubleshoot"])`), alongside the Java tools.
 *
 * Mirrors the launcher's "Mod options" page (dependency check, unused-library
 * cleaner, update checker) so the agent can fix the most common mod-related
 * launch failures: a missing required dependency or an outdated mod. Each
 * "apply" tool acts on the result of its matching "check" tool, so always run
 * the check first.
 */
export function createModMaintenanceTools(ctx: AgentContext): Tool[] {
  return [
    {
      name: 'check_mod_dependencies',
      readonly: true,
      description: 'Resolve the *required* dependencies of the installed mods and report any that are missing. A missing required dependency is one of the most common crash / launch-failure causes. Returns `missing` as a list of `{ file, requiredBy }`. Follow up with `install_mod_dependencies` to add them.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.checkModDependencies()
      },
    },
    {
      name: 'install_mod_dependencies',
      description: 'Download & install the missing required dependencies found by `check_mod_dependencies` into the current instance. Run `check_mod_dependencies` first.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.installModDependencies()
      },
    },
    {
      name: 'scan_unused_mods',
      readonly: true,
      description: 'Scan for installed *library* mods that nothing else depends on (orphan libraries). Returns `unused` as a list of `{ path }`. Follow up with `disable_unused_mods` to disable them.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.scanUnusedMods()
      },
    },
    {
      name: 'disable_unused_mods',
      description: 'Disable (rename to `.disabled`, not delete) the unused library mods found by `scan_unused_mods`. Run `scan_unused_mods` first.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.disableUnusedMods()
      },
    },
    {
      name: 'check_mod_updates',
      readonly: true,
      description: 'Check Modrinth / CurseForge for newer versions of the installed mods that match the instance loader & Minecraft version. Returns `updates` as a list of `{ mod, from, to, source }`. Follow up with `apply_mod_updates`.',
      parameters: {
        type: 'object',
        properties: {
          policy: {
            type: 'string',
            enum: ['modrinth', 'curseforge', 'modrinthOnly', 'curseforgeOnly'],
            description: 'Source preference: `modrinth`/`curseforge` prefer one but fall back to the other; `modrinthOnly`/`curseforgeOnly` restrict to a single source. Defaults to the user\'s configured policy.',
          },
          skipVersion: {
            type: 'boolean',
            description: 'When true, ignore updates whose file does not list the current Minecraft version. Defaults to the user\'s setting.',
          },
        },
      },
      async execute(args) {
        return ctx.checkModUpdates({
          policy: args.policy === undefined ? undefined : String(args.policy),
          skipVersion: args.skipVersion === undefined ? undefined : !!args.skipVersion,
        })
      },
    },
    {
      name: 'apply_mod_updates',
      description: 'Apply the mod updates found by `check_mod_updates`, replacing each outdated mod with its newer version. Run `check_mod_updates` first.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.applyModUpdates()
      },
    },
  ]
}
