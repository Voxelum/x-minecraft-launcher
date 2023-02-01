<template>
  <div class="flex flex-col select-none h-full overflow-auto pb-0">
    <SharedTooltip />
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />

    <v-card
      class="z-5 shadow m-4 rounded-lg"
      outlined
    >
      <div
        class="flex flex-shrink flex-grow-0 items-baseline gap-2 mb-4 p-3"
      >
        <v-text-field
          v-model="keyword"
          prepend-inner-icon="search"
          filled
          dense
          hide-details
          :loading="loading"
        />
        <AvatarChip
          v-if="minecraft"
          :avatar="'image://builtin/minecraft'"
          :text="'Minecraft ' + minecraft"
        />
        <AvatarChip
          v-if="forge"
          :avatar="'image://builtin/forge'"
          :text="'Forge ' + forge"
        />
        <AvatarChip
          v-if="fabricLoader"
          :avatar="'image://builtin/fabric'"
          :text="'Fabric ' + fabricLoader"
        />
        <AvatarChip
          v-if="quiltLoader"
          :avatar="'image://builtin/quilt'"
          :text="'Quilt ' + quiltLoader"
        />

        <div class="flex-grow" />
        <v-menu offset-y>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
            >
              <v-icon>
                shopping_cart
              </v-icon>
            </v-btn>
          </template>
          <v-sheet
            color="black"
            class="p-2"
          >
            <div class="flex">
              <v-btn text>
                Pending
              </v-btn>
              <div class="flex-grow" />
            </div>

            <v-list class="overflow-auto max-h-100 rounded-lg">
              <v-list-item>
                <v-list-item-title>123123</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-sheet>
        </v-menu>
      </div>
      <div
        class="flex flex-shrink flex-grow-0 items-center justify-center gap-2"
      >
        <v-tabs
          v-model="tab"
          centered
        >
          <v-tab>
            <v-icon left>
              all_inclusive
            </v-icon>
            All
            <div
              class="v-badge__badge primary static ml-1 w-[unset]"
            >
              {{ mods.length + curseforgeCount + modrinthCount }}
            </div>
          </v-tab>
          <v-tab>
            <v-icon left>
              storage
            </v-icon>
            Local
            <div
              class="v-badge__badge primary static ml-1 w-[unset]"
            >
              {{ mods.length }}
            </div>
          </v-tab>
          <v-tab :disabled="!curseforge || curseforge.data.length === 0">
            <v-icon left>
              $vuetify.icons.curseforge
            </v-icon>
            Curseforge
            <div
              class="v-badge__badge primary static ml-1 w-[unset]"
            >
              {{ curseforgeCount }}
            </div>
          </v-tab>
          <v-tab :disabled="!modrinth || modrinth.hits.length === 0">
            <v-icon left>
              $vuetify.icons.modrinth
            </v-icon>
            Modrinth
            <div
              class="v-badge__badge primary static ml-1 w-[unset]"
            >
              {{ modrinthCount }}
            </div>
          </v-tab>
        </v-tabs>
      </div>
    </v-card>

    <div
      class="h-full overflow-auto grid grid-cols-12 py-0 divide-x divide-dark-50"
      @dragover.prevent
      @drop="onDropToImport"
    >
      <v-virtual-scroll
        :bench="2"
        class="lg:col-span-7 col-span-5 h-full max-h-full visible-scroll overflow-auto mx-2"
        :items="items"
        item-height="68"
      >
        <template #default="{ item: p }">
          <v-list-item
            link
            @click="onSelect(p)"
          >
            <v-list-item-avatar>
              <v-img
                :src="p.icon"
              />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ p.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ p.description }}</v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-avatar
                size="30px"
              >
                <v-icon>
                  {{ p.modrinth ? '$vuetify.icons.modrinth' : p.curseforge ? '$vuetify.icons.curseforge' : 'folder' }}
                </v-icon>
              </v-avatar>
            </v-list-item-action>
          </v-list-item>
        </template>
      </v-virtual-scroll>
      <div class="h-full overflow-auto lg:col-span-5 col-span-7">
        <template v-if="!!selected">
          <ModAddModrinthDetail
            v-if="selected.modrinth"
            :hint="selected.modrinth"
            :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
            :minecraft="minecraft"
            @install="onInstallModrinth"
          />
          <ModAddCurseforgeDetail
            v-else-if="selected.curseforge"
            :mod="selected.curseforge"
            :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
            :minecraft="minecraft"
            @install="onInstallCurseforge"
          />
          <ModAddResourceDetail
            v-else-if="selected.resource"
            :resources="selected.resource"
            :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
            :minecraft="minecraft"
            @install="onInstallResource"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script lang=ts setup>
