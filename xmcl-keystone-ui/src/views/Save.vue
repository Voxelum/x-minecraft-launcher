<template>
  <MarketBase
    :plans="{}"
    :items="groupedItems"
    :selection-mode="true"
    :item-height="itemHeight"
    :loading="loadingCurseforge"
    :error="error"
    :class="{
      dragover,
    }"
    @load="loadMoreCurseforge"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on, index }">
      <v-subheader
        v-if="typeof item === 'string'"
        class="flex"
        :style="{ height: itemHeight + 'px' }"
      >
        {{
          item === 'installed' ? t("save.selected") :
          item === 'shared' ? t("save.unselected") :
          t("modInstall.search")
        }}
        <div class="flex-grow" />
        <v-btn
          v-if="index === 0"
          v-shared-tooltip="_ => t('mod.denseView')"
          icon
          @click="denseView = !denseView"
        >
          <v-icon> {{ denseView ? 'reorder' : 'list' }} </v-icon>
        </v-btn>
      </v-subheader>
      <SaveItem
        v-else
        :item="item"
        :item-height="itemHeight"
        :has-update="hasUpdate"
        :checked="checked"
        :selection-mode="selectionMode"
        :selected="selected"
        :dense="denseView"
        @click="on.click"
        @delete="onDelete"
      />
    </template>
    <template #content="{ selectedItem, selectedCurseforgeId, updating }">
      <Hint
        v-if="dragover"
        icon="save_alt"
        :text="t('save.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailCurseforge
        v-else-if="selectedItem && (selectedItem.curseforge || selectedCurseforgeId)"
        :curseforge="selectedItem.curseforge"
        :curseforge-id="Number(selectedCurseforgeId)"
        :installed="selectedItem.installed"
        :game-version="gameVersion"
        :loaders="[]"
        :all-files="[]"
        :category="curseforgeCategory"
        :updating="updating"
        @category="curseforgeCategory = $event"
      />
      <SaveDetail
        v-else-if="isSaveProject(selectedItem)"
        :save="selectedItem"
        @delete="onDelete"
      />
      <MarketRecommendation
        v-else
        curseforge="worlds"
        @curseforge="curseforgeCategory = $event.id"
      />
    </template>
    <SimpleDialog
      v-model="model"
      :title="t('save.deleteTitle')"
      :width="500"
      persistent
      @confirm="doDelete()"
    >
      {{ t('save.deleteHint') }}
      <div style="color: grey">
        {{ deleting?.path }}
      </div>
    </SimpleDialog>
  </MarketBase>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDrop } from '@/composables/dropHandler'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { usePresence } from '@/composables/presence'
import { kSaveSearch } from '@/composables/savesSearch'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { File } from '@xmcl/curseforge'
import { CurseForgeServiceKey, InstanceSavesServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import SimpleDialog from '../components/SimpleDialog.vue'
import { useSimpleDialog } from '../composables/dialog'
import { kInstance } from '../composables/instance'
import SaveDetail from './SaveDetail.vue'
import SaveItem from './SaveItem.vue'

const { path } = injection(kInstance)
const { error, deleteSave } = injection(kInstanceSave)

const { effect, installed, notInstalledButCached, others, curseforgeCategory, gameVersion, loadMoreCurseforge, loadingCurseforge } = injection(kSaveSearch)

effect()

const isSaveProject = (v: ProjectEntry | undefined): v is ProjectEntry<InstanceSaveFile> => !!v?.installed && v.installed.length > 0

const denseView = useLocalStorageCacheBool('savesDenseView', false)
const itemHeight = computed(() => denseView.value ? 40 : 68)

const groupedItems = computed(() => {
  const result: (ProjectEntry | string)[] = []

  if (installed.value.length > 0) {
    result.push('installed')
    result.push(...installed.value)
  }

  if (notInstalledButCached.value.length > 0) {
    result.push('shared')
    result.push(...notInstalledButCached.value)
  }

  if (others.value.length > 0) {
    result.push('search')
    result.push(...others.value)
  }

  return result
})

const { installFile } = useService(CurseForgeServiceKey)
const { removeResources } = useService(ResourceServiceKey)
const { importSave } = useService(InstanceSavesServiceKey)
provide(kCurseforgeInstaller, {
  installWithDependencies: async (m, v) => {
    const instPath = path.value
    const result = await installFile({
      file: v,
      icon: m.logo.url,
      type: 'worlds',
    })
    await importSave({
      path: result.resource.path,
      instancePath: instPath,
      saveRoot: result.resource.metadata.save?.root,
    })
    await removeResources([result.resource.hash])
  },
  install: async (v: File, icon?: string) => {
    const instPath = path.value
    const result = await installFile({
      file: v,
      icon,
      type: 'worlds',
    })
    await importSave({
      path: result.resource.path,
      instancePath: instPath,
      saveRoot: result.resource.metadata.save?.root,
    })
    await removeResources([result.resource.hash])
  },
})

const { target: deleting, confirm: doDelete, model, show } = useSimpleDialog<InstanceSaveFile>((save) => save ? deleteSave(save) : undefined)
const onDelete = (save: InstanceSaveFile) => {
  show(save)
}

const { t } = useI18n()
const { name } = injection(kInstance)
usePresence(computed(() => t('presence.save', { instance: name.value })))

// Drop
const { resolveResources } = useService(ResourceServiceKey)
const { dragover } = useDrop(() => { }, async (t) => {
  const paths = [] as string[]
  for (const f of t.files) {
    paths.push(f.path)
  }
  const resources = await resolveResources(paths.map(p => ({ path: p, domain: ResourceDomain.Saves })))
  for (const file of resources) {
    importSave({ path: file.path, instancePath: path.value, saveRoot: file.metadata.save?.root })
  }
}, () => { })

// async function doImport() {
//   const { filePaths } = await showOpenDialog({
//     title: t('save.importTitle'),
//     message: t('save.importMessage'),
//     filters: [{ extensions: ['zip'], name: 'zip' }],
//   })
//   for (const file of filePaths) {
//     importSave({ path: file, instancePath: path.value })
//   }
// }
</script>
