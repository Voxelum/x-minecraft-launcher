import * as THREE from 'three'

/**
 * A process-wide cache of block textures keyed by block id. Block textures are
 * immutable, so they are loaded at most once and shared across every blueprint
 * preview — switching back to a previously-viewed blueprint reuses the cached
 * texture instead of re-requesting it (the Electron custom-protocol responses
 * are not stored in Chromium's HTTP cache, so we cache here instead).
 *
 * Cached textures are intentionally never disposed: they are shared by many
 * materials and live for the app session. Materials referencing them can be
 * disposed safely — `Material.dispose()` does not dispose its `map`.
 */
const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture | null | Promise<THREE.Texture | null>>()

export function blockTextureUrl(block: string, instancePath?: string, face?: string) {
  let url = `http://launcher/block-texture?block=${encodeURIComponent(block)}`
  if (instancePath) {
    url += `&instance=${encodeURIComponent(instancePath)}`
  }
  if (face) {
    url += `&face=${encodeURIComponent(face)}`
  }
  return url
}

/**
 * Load a block's texture, deduped by block id, instance, and face. Resolves to `null` when the
 * block has no resolvable texture (HTTP 404), so callers keep a fallback color.
 */
export function loadBlockTexture(block: string, instancePath?: string, face?: string): Promise<THREE.Texture | null> {
  const cacheKey = `${instancePath || ''}|${block}|${face || 'default'}`
  const existing = cache.get(cacheKey)
  if (existing instanceof Promise) return existing
  if (existing !== undefined) return Promise.resolve(existing)

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    loader.load(
      blockTextureUrl(block, instancePath, face),
      (texture) => {
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.NearestFilter
        ;(texture as any).colorSpace = (THREE as any).SRGBColorSpace
        cache.set(cacheKey, texture)
        resolve(texture)
      },
      undefined,
      () => {
        cache.set(cacheKey, null)
        resolve(null)
      },
    )
  })
  cache.set(cacheKey, promise)
  return promise
}
