<template>
  <div
    ref="container"
    class="w-full overflow-auto"
  >
    <div class="z-8 sticky top-1 mt-4 flex w-full px-4 lg:justify-center">
      <v-text-field
        ref="searchTextField"
        v-model="keyword"
        color="green"
        class="max-w-100 rounded-xl"
        append-icon="search"
        solo
        hide-details
        clearable
        :placeholder="t('modrinth.searchText')"
        @click:clear="query = ''"
        @keydown.enter="query = keyword"
      />
    </div>
    <div class="main px-3">
      <div class="section">
        <v-subheader>
          <v-icon left>
            local_fire_department
          </v-icon>
          {{ t('store.popular') }}
        </v-subheader>

        <v-carousel
          :interval="7000"
          class="min-h-[410px] max-w-[950px] flex-grow self-center"
          :cycle="true"
          :show-arrows="true"
          hide-delimiter-background
          height="410"
        >
          <v-carousel-item
            v-for="(g, i) in popularItems"
            :key="i"
          >
            <StoreGallery
              :gallery="g"
              @enter="enter(g.type, g.id)"
            />
          </v-carousel-item>
        </v-carousel>
      </div>
      <div class="section">
        <v-subheader>
          <v-icon
            left
            size="20"
          >
            update
          </v-icon>
          {{ t('store.recentUpdated') }}
        </v-subheader>

        <GalleryGrid
          :items="recentUpdatedItems"
          @enter="enter($event.type, $event.id)"
        />
      </div>
      <div class="section">
        <v-subheader>
          <v-icon left>
            $vuetify.icons.minecraft
          </v-icon>
          {{ t('store.latestMinecraft') }}
        </v-subheader>

        <GalleryList
          :items="recentMinecraftItems"
          @enter="enter($event.type, $event.id)"
        />
      </div>
      <v-subheader ref="exploreHeader">
        <v-icon left>
          $vuetify.icons.minecraft
        </v-icon>
        {{ t('store.explore') }}
      </v-subheader>

      <div class="content">
        <div
          v-if="!searchError && items.length > 0"
          class="relative flex flex-col gap-3 lg:px-2.5"
        >
          <div
            class="hover:(scale-100 opacity-100) absolute bottom-3 z-10 w-full scale-90 transform opacity-60 transition"
          >
            <v-pagination
              v-model="page"
              :length="pageCount"
              color="success"
              :disabled="refreshing"
              :total-visible="12"
            />
          </div>
          <StoreExploreCard
            v-for="mod in items"
            :key="mod.id"
            v-ripple
            :disabled="false"
            :value="mod"
            class="cursor-pointer"
            @mouseenter.native="onMouseEnter($event, mod)"
            @mouseleave.native="onMouseLeave(mod)"
            @click="enter(mod.type, mod.id)"
          />

          <div class="min-h-14 w-full p-1" />
        </div>
        <Hint
          v-if="items.length === 0"
          icon="mood_bad"
          :size="80"
          :text="`No search result for ${query}`"
        />
      </div>
      <div class="category overflow-auto">
        <StoreExploreCategories
          :display="hovered?.gallery"
          :groups="groups"
          :loading="refreshingTag"
          :selected="selected"
          :error="tagError"
          @select="onSelect"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CategoryChipProps } from '@/components/CategoryChip.vue'
import GalleryGrid from '@/components/GalleryGrid.vue'
import GalleryList from '@/components/GalleryList.vue'
import Hint from '@/components/Hint.vue'
import StoreExploreCard, { ExploreProject } from '@/components/StoreExploreCard.vue'
import StoreExploreCategories, { Category, ExploreCategoryGroup } from '@/components/StoreExploreCategories.vue'
import StoreGallery, { GameGallery } from '@/components/StoreGallery.vue'
import { CurseforgeProps, useCurseforge, useCurseforgeCategories, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useDateString } from '@/composables/date'
import { useMarketSort } from '@/composables/marketSort'
import { ModrinthOptions, getFacatsText, useModrinth, useModrinthTags } from '@/composables/modrinth'
import { useSortByItems } from '@/composables/sortBy'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getExpectedSize } from '@/util/size'
import { useEventListener, useFocus } from '@vueuse/core'
import { FileModLoaderType, Mod, ModsSearchSortField } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import useSWRV from 'swrv'

const keyword = ref('')
const { t } = useI18n()
const { getDateString } = useDateString()
const tCategory = useCurseforgeCategoryI18n()

function merge<T>(modrinths: T[], curseforges: T[]) {
  const result: T[] = []
  for (let i = 0; i < Math.max(modrinths.length, curseforges.length); i++) {
    const m = modrinths[i]
    const c = curseforges[i]
    if (m) result.push(m)
    if (c) result.push(c)
  }
  return result
}

