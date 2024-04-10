import { ProjectType } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'

export const kMarketRoute: InjectionKey<ReturnType<typeof useMarketRoute>> = Symbol('MarketRoute')

export function useSearchInMcWiki() {
  function searchInMcWiki(name: string) {
    window.open(`https://www.mcmod.cn/s?key=${name}`, 'browser')
  }
  return {
    searchInMcWiki,
  }
}

export function useMarketRoute() {
  let modrinthWindow: Window | null = null
  function goToModrinth(route = '/modrinth') {
    if (!modrinthWindow || modrinthWindow.closed) {
      modrinthWindow = window.open('app.html?route=' + route, '_blank')
    } else {
      modrinthWindow.focus()
      modrinthWindow.postMessage({ route })
    }
  }

  let curseforgeWindow: Window | null = null
  function goToCurseforge(route = '/curseforge/modpacks') {
    if (!curseforgeWindow || curseforgeWindow.closed) {
      curseforgeWindow = window.open('app.html?route=' + route, '_blank')
    } else {
      curseforgeWindow.focus()
      curseforgeWindow.postMessage({ route })
    }
  }

  let ftbWindow: Window | null = null
  function goToFtb(route = '/ftb') {
    if (!ftbWindow || ftbWindow.closed) {
      ftbWindow = window.open('app.html?route=' + route, '_blank')
    } else {
      ftbWindow.focus()
      ftbWindow.postMessage({ route })
    }
  }

  function searchInCurseforge(name: string, type: ProjectType) {
    goToCurseforge(`/curseforge/${type}?keyword=${name}`)
  }
  function searchInModrinth(name: string, type: 'mod' | 'modpack' | 'resourcepack' | 'shader') {
    goToModrinth(`/modrinth?query=${name}&projectType=${type}`)
  }
  function goCurseforgeProject(projectId: number, type: ProjectType) {
    goToCurseforge(`/curseforge/${type}/${projectId}`)
  }
  function goModrinthProject(projectId: string) {
    goToModrinth(`/modrinth/${projectId}`)
  }
  function searchInMcWiki(name: string) {
    window.open(`https://www.mcmod.cn/s?key=${name}`, 'browser')
  }

  return {
    goToCurseforge,
    goToModrinth,
    goToFtb,
    searchInMcWiki,
    searchInCurseforge,
    goCurseforgeProject,
    goModrinthProject,
    searchInModrinth,
  }
}
