export type MarketRoutePath = '/mods' | '/resourcepacks' | '/shaderpacks'

export function getMarketRoutePathFromModrinthUrl(url: URL): MarketRoutePath | undefined {
  if (url.host !== 'modrinth.com') return undefined
  if (url.pathname.startsWith('/mod/')) return '/mods'
  if (url.pathname.startsWith('/shader/')) return '/shaderpacks'
  if (url.pathname.startsWith('/resourcepack/')) return '/resourcepacks'
}

export function getMarketRoutePathFromModrinthProjectType(type?: string): MarketRoutePath | undefined {
  if (type === 'mod') return '/mods'
  if (type === 'shader') return '/shaderpacks'
  if (type === 'resourcepack') return '/resourcepacks'
}

export function getMarketRoutePathFromCurseforgeUrl(url: URL): MarketRoutePath | undefined {
  if (url.host !== 'www.curseforge.com' && url.host !== 'curseforge.com') return undefined
  if (url.pathname.startsWith('/minecraft/mc-mods/')) return '/mods'
  if (url.pathname.startsWith('/minecraft/texture-packs/')) return '/resourcepacks'
  if (url.pathname.startsWith('/minecraft/shaders/')) return '/shaderpacks'
}
