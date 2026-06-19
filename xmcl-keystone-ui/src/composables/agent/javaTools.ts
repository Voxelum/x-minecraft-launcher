import type { AgentContext } from './tools'
import type { Tool } from './loop'

function compatLabel(compatible: number | undefined): string {
  if (compatible === undefined) return 'unknown'
  // JavaCompatibleState: 0=Matched, 1=MayIncompatible, 2=VeryLikelyIncompatible
  if (compatible === 0) return 'matched'
  if (compatible === 1) return 'may-incompatible'
  if (compatible === 2) return 'very-likely-incompatible'
  return String(compatible)
}

/**
 * Lazy-loaded Java tools. Part of the `troubleshoot` pack
 * (`load_tools(["troubleshoot"])`), alongside the mod-maintenance tools.
 *
 * Lets the agent inspect the instance's Java setup and install a compatible
 * runtime when the game fails to launch or crashes because of a wrong, invalid,
 * or missing Java version. After `install_java`, the newly installed runtime is
 * added to the launcher and the instance auto-selects it (when the instance has
 * no manually pinned Java), so no extra step is needed.
 */
export function createJavaTools(ctx: AgentContext): Tool[] {
  return [
    {
      name: 'diagnose_java',
      readonly: true,
      description: 'Report the current instance\'s Java setup: the selected runtime, the Java major version the instance requires, the detected compatibility, and the list of Java runtimes the launcher knows about. `issue` is `invalid` (the selected Java is broken), `incompatible` (wrong major version), or absent (healthy). Run this before `install_java`.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        const status = ctx.javaStatus.value
        if (!status) return { available: false, note: 'No Java status yet (no instance selected or version not resolved).' }
        const selected = status.java
        return {
          available: true,
          issue: ctx.javaIssue.value ?? 'none',
          noJavaFound: !!status.noJava,
          requiredMajorVersion: status.javaVersion?.majorVersion,
          compatibility: compatLabel(status.compatible),
          selectedJava: selected
            ? { path: selected.path, version: selected.version, majorVersion: selected.majorVersion, valid: selected.valid }
            : null,
          installedJavas: ctx.javaList.value.map((j) => ({
            path: j.path,
            version: j.version,
            majorVersion: j.majorVersion,
            valid: j.valid,
          })),
        }
      },
    },
    {
      name: 'install_java',
      description: 'Download & install the exact Java runtime the current instance requires (the `requiredMajorVersion` from diagnose_java) into the launcher. The instance auto-selects the new runtime afterwards. Use this to fix an `invalid` or `incompatible` Java issue, or when no Java is found.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return ctx.installJava()
      },
    },
  ]
}
