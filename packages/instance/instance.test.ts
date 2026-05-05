import { describe, it, expect } from 'vitest'
import { InstanceUpstream, isUpstreamSameOrigin } from './instance'

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
  })
})
