import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useService } from './service'
import { kMarketRoute } from './useMarketRoute'

export function useModItemContextMenuItems(modFile: Ref<ModFile | undefined>, onDelete: () => void, onCreateTag: (group?: boolean) => void, onDisable: () => void) {
  const { t, te } = useI18n()
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { searchInCurseforge, goModrinthProject, goCurseforgeProject, searchInModrinth, searchInMcWiki } = injection(kMarketRoute)

  return () => {
    const file = modFile.value
    if (!file) return []
    const items: ContextMenuItem[] = [{
      text: t('mod.showFile', { file: file.path }),
      onClick: () => {
        showItemInDirectory(file.path)
      },
      icon: 'folder',
    }, /* , {
      text: t('tag.create'),
      onClick: () => {
        onCreateTag()
      },
      icon: 'add',
    } */]
    // if (item.selected) {
    //   items.push({
    //     text: t('tag.createSelected'),
    //     onClick: () => {
    //       onCreateTag(true)
    //     },
    //     icon: 'add',
    //   })
    // }
    items.push({
      text: t('delete.name', { name: file.name }),
      onClick: onDelete,
      icon: 'delete',
      color: 'error',
    })
    if (file.modId.toLowerCase() !== 'optifine') {
      items.push({
        onClick: onDisable,
        text: file.enabled ? t('disable') + ' ' + file.name : t('enable') + ' ' + file.name,
        color: 'grey',
        icon: file.enabled ? 'flash_off' : 'flash_on',
      })
    }
    if (file.url) {
      const url = file.url
      items.push({
        text: t('mod.openLink', { url }),
        onClick: () => {
          window.open(url, 'browser')
        },
        icon: 'link',
      })
    }
    if (file.resource.metadata.curseforge) {
      const curseforge = file.resource.metadata.curseforge
      items.push({
        text: t('mod.showInCurseforge', { name: file.name }),
        onClick: () => {
          goCurseforgeProject(curseforge.projectId, 'mc-mods')
        },
        icon: '$vuetify.icons.curseforge',
      })
    } else {
      items.push({
        text: t('mod.searchOnCurseforge', { name: file.name }),
        onClick: () => {
          searchInCurseforge(file.name, 'mc-mods')
        },
        icon: 'search',
      })
    }
    if (file.resource.metadata.modrinth) {
      const modrinth = file.resource.metadata.modrinth
      items.push({
        text: t('mod.showInModrinth', { name: file.name }),
        onClick: () => {
          goModrinthProject(modrinth.projectId)
        },
        icon: '$vuetify.icons.modrinth',
      })
    } else {
      items.push({
        text: t('mod.searchOnModrinth', { name: file.name }),
        onClick: () => {
          searchInModrinth(file.name, 'mod')
        },
        icon: 'search',
      })
    }
    if (te('mod.searchOnMcWiki')) {
      items.push({
        text: t('mod.searchOnMcWiki', { name: file.name }),
        onClick: () => {
          searchInMcWiki(file.name)
        },
        icon: 'search',
      })
    }
    return items
  }
}