// Popular list
const { data: modrinthResult, error, isValidating } = useSWRV('/modrinth/featured', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'follows',
    limit: 5,
    facets: getFacatsText('', '', [], '', 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeResult, error: curseforgeError, isValidating: curseforgeValidating } = useSWRV('/curseforge/featured', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.Featured, classId: 4471, pageSize: 5 })
  return result.data
})
const popularItems = computed(() => {
  function getGameGalleryFromModrinth(hits: SearchResultHit[]) {
    return hits.map((hit) => {
      const images = hit.gallery.map(g => [g, g]) as [string, string][]
      if (hit.icon_url) {
        images.push([hit.icon_url, hit.icon_url])
      }
      const game: GameGallery = {
        id: hit.project_id,
        title: hit.title,
        images,
        type: 'modrinth',
        developer: hit?.author ?? '',
        minecraft: hit?.versions ?? [],
        categories: hit.categories.map(c => t(`modrinth.categories.${c}`, c)),
      }
      return game
    })
  }
  function getGameGalleryFromCurseforge(mods: Mod[]) {
    return mods.map((p) => {
      const images = p.screenshots.map(g => [g.thumbnailUrl, g.url]) as [string, string][]
      if (p.logo) {
        images.push([p.logo.thumbnailUrl, p.logo.url])
      }
      const game: GameGallery = {
        id: p.id.toString(),
        title: p.name,
        images,
        type: 'curseforge',
        developer: p.authors[0].name,
        minecraft: p.latestFilesIndexes.map(f => f.gameVersion),
        categories: p.categories.map(c => tCategory(c.name)),
      }
      return game
    })
  }

  const modrinth = getGameGalleryFromModrinth(modrinthResult.value ?? [])
  const curseforge = getGameGalleryFromCurseforge(curseforgeResult.value ?? [])

  return merge(modrinth, curseforge)
})

// Recent updated
const { data: modrinthRecent, error: errorRecent, isValidating: isValidatingRecent } = useSWRV('/modrinth/recent_update', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'updated',
    limit: 24,
    facets: getFacatsText('', '', [], '', 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeRecent } = useSWRV('/curseforge/recent_update', async () => {
  const result = await clientCurseforgeV1.searchMods({
    sortField: ModsSearchSortField.LastUpdated,
    classId: 4471,
    pageSize: 30,
  })
  return result.data
}, inject(kSWRVConfig))
const recentUpdatedItems = computed(() => {
  const recent = modrinthRecent.value || []
  const cfRecent = curseforgeRecent.value || []

  return merge(
    recent.map((r) => ({
      title: r.title,
      id: r.project_id,
      type: 'modrinth',
      logo: r.icon_url,
      description: r.description,
      updatedAt: r.date_modified,
      follows: r.follows,
      downloads: r.downloads,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })),
    cfRecent.map((r) => ({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      logo: r.logo.thumbnailUrl,
      description: r.summary,
      updatedAt: r.dateModified,
      follows: r.downloadCount,
      downloads: r.downloadCount,
      categories: r.categories.map(c => tCategory(c.name)),
    })),
  )
})

// Latest minecraft
const latestModrinth = computed(() => gameVersions.value.filter(v => v.major)[0].version)
const { data: modrinthRecentMinecraft } = useSWRV('/modrinth/recent_version', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'newest',
    limit: 30,
    facets: getFacatsText(latestModrinth.value, '', [], '', 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeRecentMinecraft } = useSWRV('/curseforge/recent_version', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.GameVersion, classId: 4471, pageSize: 30 })
  return result.data
})
const recentMinecraftItems = computed(() => {
  const modrinths = modrinthRecentMinecraft.value || []
  const curseforges = curseforgeRecentMinecraft.value || []

  return merge(
    modrinths.map((r) => ({
      title: r.title,
      type: 'modrinth',
      id: r.project_id,
      image: r.icon_url || r.gallery[0],
      gameVersion: latestModrinth.value,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })),
    curseforges.map((r) => ({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      image: r.logo.thumbnailUrl,
      gameVersion: r.latestFilesIndexes[0].gameVersion,
      categories: r.categories.map(c => tCategory(c.name)),
    })),
  )
})

// Routing
const { push } = useRouter()
const enter = (type: string, id: string) => {
  console.log(type, id)
  push(`/store/${type}/${id}`)
}

