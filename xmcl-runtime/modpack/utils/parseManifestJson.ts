/**
 * Parse a JSON modpack manifest, tolerating a leading UTF-8 BOM.
 *
 * Some authors export `manifest.json` / `modrinth.index.json` /
 * `mmc-pack.json` from editors that write a BOM. The bare
 * `JSON.parse(buf.toString())` then throws a generic `SyntaxError` that
 * was showing up in App Insights (`Object.readManifest` BOM bucket).
 *
 * Centralising the strip keeps the fix in one place across the four
 * modpack handlers.
 */
export function parseManifestJson<T = unknown>(buf: Buffer | string): T {
  let text = typeof buf === 'string' ? buf : buf.toString('utf-8')
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return JSON.parse(text) as T
}
