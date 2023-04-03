import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useCurseforgeRoute, useMcWikiRoute } from './curseforgeRoute'
import { ModItem } from './mod'
import { useService } from './service'

export function useModItemContextMenuItems(mod: Ref<ModItem>, onDelete: () => void, onCreateTag: (group?: boolean) => void) {
  const { t } = useI18n()
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
  const { push } = useRouter()
  const { searchProjectAndRoute: searchMcWiki } = useMcWikiRoute()

  return computed(() => {
    const item = mod.value
    const items: ContextMenuItem[] = [{
      text: t('mod.showFile', { file: item.path }),
      onClick: () => {
        showItemInDirectory(item.path)
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
      text: t('delete.name', { name: item.name }),
      onClick() {
        onDelete()
      },
      icon: 'delete',
      color: 'error',
    })
    if (item.url) {
      const url = item.url
      items.push({
        text: t('mod.openLink', { url }),
        onClick: () => {
          window.open(url, 'browser')
        },
        icon: 'link',
      })
    }
    if (item.resource.metadata.curseforge) {
      const curseforge = item.resource.metadata.curseforge
      items.push({
        text: t('mod.showInCurseforge', { name: item.name }),
        onClick: () => {
          goProjectAndRoute(curseforge.projectId, 'mc-mods')
        },
        icon: '$vuetify.icons.curseforge',
      })
    } else {
      items.push({
        text: t('mod.searchOnCurseforge', { name: item.name }),
        onClick: () => {
          searchProjectAndRoute(item.name, 'mc-mods')
        },
        icon: 'search',
      })
    }
    if (item.resource.metadata.modrinth) {
      const modrinth = item.resource.metadata.modrinth
      items.push({
        text: t('mod.showInModrinth', { name: item.name }),
        onClick: () => {
          push(`/modrinth/${modrinth.projectId}`)
        },
        icon: '$vuetify.icons.modrinth',
      })
    } else {
      items.push({
        text: t('mod.searchOnModrinth', { name: item.name }),
        onClick: () => {
          push(`/modrinth?query=${item.name}`)
        },
        icon: 'search',
      })
    }
    items.push({
      text: t('mod.searchOnMcWiki', { name: item.name }),
      onClick: () => {
        searchMcWiki(item.name)
      },
      icon: 'search',
    })
    return items
  })
}
