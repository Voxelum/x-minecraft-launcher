import { describe, it, expect } from 'vitest'
import { isModpackUrl } from './modpackPaste'

describe('isModpackUrl', () => {
  it('recognizes Modrinth URLs', () => {
    expect(isModpackUrl('https://modrinth.com/modpack/fabulously-optimized')).toBe(true)
    expect(isModpackUrl('https://modrinth.com/project/fabulously-optimized')).toBe(true)
    expect(isModpackUrl('https://modrinth.com/modpack/zombie-100-days?version=1.20.1&loader=forge')).toBe(true)
    expect(isModpackUrl('https://modrinth.com/modpack/zombie-100-days/version/2.3.0')).toBe(true)
    expect(isModpackUrl('modrinth://modpack/fabulously-optimized')).toBe(true)
  })

  it('recognizes CurseForge URLs', () => {
    expect(isModpackUrl('https://www.curseforge.com/minecraft/modpacks/all-the-mods-9')).toBe(true)
    expect(isModpackUrl('https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4/files/5123456')).toBe(true)
    expect(isModpackUrl('curseforge://install?addonId=12345')).toBe(true)
  })

  it('recognizes TechnicPack URLs', () => {
    expect(isModpackUrl('https://www.technicpack.net/modpack/the-1122-pack.1406454')).toBe(true)
    expect(isModpackUrl('technic://modpack/the-1122-pack')).toBe(true)
  })

  it('recognizes ATLauncher URLs', () => {
    expect(isModpackUrl('https://atlauncher.com/pack/PixelmonMod')).toBe(true)
    expect(isModpackUrl('https://atlauncher.com/pack/AllTheForge10')).toBe(true)
  })

  it('recognizes BBSMC URLs', () => {
    expect(isModpackUrl('https://bbsmc.net/modpack/vefc')).toBe(true)
    expect(isModpackUrl('https://bbsmc.net/project/the-fool')).toBe(true)
    expect(isModpackUrl('https://bbsmc.net/modpack/vefc/version/dClkgyhJ')).toBe(true)
  })

  it('recognizes PlanetMinecraft URLs', () => {
    expect(isModpackUrl('https://www.planetminecraft.com/mods/tag/modpacks/?order=order_downloads')).toBe(true)
    expect(isModpackUrl('https://www.planetminecraft.com/mod/ben-10-addon/')).toBe(true)
    expect(isModpackUrl('https://www.planetminecraft.com/data-pack/better-adventures/')).toBe(true)
  })

  it('recognizes GitHub repository and release URLs', () => {
    expect(isModpackUrl('https://github.com/Fabulously-Optimized/fabulously-optimized')).toBe(true)
    expect(isModpackUrl('https://github.com/owner/repo/releases/download/v1.0.0/pack.mrpack')).toBe(true)
  })

  it('recognizes direct .mrpack and .zip URLs', () => {
    expect(isModpackUrl('https://cdn.example.com/downloads/pack.mrpack')).toBe(true)
    expect(isModpackUrl('https://cdn.example.com/downloads/pack.zip?token=123')).toBe(true)
  })

  it('rejects non-modpack URLs and plain text', () => {
    expect(isModpackUrl('')).toBe(false)
    expect(isModpackUrl('hello world')).toBe(false)
    expect(isModpackUrl('https://google.com')).toBe(false)
    expect(isModpackUrl('https://youtube.com/watch?v=123')).toBe(false)
    expect(isModpackUrl('C:\\Games\\Minecraft')).toBe(false)
  })
})
