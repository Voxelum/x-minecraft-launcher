export type DeskGapUpdateCapability = 'windows-exe' | 'manual'

/** Keep platform selection ahead of native API, network session and path access.
 * A future macOS Sparkle adapter must be an explicit, independently gated branch.
 */
export function getDeskGapUpdateCapability(platform: NodeJS.Platform, arch: string): DeskGapUpdateCapability {
  return platform === 'win32' && arch === 'x64' ? 'windows-exe' : 'manual'
}