const sortBy = useSortByItems()
const { refreshing: refreshingTag, categories, modLoaders, gameVersions, error: tagError } = useModrinthTags()
const { categories: curseforgeCategories } = useCurseforgeCategories()
const revMap: Record<string, number> = {
  multiplayer: 4484,
  lightweight: 4481,
  adventure: 4475,
  combat: 4483,
  quests: 4478,
  technology: 4472,
  magic: 4473,
}
const groups = computed(() => {
  const cfCats = curseforgeCategories.value?.filter(c => c.parentCategoryId === 4471)

  const groupedCategories: Category[] = []
  const bin: Record<string, boolean> = {}
  const binMap: Record<string, string> = {
    adventure: 'adventure',
    challenging: 'challenging',
    combat: 'combat',
    'kitchen-sink': 'kitchen-sink',
    lightweight: 'lightweight',
    magic: 'magic',
    multiplayer: 'multiplayer',
    optimization: 'optimization',
    quests: 'quests',
    technology: 'technology',

    Quests: 'quests',
    Tech: 'technology',
    Magic: 'magic',
    'Adventure and RPG': 'adventure',
    'Combat / PvP': 'combat',
    'Small / Light': 'lightweight',
    Multiplayer: 'multiplayer',
  }
  for (const c of categories.value.filter(v => v.project_type === 'modpack')) {
    const key = binMap[c.name]
    if (!(key in bin) || !key) {
      groupedCategories.push({
        id: c.name,
        text: t(`modrinth.categories.${c.name}`, c.name),
        iconHTML: c.icon,
      })
      if (key) {
        bin[key] = true
      }
    }
  }
  console.log(cfCats?.map(c => ({ id: c.id, name: c.name })).filter(c => c.name in binMap))
  for (const c of (cfCats || [])) {
    const key = binMap[c.name]
    if (!(key in bin) || !key) {
      groupedCategories.push({
        id: c.id.toString(),
        text: tCategory(c.name),
        icon: c.iconUrl,
      })
      if (key) {
        bin[key] = true
      }
    }
  }

  const result: ExploreCategoryGroup[] = [{
    id: 'sortBy',
    text: t('modrinth.sort.title'),
    type: 'buttons',
    categories: sortBy.value.map(s => ({
      id: s.value,
      text: s.text,
      icon: s.icon,
    })),
  }, {
    id: 'gameVersions',
    text: t('modrinth.gameVersions.name'),
    type: 'menu',
    categories: gameVersions.value.map(v => ({
      id: v.version,
      text: v.version,
    })),
  }, {
    id: 'modloaders',
    text: t('modrinth.modLoaders.name'),
    type: 'checkbox',
    categories: modLoaders.value.filter(l => l.supported_project_types.includes('modpack')).map(l => ({
      id: l.name,
      text: l.name,
      iconHTML: l.icon,
    })),
  }, {
    id: 'categories',
    text: t('modrinth.categories.categories'),
    type: 'checkbox',
    categories: groupedCategories,
  }]

  return result
})

const page = ref(1)
const query = ref('')
const gameVersion = ref('')
const modLoader = ref('')
const { sort, modrinthSort, curseforgeSort } = useMarketSort('' as string)
// Modrinth
const data: ModrinthOptions = reactive({
  query,
  gameVersion,
  license: '',
  category: [],
  modLoader,
  environment: '',
  sortBy: modrinthSort as any,
  projectType: 'modpack',
  page,
})

const selected = computed(() => {
  const result: string[] = []

  if (data.category.length > 0) {
    result.push(...data.category)
  }
  if (curseforgeData.category) {
    result.push(curseforgeData.category)
  }
  if (data.environment) {
    result.push(data.environment)
  }
  if (data.gameVersion) {
    result.push(data.gameVersion)
  }
  if (data.license) {
    result.push(data.license)
  }
  if (data.modLoader) {
    result.push(data.modLoader)
  }
  if (data.sortBy) {
    result.push(data.sortBy)
  }

  return result
})
const {
  error: searchError,
  refreshing, projects, pageCount,
} = useModrinth(data)

// Curseforge
const curseforgeData: CurseforgeProps = reactive({
  type: 'modpacks',
  page,
  keyword: query,
  category: '',
  sortField: curseforgeSort as any,
  modLoaderType: computed(() => {
    return modLoader.value === 'forge'
      ? FileModLoaderType.Forge
      : modLoader.value === 'fabric'
        ? FileModLoaderType.Fabric
        : modLoader.value === 'quilt'
          ? FileModLoaderType.Quilt
          : FileModLoaderType.Any
  }),
  sortOrder: 'desc',
  gameVersion,
  from: '',
})
const { projects: curseforgeProjects } = useCurseforge(curseforgeData)

