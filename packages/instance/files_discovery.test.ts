import { describe, it, expect } from 'vitest'
import { isSpecialFile, isWindowsReservedName } from './files_discovery'

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

  describe('isWindowsReservedName', () => {
    it('matches the kernel-locked drive-root files', () => {
      expect(isWindowsReservedName('pagefile.sys')).toBe(true)
      expect(isWindowsReservedName('hiberfil.sys')).toBe(true)
      expect(isWindowsReservedName('swapfile.sys')).toBe(true)
      expect(isWindowsReservedName('DumpStack.log')).toBe(true)
      expect(isWindowsReservedName('DumpStack.log.tmp')).toBe(true)
    })

    it('matches Windows special directories', () => {
      expect(isWindowsReservedName('System Volume Information')).toBe(true)
      expect(isWindowsReservedName('$RECYCLE.BIN')).toBe(true)
      expect(isWindowsReservedName('$WinREAgent')).toBe(true)
      expect(isWindowsReservedName('$SysReset')).toBe(true)
      expect(isWindowsReservedName('$GetCurrent')).toBe(true)
    })

    it('is case-insensitive and works on absolute paths', () => {
      expect(isWindowsReservedName('PAGEFILE.SYS')).toBe(true)
      expect(isWindowsReservedName('D:\\pagefile.sys')).toBe(true)
      expect(isWindowsReservedName('/mnt/d/pagefile.sys')).toBe(true)
      expect(isWindowsReservedName('C:\\System Volume Information')).toBe(true)
    })

    it('does not match regular Minecraft files or look-alikes', () => {
      expect(isWindowsReservedName('mods/test-mod.jar')).toBe(false)
      expect(isWindowsReservedName('saves/world1/level.dat')).toBe(false)
      expect(isWindowsReservedName('pagefile.sys.bak')).toBe(false)
      expect(isWindowsReservedName('mypagefile.sys')).toBe(false)
      expect(isWindowsReservedName('')).toBe(false)
    })
  })
})
