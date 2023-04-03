<template>
  <v-list
    v-if="!refreshing"
    color="transparent"
    two-line
  >
    <v-list-item
      v-for="mod of mods"
      :key="mod.id"
      @click="onClick(mod)"
    >
      <v-list-item-avatar>
        <v-img :src="getImage(mod)">
          <template #placeholder>
            <v-layout
              fill-height
              align-center
              justify-center
              ma-0
            >
              <v-progress-circular
                indeterminate
                color="grey lighten-5"
              />
            </v-layout>
          </template>
        </v-img>
      </v-list-item-avatar>

      <v-list-item-content>
        <v-list-item-title>{{ mod ? mod.name : '' }}</v-list-item-title>
        <v-list-item-subtitle>
          <span
            v-if="mod && mod.authors[0]"
            class="text--primary"
          >{{ mod.authors[0].name }}</span>
          {{ mod ? mod.summary : '' }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
  <v-skeleton-loader
    v-else
    type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
  />
</template>
<script lang="ts" setup>
import { Ref } from 'vue'
import type { Mod } from '@xmcl/curseforge'
import { BaseServiceKey, CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'

const props = defineProps<{
  files: Array<{ projectID: number }>
}>()

const { getModsByIds } = useService(CurseForgeServiceKey)
onMounted(() => {
  refresh()
})
const mods: Ref<Mod[]> = ref([])

watch(computed(() => props.files), () => {
  refresh()
})

const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getModsByIds(props.files.map(f => f.projectID))
  mods.value = result
})
function getImage(mod: Mod) {
  return mod.logo ? mod.logo.thumbnailUrl : ''
}
function onClick(mod: Mod) {
  if (mod.slug) {
    if (mod.classId === 6) {
      window.open(`https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`, 'browser')
    } else if (mod.classId === 12) {
      window.open(`https://www.curseforge.com/minecraft/texture-packs/${mod.slug}`, 'browser')
    }
  }
}
</script>