const items = computed(() => {
  const modrinths = projects.value.map((p) => {
    const mapped: ExploreProject = {
      id: p.project_id,
      type: 'modrinth',
      title: p.title,
      icon_url: p.icon_url,
      description: p.description,
      author: p.author,
      labels: [
        { icon: 'file_download', text: getExpectedSize(p.downloads, '') },
        { icon: 'event', text: getDateString(p.date_created) },
        { icon: 'edit', text: getDateString(p.date_modified) },
        { icon: 'local_offer', text: p.versions[p.versions.length - 1] },
      ],
      tags: p.categories.map(c => ({ icon: categories.value.find(cat => cat.name === c)?.icon, text: t(`modrinth.categories.${c}`, c) })),
      gallery: p.gallery,
    }
    return mapped
  })
  const curseforges = curseforgeProjects.value.map((p) => {
    const existed = new Set<number>()
    const tags = p.categories.map(c => {
        if (existed.has(c.id)) return undefined
        existed.add(c.id)
        return { icon: c.iconUrl, text: tCategory(c.name) } as CategoryChipProps
      }).filter((v): v is CategoryChipProps => v !== undefined)
    const mapped: ExploreProject = {
      id: p.id.toString(),
      type: 'curseforge',
      title: p.name,
      icon_url: p.logo.thumbnailUrl,
      description: p.summary,
      author: p.authors[0].name,
      labels: [
        { icon: 'file_download', text: getExpectedSize(p.downloadCount, '') },
        { icon: 'event', text: getDateString(p.dateModified) },
        { icon: 'edit', text: getDateString(p.dateModified) },
        { icon: 'local_offer', text: p.latestFilesIndexes[0].gameVersion },
      ],
      tags,
      gallery: p.screenshots.map(s => s.thumbnailUrl),
    }
    return mapped
  })

  return merge(modrinths, curseforges)
})

// Scroll to the search result
const container = ref<any>(null)
const exploreHeader = ref<any | null>(null)
watch(items, (values) => {
  if (query.value || gameVersion.value || modLoader.value) {
    // Scroll to the element
    const component = exploreHeader.value
    const el = component?.$el as HTMLElement | undefined
    if (el) {
      // check if el in viewport
      const rect = el.getBoundingClientRect()
      if (rect.y > 300) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }
})

// Hovered project
const hovered = ref(undefined as ExploreProject | undefined)
const onMouseEnter = (event: MouseEvent, proj: ExploreProject) => {
  if (proj.gallery.length > 0) {
    hovered.value = proj
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
let timeout: any
const onMouseLeave = (e: any) => {
  timeout = setTimeout(() => {
    hovered.value = undefined
    timeout = undefined
  }, 300)
}

// Category select
const onSelect = ({ group, category }: { group: string; category: string }) => {
  if (group === 'categories') {
    const cat = categories.value.find(c => c.name === category)

    if (cat) {
      const index = data.category.indexOf(category)
      if (index === -1) {
        data.category.push(category)
      } else {
        data.category.splice(index, 1)
      }

      if (revMap[category]) {
        const cfCat = revMap[category].toString()
        if (curseforgeData.category === cfCat) {
          curseforgeData.category = ''
        } else {
          curseforgeData.category = cfCat
        }
      }
    } else {
      if (curseforgeData.category === category) {
        curseforgeData.category = ''
      } else {
        curseforgeData.category = category
      }
    }
  } else if (group === 'modloaders') {
    data.modLoader = category
  } else if (group === 'environments') {
    data.environment = category
  } else if (group === 'gameVersions') {
    data.gameVersion = category
  } else if (group === 'licenses') {
    data.license = category
  } else if (group === 'sortBy') {
    sort.value = category
  }
}

const searchTextField = ref(undefined as any | undefined)
const searchTextEl = computed(() => searchTextField.value?.$el as HTMLElement | undefined)
const { focused } = useFocus(searchTextEl)
useEventListener(document, 'keydown', useTextFieldBehavior(searchTextField, focused), { capture: true })
</script>
<style scoped>
.main {
  display: grid;
  grid-template-columns: 35% 25% 10% 30%;
  /* grid-template-columns: repeat(4, minmax(0, 1fr)); */
  grid-template-rows: repeat(auto-fit);
}

.section {
  grid-row: auto;
  grid-column: 1 / 5;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.section .v-subheader {
  margin-top: 16px;
  margin-bottom: 16px;
}

.category {
  grid-column: 4 / 5;
  grid-row: auto;
  position: sticky;
  top: 10px;
  left: 0;
  align-self: start;
}

.category>.v-card {
  max-height: calc(100vh - 50px);
}

.content {
  grid-column: 1 / 4;
  grid-row: auto;
}

@media screen and (max-width: 1024px) {
  .content {
    grid-column: 1 / 3;
  }
  .category {
    grid-column: 3 / 5;
  }
}

.v-subheader {
  z-index: 4;
}
</style>
