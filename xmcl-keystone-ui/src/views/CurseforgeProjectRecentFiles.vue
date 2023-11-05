<template>
  <v-card
    outlined
    class="flex max-h-full flex-col overflow-auto md:hidden lg:flex"
  >
    <v-card-title class="text-md font-bold">
      {{ t("curseforge.recentFiles") }}
    </v-card-title>
    <v-list color="transparent">
      <template v-for="g of Object.entries(grouped)">
        <v-subheader
          :key="g[0]"
          class
        >
          Minecraft {{ g[0] }}
        </v-subheader>
        <CurseforgeProjectFileItem
          v-for="file in g[1]"
          :id="file.fileId"
          :key="file.fileId + g[0]"
          :upstream-file-id="upstream ? upstream.fileId : undefined"
          :mod-id="project.id"
          :name="file.filename"
          :loader="modLoaders[file.modLoader] || ''"
          :release-type="file.releaseType"
          @install="install(file)"
        />
      </template>
    </v-list>

    <v-card-title class="text-md font-bold">
      {{ t("curseforge.authors") }}
    </v-card-title>

    <div class="mx-4 flex flex-grow-0 gap-4">
      <a
        v-for="a of project.authors"
        :key="a.id"
        :href="a.url"
      >
        {{ a.name }}
      </a>
    </div>

    <v-card-title class="text-md font-bold">
      {{ t("modrinth.categories.categories") }}
    </v-card-title>

    <div class="mx-4 flex flex-grow-0 flex-wrap gap-2">
      <v-chip
        v-for="a of project.categories"
        :key="a.id"
      >
        <v-avatar
          left
        >
          <img
            :src="a.iconUrl"
          >
        </v-avatar>
        <a :href="a.url">
          {{ a.name }}
        </a>
      </v-chip>
    </div>
  </v-card>
</template>

<script lang=ts setup>
import { kCurseforgeInstall } from '@/composables/curseforgeInstall'
import { injection } from '@/util/inject'
import { FileIndex, FileModLoaderType, Mod } from '@xmcl/curseforge'
import CurseforgeProjectFileItem from './CurseforgeProjectFileItem.vue'

const props = defineProps<{
  project: Mod
  from: string
  upstream?: {
    modId: number
    fileId: number
  }
}>()

const modLoaders = {
  [FileModLoaderType.Cauldron]: 'Cauldron',
  [FileModLoaderType.Forge]: 'Forge',
  [FileModLoaderType.Fabric]: 'Fabric',
  [FileModLoaderType.Quilt]: 'Quilt',
  [FileModLoaderType.LiteLoader]: 'LiteLoader',
  [FileModLoaderType.Any]: '',
}

const { t } = useI18n()

const { install } = injection(kCurseforgeInstall)

const grouped = computed(() => {
  if (!props.project.latestFilesIndexes) return {}
  const result: Record<string, FileIndex[]> = {}
  for (const f of props.project.latestFilesIndexes) {
    const v = f.gameVersion
    if (!result[v]) result[v] = []
    result[v].push(f)
  }
  return result
})

</script>
