import { describe, expect, test } from 'vitest'
import {
  getMarketRoutePathFromCurseforgeUrl,
  getMarketRoutePathFromModrinthProjectType,
  getMarketRoutePathFromModrinthUrl,
} from './marketRoute'

describe('marketRoute', () => {
  test('routes Modrinth content urls to their launcher pages', () => {
    expect(getMarketRoutePathFromModrinthUrl(new URL('https://modrinth.com/mod/sodium'))).toBe('/mods')
    expect(getMarketRoutePathFromModrinthUrl(new URL('https://modrinth.com/resourcepack/translations-for-sodium'))).toBe('/resourcepacks')
    expect(getMarketRoutePathFromModrinthUrl(new URL('https://modrinth.com/shader/complementary-reimagined'))).toBe('/shaderpacks')
  })

  test('routes Modrinth project types to their launcher pages', () => {
    expect(getMarketRoutePathFromModrinthProjectType('mod')).toBe('/mods')
    expect(getMarketRoutePathFromModrinthProjectType('resourcepack')).toBe('/resourcepacks')
    expect(getMarketRoutePathFromModrinthProjectType('shader')).toBe('/shaderpacks')
    expect(getMarketRoutePathFromModrinthProjectType('modpack')).toBeUndefined()
  })

  test('routes CurseForge content urls to their launcher pages', () => {
    expect(getMarketRoutePathFromCurseforgeUrl(new URL('https://www.curseforge.com/minecraft/mc-mods/sodium'))).toBe('/mods')
    expect(getMarketRoutePathFromCurseforgeUrl(new URL('https://www.curseforge.com/minecraft/texture-packs/fresh-animations'))).toBe('/resourcepacks')
    expect(getMarketRoutePathFromCurseforgeUrl(new URL('https://www.curseforge.com/minecraft/shaders/complementary-reimagined'))).toBe('/shaderpacks')
  })
})
