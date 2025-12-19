<template>
  <div class="flex flex-col items-center justify-center gap-6 h-full w-full p-8 select-none">
    
    <!-- Hero Section -->
    <div class="relative group">
      <div class="absolute inset-0 bg-gradient-to-tr from-green-500/20 to-orange-500/20 blur-3xl opacity-50 rounded-full group-hover:opacity-75 transition-opacity duration-700"></div>
      <div class="flex items-center justify-center gap-8 relative z-10 transform transition-transform duration-500 hover:scale-105">
        <v-icon size="80" class="text-green-500 drop-shadow-2xl">
          $vuetify.icons.modrinth
        </v-icon>
        <v-icon size="40" class="text-gray-400 animate-pulse">
          add
        </v-icon>
        <v-icon size="90" class="text-orange-500 drop-shadow-2xl">
          $vuetify.icons.curseforge
        </v-icon>
      </div>
    </div>

    <!-- Text Content -->
    <div class="text-center max-w-2xl relative z-10">
      <h2 class="text-4xl font-extrabold mb-4 bg-gradient-to-r from-green-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
        {{ t('modInstall.search') }}
      </h2>
      <p class="text-lg text-gray-400 mb-8 font-medium leading-relaxed">
        <i18n-t keypath="modInstall.recommendation" tag="span">
            <template #first>
              <!-- Chips Container -->
               <div class="flex flex-wrap justify-center gap-3 my-4">
                  <template v-if="modrinth">
                    <div 
                      v-for="cat in randomModrinthCats" 
                      :key="cat.name"
                      class="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 cursor-pointer transition-all active:scale-95 flex items-center gap-2 group"
                      @click="emit('modrinth', cat)"
                    >
                      <div class="w-2 h-2 rounded-full bg-green-500 group-hover:shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-shadow"></div>
                      <span class="font-bold text-green-400">{{ t(`modrinth.categories.${cat.name}`, cat.name) }}</span>
                    </div>
                  </template>

                  <template v-if="curseforge">
                    <div 
                      v-for="cat in randomCurseforgeCats" 
                      :key="cat.id"
                      class="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 cursor-pointer transition-all active:scale-95 flex items-center gap-2 group"
                      @click="emit('curseforge', cat)"
                    >
                      <img :src="cat.iconUrl" class="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity" />
                      <span class="font-bold text-orange-400">{{ cat.name }}</span>
                    </div>
                  </template>
               </div>
            </template>
            
            <template #curseforge>
              <span class="font-bold text-orange-400 hover:text-orange-300 transition-colors">CurseForge</span>
            </template>
            <template #modrinth>
              <span class="font-bold text-green-400 hover:text-green-300 transition-colors">Modrinth</span>
            </template>
        </i18n-t>
      </p>
    </div>

    <!-- Decorative Elements -->
    <div class="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>

  </div>
</template>

<script lang="ts" setup>
import { Category } from '@xmcl/modrinth'
import { ModCategory } from '@xmcl/curseforge'
import { injection } from '@/util/inject'
import { kModrinthTags } from '@/composables/modrinth'
import { kCurseforgeCategories } from '@/composables/curseforge'
import { useI18n } from 'vue-i18n-bridge'

const props = defineProps<{
  curseforge?: string
  modrinth?: string
}>()

const emit = defineEmits<{
  (event: 'modrinth', cat: Category): void
  (event: 'curseforge', cat: ModCategory): void
}>()

const { t } = useI18n()

const { categories } = injection(kModrinthTags)
const randomModrinthCats = computed(() => {
  if (!props.modrinth) return []
  const result = [] as Category[]
  const all = categories.value.filter(c => c.project_type === props.modrinth)
  if (all.length < 2) return all
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
  if (all.length < 2) return all
  while (result.length < 2) {
    const c = all[Math.floor(Math.random() * all.length)]
    if (c && result.every(r => r.id !== c.id)) {
      result.push(c)
    }
  }
  return result
})

</script>
