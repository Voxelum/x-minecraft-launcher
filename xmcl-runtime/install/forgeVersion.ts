/**
 * Repair a known malformed Forge coordinate where the Minecraft patch segment
 * was dropped (for example `1.20-46.0.14` while the selected Minecraft
 * version is `1.20.1`). Do not rewrite unrelated/custom Forge coordinates.
 */
export function normalizeForgeVersion(minecraftVersion: string, forgeVersion: string) {
  const dash = forgeVersion.indexOf('-')
  if (dash <= 0) return forgeVersion

  const embeddedMinecraft = forgeVersion.slice(0, dash)
  if (
    /^\d+\.\d+$/.test(embeddedMinecraft) &&
    minecraftVersion.startsWith(`${embeddedMinecraft}.`)
  ) {
    return `${minecraftVersion}${forgeVersion.slice(dash)}`
  }
  return forgeVersion
}
