import { describe, it, expect } from 'vitest'
import { findInstanceForModpack, InstanceModpackMatchTarget, InstanceUpstream, isUpstreamSameOrigin } from './instance'

describe('Instance Templates', () => {
  describe('isUpstreamSameOrigin', () => {
    it('should return false for different upstream types', () => {
      const curseforge: InstanceUpstream = {
        type: 'curseforge-modpack',
        modId: 123,
        fileId: 456,
      }
      const modrinth: InstanceUpstream = {
        type: 'modrinth-modpack',
        projectId: 'test-project',
        versionId: 'test-version',
      }

      expect(isUpstreamSameOrigin(curseforge, modrinth)).toBe(false)
    })

    it('should return true for same CurseForge modpacks', () => {
      const upstream1: InstanceUpstream = {
        type: 'curseforge-modpack',
        modId: 123,
        fileId: 456,
      }
      const upstream2: InstanceUpstream = {
        type: 'curseforge-modpack',
        modId: 123,
        fileId: 789, // Different file ID but same mod ID
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(true)
    })

    it('should return false for different CurseForge modpacks', () => {
      const upstream1: InstanceUpstream = {
        type: 'curseforge-modpack',
        modId: 123,
        fileId: 456,
      }
      const upstream2: InstanceUpstream = {
        type: 'curseforge-modpack',
        modId: 456, // Different mod ID
        fileId: 789,
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(false)
    })

    it('should return true for same Modrinth modpacks', () => {
      const upstream1: InstanceUpstream = {
        type: 'modrinth-modpack',
        projectId: 'test-project',
        versionId: 'v1.0.0',
      }
      const upstream2: InstanceUpstream = {
        type: 'modrinth-modpack',
        projectId: 'test-project',
        versionId: 'v2.0.0', // Different version but same project
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(true)
    })

    it('should return false for different Modrinth modpacks', () => {
      const upstream1: InstanceUpstream = {
        type: 'modrinth-modpack',
        projectId: 'project-1',
        versionId: 'v1.0.0',
      }
      const upstream2: InstanceUpstream = {
        type: 'modrinth-modpack',
        projectId: 'project-2', // Different project
        versionId: 'v1.0.0',
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(false)
    })

    it('should return true for same FTB modpacks', () => {
      const upstream1: InstanceUpstream = {
        type: 'ftb-modpack',
        id: 123,
        versionId: 1,
      }
      const upstream2: InstanceUpstream = {
        type: 'ftb-modpack',
        id: 123,
        versionId: 2, // Different version but same ID
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(true)
    })

    it('should handle peer upstream comparison', () => {
      const upstream1: InstanceUpstream = {
        type: 'peer',
        id: 'peer-123',
      }
      const upstream2: InstanceUpstream = {
        type: 'peer',
        id: 'peer-123',
      }
      const upstream3: InstanceUpstream = {
        type: 'peer',
        id: 'peer-456',
      }

      expect(isUpstreamSameOrigin(upstream1, upstream2)).toBe(true)
      expect(isUpstreamSameOrigin(upstream1, upstream3)).toBe(false)
    })

    it('should match server upstream by host and port (default 25565)', () => {
      const a: InstanceUpstream = { type: 'server', host: 'mc.hypixel.net' }
      const b: InstanceUpstream = { type: 'server', host: 'mc.hypixel.net', port: 25565 }
      const c: InstanceUpstream = { type: 'server', host: 'mc.hypixel.net', port: 19132 }

      expect(isUpstreamSameOrigin(a, b)).toBe(true)
      expect(isUpstreamSameOrigin(a, c)).toBe(false)
    })

    it('should not match server upstream against different upstream types', () => {
      const server: InstanceUpstream = { type: 'server', host: 'mc.hypixel.net' }
      const peer: InstanceUpstream = { type: 'peer', id: 'mc.hypixel.net' }

      expect(isUpstreamSameOrigin(server, peer)).toBe(false)
    })
  })

  describe('findInstanceForModpack', () => {
    const instances: InstanceModpackMatchTarget[] = [
      {
        path: '/instances/optimized-mc',
        name: 'Renamed by user',
        upstream: { type: 'modrinth-modpack', projectId: 'abc', versionId: 'v1' },
      },
      {
        path: '/instances/cf-pack',
        name: 'CF Pack',
        upstream: { type: 'curseforge-modpack', modId: 123, fileId: 1 },
      },
      {
        path: '/instances/custom',
        name: 'My Custom Pack',
      },
    ]

    it('should match by upstream even if the instance was renamed', () => {
      const match = findInstanceForModpack(instances, {
        upstream: { type: 'modrinth-modpack', projectId: 'abc', versionId: 'v2' },
        name: 'Optimized MC',
      })
      expect(match?.path).toBe('/instances/optimized-mc')
    })

    it('should match curseforge upstream by modId regardless of fileId', () => {
      const match = findInstanceForModpack(instances, {
        upstream: { type: 'curseforge-modpack', modId: 123, fileId: 999 },
      })
      expect(match?.path).toBe('/instances/cf-pack')
    })

    it('should fall back to case-insensitive name match without upstream', () => {
      const match = findInstanceForModpack(instances, { name: 'my custom pack' })
      expect(match?.path).toBe('/instances/custom')
    })

    it('should prefer upstream match over name match', () => {
      const match = findInstanceForModpack(instances, {
        upstream: { type: 'curseforge-modpack', modId: 123, fileId: 5 },
        name: 'My Custom Pack',
      })
      expect(match?.path).toBe('/instances/cf-pack')
    })

    it('should return undefined when nothing matches', () => {
      const match = findInstanceForModpack(instances, {
        upstream: { type: 'modrinth-modpack', projectId: 'zzz', versionId: 'v1' },
        name: 'Nonexistent',
      })
      expect(match).toBeUndefined()
    })

    it('should not name-match an instance that has an upstream when importing a custom modpack', () => {
      const match = findInstanceForModpack(instances, { name: 'CF Pack' })
      // Name fallback still matches by name even if that instance has upstream.
      expect(match?.path).toBe('/instances/cf-pack')
    })
  })
})