import AvatarChip from '@/components/AvatarChip.vue'
import { useDrop, useService } from '@/composables'
import { useInstanceVersionBase } from '@/composables/instance'
import { useModsSearch } from '@/composables/modSearch'
import { kSharedTooltip, useSharedTooltip } from '@/composables/sharedTooltip'
import { CompatibleDetail } from '@/util/modCompatible'
import { getDiceCoefficient } from '@/util/sort'
import { Mod } from '@xmcl/curseforge'
import { Project, SearchResultHit } from '@xmcl/modrinth'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import SharedTooltip from '../components/SharedTooltip.vue'
import ModAddCurseforgeDetail from './ModAddCurseforgeDetail.vue'
import ModAddModrinthDetail from './ModAddModrinthDetail.vue'
import ModAddResourceDetail from './ModAddResourceDetail.vue'

interface ModListItem {
  id: string
  icon: string
  title: string
  description: string

  curseforge?: Mod
  modrinth?: SearchResultHit
  resource?: Resource[]
}

const { importResources } = useService(ResourceServiceKey)
const tab = ref(0)
const keyword = ref('')
const { minecraft, forge, fabricLoader, quiltLoader } = useInstanceVersionBase()

const {
  modrinth, modrinthError, loadingModrinth,
  curseforge, curseforgeError, loadingCurseforge,
  mods,
} = useModsSearch(keyword, minecraft, forge, fabricLoader)
const loading = computed(() => loadingModrinth.value || loadingCurseforge.value)
const curseforgeCount = computed(() => curseforge.value ? curseforge.value.pagination.totalCount : 0)
const modrinthCount = computed(() => modrinth.value ? modrinth.value.total_hits : 0)
const disableModrinth = computed(() => tab.value !== 0 && tab.value !== 3)
const disableCurseforge = computed(() => tab.value !== 0 && tab.value !== 2)
const disableLocal = computed(() => tab.value !== 0 && tab.value !== 1)

const items = computed(() => {
  const results: [ModListItem, number][] = []
  const modr = modrinth.value
  if (modr && !disableModrinth.value) {
    for (const i of modr.hits) {
      results.push([{
        id: i.project_id,
        icon: i.icon_url,
        title: i.title,
        description: i.description,
        modrinth: i,
      }, getDiceCoefficient(keyword.value, i.title)])
    }
  }
  const cf = curseforge.value
  if (cf && !disableCurseforge.value) {
    for (const i of cf.data) {
      results.push(([{
        id: i.id.toString(),
        icon: i.logo.url,
        title: i.name,
        description: i.summary,
        curseforge: i,
      }, getDiceCoefficient(keyword.value, i.name)]))
    }
  }
  if (!disableLocal.value) {
    const dict: Record<string, ModListItem> = {}
    for (const m of mods.value) {
      let description = ''
      let name = ''
      if (m.metadata.forge) {
        description = m.metadata.forge.description
        name = m.metadata.forge.name
      } else if (m.metadata.fabric) {
        if (m.metadata.fabric instanceof Array) {
          description = m.metadata.fabric[0].description || ''
          name = m.metadata.fabric[0].name || m.metadata.fabric[0].id || ''
        } else {
          description = m.metadata.fabric.description || ''
          name = m.metadata.fabric.name || m.metadata.fabric.id || ''
        }
      }
      if (!dict[name]) {
        dict[name] = {
          id: m.path,
          icon: m.icons?.[0] ?? '',
          title: name,
          description: description,
          resource: [m],
        }
        results.push(([dict[name], getDiceCoefficient(keyword.value, m.name)]))
      } else {
        dict[name].resource?.push(m)
      }
    }
  }

  results.sort((a, b) => -a[1] + b[1])
  return results.map(v => v[0])
})

const selected = ref(undefined as undefined | ModListItem)
const onSelect = (i: ModListItem) => {
  selected.value = i
}

provide(kSharedTooltip, useSharedTooltip<CompatibleDetail>((dep) => {
  const compatibleText = dep.compatible === 'maybe'
    ? t('mod.maybeCompatible')
    : dep.compatible
      ? t('mod.compatible')
      : t('mod.incompatible')
  return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
}))

const onInstallResource = (resource: Resource) => {

}

const onInstallCurseforge = (mod: Mod) => {

}

const onInstallModrinth = (project: Project) => {

}

const { t } = useI18n()

const { onDrop: onDropToImport } = useDrop((file) => {
  importResources([{ path: file.path, domain: ResourceDomain.Mods }])
})
</script>
