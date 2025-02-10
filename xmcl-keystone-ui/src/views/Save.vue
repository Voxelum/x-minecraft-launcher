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
          v-shared-tooltip="() => t('mod.denseView')"
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
import { useGlobalDrop } from '@/composables/dropHandler'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { usePresence } from '@/composables/presence'
import { kSaveSearch } from '@/composables/savesSearch'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
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

const { importSave, installFromMarket } = useService(InstanceSavesServiceKey)
provide(kCurseforgeInstaller, {
  installWithDependencies: async (id, loader, icon) => {
    await installFromMarket({
      market: 1,
      instancePath: path.value,
      file: { fileId: id, icon },
    })
  },
  install: async (file) => {
    await installFromMarket({
      market: 1,
      instancePath: path.value,
      file,
    })
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
const { dragover } = useGlobalDrop({
  onDrop: async (t) => {
    for (const f of t.files) {
      importSave({ path: f.path, instancePath: path.value })
    }
  },
})
</script>
