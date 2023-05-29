import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { ModItem } from './instanceModItems'
import { useService } from './service'
import { kMarketRoute } from './useMarketRoute'

export function useModItemContextMenuItems(mod: Ref<ModItem>, onDelete: () => void, onCreateTag: (group?: boolean) => void) {
  const { t } = useI18n()
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { searchInCurseforge, goModrinthProject, goCurseforgeProject, searchInModrinth, searchInMcWiki } = injection(kMarketRoute)

  return computed(() => {
    const item = mod.value
    const items: ContextMenuItem[] = [{
      text: t('mod.showFile', { file: item.mod.path }),
      onClick: () => {
        showItemInDirectory(item.mod.path)
      },
      icon: 'folder',
    }, {
      text: t('tag.create'),
      onClick: () => {
        onCreateTag()
      },
      icon: 'add',
    }]
    if (item.selected) {
      items.push({
        text: t('tag.createSelected'),
        onClick: () => {
          onCreateTag(true)
        },
        icon: 'add',
      })
    }
    items.push({
      text: t('delete.name', { name: item.mod.name }),
      onClick() {
        onDelete()
      },
      icon: 'delete',
      color: 'error',
    })
    if (item.mod.url) {
      const url = item.mod.url
      items.push({
        text: t('mod.openLink', { url }),
        onClick: () => {
          window.open(url, 'browser')
        },
        icon: 'link',
      })
    }
    if (item.mod.resource.metadata.curseforge) {
      const curseforge = item.mod.resource.metadata.curseforge
      items.push({
        text: t('mod.showInCurseforge', { name: item.mod.name }),
        onClick: () => {
          goCurseforgeProject(curseforge.projectId, 'mc-mods')
        },
        icon: '$vuetify.icons.curseforge',
      })
    } else {
      items.push({
        text: t('mod.searchOnCurseforge', { name: item.mod.name }),
        onClick: () => {
          searchInCurseforge(item.mod.name, 'mc-mods')
        },
        icon: 'search',
      })
    }
    if (item.mod.resource.metadata.modrinth) {
      const modrinth = item.mod.resource.metadata.modrinth
      items.push({
        text: t('mod.showInModrinth', { name: item.mod.name }),
        onClick: () => {
          goModrinthProject(modrinth.projectId)
        },
        icon: '$vuetify.icons.modrinth',
      })
    } else {
      items.push({
        text: t('mod.searchOnModrinth', { name: item.mod.name }),
        onClick: () => {
          searchInModrinth(item.mod.name)
        },
        icon: 'search',
      })
    }
    items.push({
      text: t('mod.searchOnMcWiki', { name: item.mod.name }),
      onClick: () => {
        searchInMcWiki(item.mod.name)
      },
      icon: 'search',
    })
    return items
  })
}
