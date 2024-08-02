<template>
  <div
    class="flex flex-col items-center justify-center gap-2 px-10 pb-10"
    style="font-size: 30px; font-weight: 600; letter-spacing: 1px; word-spacing: 2px; line-height: 36px; "
  >
    <div class="flex flex-grow-0 gap-4">
      <v-icon
        v-if="modrinth"
        size="90"
        color="green"
      >
        $vuetify.icons.modrinth
      </v-icon>
      <v-icon
        v-if="curseforge"
        size="100"
        color="orange darken-2"
      >
        $vuetify.icons.curseforge
      </v-icon>
    </div>
    <i18n-t
      keypath="modInstall.recommendation"
      tag="p"
    >
      <template
        v-if="modrinth"
        #first
      >
        <ModrinthCategoryChip
          class="text-yellow-400"
          :tag="randomModrinthCats[0]"
          @click="emit('modrinth', randomModrinthCats[0])"
        />
        <ModrinthCategoryChip
          class="ml-1 text-green-400"
          :tag="randomModrinthCats[1]"
          @click="emit('modrinth', randomModrinthCats[1])"
        />
      </template>
      <template
        v-if="curseforge"
        #second
      >
        <template v-if="curseforge">
          <CurseforgeCategoryChip
            class="text-blue-400"
            :value="randomCurseforgeCats[0]"
            @click="emit('curseforge', randomCurseforgeCats[0])"
          />
          <CurseforgeCategoryChip
            class="ml-1 text-orange-400"
            :value="randomCurseforgeCats[1]"
            @click="emit('curseforge', randomCurseforgeCats[1])"
          />
        </template>
      </template>
      <template #curseforge>
        <span
          v-if="curseforge"
          class="text-orange-500"
        >
          Curseforge
        </span>
      </template>
      <template
        v-if="modrinth"
        #modrinth
      >
        <span class="text-green-500">
          Modrinth
        </span>
      </template>
    </i18n-t>
  </div>
</template>
<script lang="ts" setup>
import { Category } from '@xmcl/modrinth'
import { ModCategory } from '@xmcl/curseforge'
import { injection } from '@/util/inject'
import { kModrinthTags } from '@/composables/modrinth'
import { kCurseforgeCategories } from '@/composables/curseforge'

import ModrinthCategoryChip from '@/components/ModrinthCategoryChip.vue'
import CurseforgeCategoryChip from '@/components/CurseforgeCategoryChip.vue'

const props = defineProps<{
  curseforge?: string
  modrinth?: string
}>()

const emit = defineEmits<{
  (event: 'modrinth', cat: Category): void
  (event: 'curseforge', cat: ModCategory): void
}>()
const { categories } = injection(kModrinthTags)
const randomModrinthCats = computed(() => {
  if (!props.modrinth) return []
  const result = [] as Category[]
  const all = categories.value.filter(c => c.project_type === props.modrinth)
  while (result.length < 2) {
    const c = all[Math.floor(Math.random() * all.length)]
    if (result.every(r => r.name !== c.name)) {
      result.push(c)
    }
  }
  return result
})

const { categories: curseforgeCategories } = injection(kCurseforgeCategories)
const randomCurseforgeCats = computed(() => {
  if (!props.curseforge) return []
  const result = [] as ModCategory[]
  const parent = curseforgeCategories.value?.find(c => c.slug === props.curseforge)
  const all = curseforgeCategories.value?.filter(c => c.parentCategoryId === parent?.id)
  if (!all) return []
  while (result.length < 2) {
    const c = all[Math.floor(Math.random() * all.length)]
    if (result.every(r => r.id !== c.id)) {
      result.push(c)
    }
  }
  return result
})

</script>
