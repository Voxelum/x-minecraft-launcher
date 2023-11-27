<template>
  <div class="store flex flex-col items-center gap-2 p-4">
    <div class="mb-4 flex w-full flex-grow-0 items-center justify-center">
      <v-text-field
        solo
        hide-details
      />
    </div>
    <v-carousel
      :interval="7000"
      class="max-w-[950px]"
      :cycle="true"
      :show-arrows="true"
      hide-delimiter-background
      height="410"
    >
      <v-carousel-item
        v-for="(g, i) in all"
        :key="i"
      >
        <StoreGallery
          :gallery="g"
          @enter="enter(g.type, g.id)"
        />
      </v-carousel-item>
    </v-carousel>
    <div class="w-full">
      <v-subheader>
        Recent Updated
      </v-subheader>
    </div>

    <GalleryGrid
      :items="recentItems"
      @enter="enter($event.type, $event.id)"
    />

    <GalleryList
      :items="recentVersionItems"
      @enter="enter($event.type, $event.id)"
    />
  </div>
</template>
<script setup lang="ts">
import GalleryGrid, { GridGalleryItem } from '@/components/GalleryGrid.vue'
import GalleryList, { ListGalleryItem } from '@/components/GalleryList.vue'
import { getFacatsText, useModrinthTags } from '@/composables/modrinth'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { Mod, ModsSearchSortField } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import useSWRV from 'swrv'
import StoreGallery, { GameGallery } from './StoreGallery.vue'

defineProps<{}>()

const { t } = useI18n()
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

const { data: modrinthResult, error, isValidating } = useSWRV('/modrinth/featured', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'follows',
    limit: 5,
    facets: getFacatsText('', '', [], '', 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))

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
      categories: p.categories.map(c => t(`curseforgeCategory.${c.name}`, c.name)),
    }
    return game
  })
}

const { data: curseforgeResult, error: curseforgeError, isValidating: curseforgeValidating } = useSWRV('/curseforge/featured', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.Featured, classId: 4471, pageSize: 5 })
  return result.data
})

const all = computed(() => {
  const hits = modrinthResult.value
  const modrinth = getGameGalleryFromModrinth(hits ?? [])
  const curseforge = getGameGalleryFromCurseforge(curseforgeResult.value ?? [])

  return [...modrinth, ...curseforge]
})

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

const recentItems = computed(() => {
  const recent = modrinthRecent.value || []
  const result: GridGalleryItem[] = []

  for (const r of recent) {
    result.push({
      title: r.title,
      id: r.project_id,
      type: 'modrinth',
      logo: r.icon_url,
      description: r.description,
      updatedAt: r.date_modified,
      follows: r.follows,
      downloads: r.downloads,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })
  }

  const cfRecent = curseforgeRecent.value || []
  for (const r of cfRecent) {
    result.push({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      logo: r.logo.thumbnailUrl,
      description: r.summary,
      updatedAt: r.dateModified,
      follows: r.downloadCount,
      downloads: r.downloadCount,
      categories: r.categories.map(c => t(`curseforgeCategory.${c.name}`, c.name)),
    })
  }

  return result
})

// Latest minecraft
const { gameVersions } = useModrinthTags()
const latestModrinth = computed(() => gameVersions.value.filter(v => v.major)[0].version)
const { data: modrinthRecentVersion } = useSWRV('/modrinth/recent_version', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'newest',
    limit: 30,
    facets: getFacatsText(latestModrinth.value, '', [], '', 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeRecentVersions } = useSWRV('/curseforge/recent_version', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.GameVersion, classId: 4471, pageSize: 30 })
  return result.data
})
const recentVersionItems = computed(() => {
  const recent = modrinthRecentVersion.value || []
  const result: ListGalleryItem[] = []

  for (const r of recent) {
    result.push({
      title: r.title,
      type: 'modrinth',
      id: r.project_id,
      image: r.icon_url || r.gallery[0],
      gameVersion: latestModrinth.value,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })
  }

  const curseforge = curseforgeRecentVersions.value || []
  for (const r of curseforge) {
    result.push({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      image: r.logo.thumbnailUrl,
      gameVersion: r.latestFilesIndexes[0].gameVersion,
      categories: r.categories.map(c => t(`curseforgeCategory.${c.name}`, c.name)),
    })
  }

  return result
})

const { push } = useRouter()
const enter = (type: string, id: string) => {
  console.log(type, id)
  push(`/store/${type}/${id}`)
}

</script>

<style>
.store {
  .v-window__container {
    max-height: 360px;
  }
  .v-carousel__controls {
    position: static !important;
  }
}

</style>
