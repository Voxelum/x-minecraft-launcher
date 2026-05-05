import { describe, it, expect } from 'vitest'
import { isSpecialFile } from './files_discovery'

describe('Instance Discovery Utilities', () => {
  describe('isSpecialFile', () => {
    it('should not identify as special', () => {
      expect(isSpecialFile('screenshots/screenshot.png')).toBe(false)
      expect(isSpecialFile('screenshots/2023-01-01_12.30.45.png')).toBe(false)
      expect(isSpecialFile('saves/world1/level.dat')).toBe(false)
      expect(isSpecialFile('saves/New World/region/r.0.0.mca')).toBe(false)
      expect(isSpecialFile('config/test.cfg')).toBe(false)
      expect(isSpecialFile('bin/natives/file.dll')).toBe(false)
    })

    it('should   identify regular mod/resource files as special', () => {
      expect(isSpecialFile('mods/test-mod.jar')).toBe(true)
      expect(isSpecialFile('resourcepacks/pack.zip')).toBe(true)
      expect(isSpecialFile('shaderpacks/shader.zip')).toBe(true)
    })

    it('should handle nested paths correctly', () => {
      expect(isSpecialFile('subdir/logs/latest.log')).toBe(false) // Not in root logs
      expect(isSpecialFile('saves/world1/logs/latest.log')).toBe(false) // Within saves
      expect(isSpecialFile('config/saves/backup.dat')).toBe(false) // Not actually saves
    })

    it('should handle empty and edge case paths', () => {
      expect(isSpecialFile('')).toBe(false)
      expect(isSpecialFile('/')).toBe(false)
      expect(isSpecialFile('logs')).toBe(false) // Directory, not file
      expect(isSpecialFile('logs/')).toBe(false) // Directory, not file
    })
  })
})
