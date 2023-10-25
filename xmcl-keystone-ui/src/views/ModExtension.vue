<template>
  <div class="mb-0 flex flex-col">
    <div
      class="flex flex-1 flex-grow-0 flex-row items-center justify-center"
    >
      <div
        class="flex flex-grow-0 flex-row items-center justify-center gap-1"
      >
        <AvatarItem
          responsive
          :avatar="'image://builtin/minecraft'"
          title="Minecraft"
          :text="`${version.minecraft}`"
        />
        <v-divider
          v-if="version.forge"
          vertical
        />
        <AvatarItem
          v-if="version.forge"
          responsive
          :avatar="'image://builtin/forge'"
          title="Forge"
          :text="`${version.forge}`"
        />
        <v-divider
          v-if="version.fabricLoader"
          vertical
        />
        <AvatarItem
          v-if="version.fabricLoader"
          responsive
          :avatar="'image://builtin/fabric'"
          title="Fabric"
          :text="`${version.fabricLoader}`"
        />
        <v-divider
          v-if="version.quiltLoader"
          vertical
        />
        <AvatarItem
          v-if="version.quiltLoader"
          responsive
          :avatar="'image://builtin/quilt'"
          title="Quilt"
          :text="`${version.quiltLoader}`"
        />
        <v-divider
          v-if="version.optifine"
          vertical
        />
        <AvatarItem
          v-if="version.optifine"
          responsive
          :avatar="'image://builtin/optifine'"
          title="Optifine"
          :text="`${version.optifine}`"
        />
        <!-- <v-divider
          v-if="version.optifine"
          vertical
        /> -->
        <!-- <AvatarItem
          responsive
          icon="folder_zip"
          :title="t('mod.name', { count: 2 })"
          :text="t('mod.enabled', { count: modCount })"
        /> -->
      </div>
      <div class="flex-grow" />
      <div
        class="invisible-scroll flex justify-end gap-4 overflow-x-auto"
      >
        <v-btn-toggle
          v-model="modLoaderFilters"
          multiple
          dense
        >
          <v-btn
            icon
            text
            value="forge"
          >
            <v-img
              width="28"
              :src="'image://builtin/forge'"
            />
          </v-btn>

          <v-btn
            icon
            text
            value="fabric"
          >
            <v-img
              width="28"
              :src="'image://builtin/fabric'"
            />
          </v-btn>

          <v-btn
            icon
            text
            value="quilt"
          >
            <v-img
              width="28"
              :src="'image://builtin/quilt'"
            />
          </v-btn>
        </v-btn-toggle>
        <v-text-field
          ref="searchTextField"
          v-model="_keyword"
          class="max-w-80 min-w-70"
          :placeholder="t('mod.search')"
          small
          hide-details
          outlined
          filled
          dense
          prepend-inner-icon="search"
          @focus="searchTextFieldFocused = true"
          @blur="searchTextFieldFocused = false"
        />
      </div>
    </div>
    <v-tabs
      v-model="tab"
      class="mt-3"
      centered
      background-color="transparent"
    >
      <v-tab>
        <v-icon left>
          all_inclusive
        </v-icon>
        {{ t('modSearchType.all') }}
        <div
          class="v-badge__badge primary static ml-1 w-[unset]"
        >
          {{ cachedMods.length + curseforgeCount + modrinthCount }}
        </div>
      </v-tab>
      <v-tab :disabled="cachedMods.length === 0">
        <v-icon left>
          storage
        </v-icon>
        {{ t('modSearchType.local') }}
        <div
          class="v-badge__badge primary static ml-1 w-[unset]"
        >
          {{ cachedMods.length }}
        </div>
      </v-tab>
      <v-tab :disabled="curseforge.length === 0">
        <v-icon
          :size="28"
          left
        >
          $vuetify.icons.curseforge
        </v-icon>
        Curseforge
        <div
          class="v-badge__badge primary static ml-1 w-[unset]"
        >
          {{ curseforgeCount }}
        </div>
      </v-tab>
      <v-tab :disabled="modrinth.length === 0">
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
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { kInstance } from '@/composables/instance'
import { kModsSearch } from '@/composables/modSearch'
import { kMods } from '@/composables/mods'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'

const search = debounce((v: string | undefined) => {
  if (v !== route.query.keyword) {
    replace({ query: { ...route.query, keyword: v } })
  }
}, 800)
const { replace } = useRouter()
const route = useRoute()
const _keyword = computed({
  get: () => route.query.keyword as string ?? '',
  set: (v) => { search(v) },
})

const { runtime: version } = injection(kInstance)
const { modrinth, curseforge, cachedMods, modLoaderFilters } = injection(kModsSearch)
const { tab } = injection(kMods)
const curseforgeCount = computed(() => curseforge.value ? curseforge.value.length : 0)
const modrinthCount = computed(() => modrinth.value ? modrinth.value.length : 0)
const { t } = useI18n()

const searchTextField = ref(undefined as any | undefined)
const searchTextFieldFocused = ref(false)
const onKeyPress = (e: KeyboardEvent) => {
  // ctrl+f
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.focus()
  }
  // ctrl+a
  if (searchTextFieldFocused.value && e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.$el.querySelector('input')?.select()
  }
  // esc
  if (searchTextFieldFocused.value && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    searchTextField.value?.blur()
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeyPress, { capture: true })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyPress)
})
</script>
