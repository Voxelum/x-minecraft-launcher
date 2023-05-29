<template>
  <div class="flex flex-col mb-0">
    <div
      class="flex flex-grow-0 flex-1 flex-row items-center justify-center"
    >
      <div
        class="flex flex-row items-center gap-1 flex-grow-0 justify-center"
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
        class="flex justify-end overflow-x-auto invisible-scroll"
      >
        <v-text-field
          v-model="keyword"
          class="max-w-100"
          small
          hide-details
          outlined
          filled
          dense
          prepend-inner-icon="search"
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
          {{ mods.length + curseforgeCount + modrinthCount }}
        </div>
      </v-tab>
      <v-tab>
        <v-icon left>
          storage
        </v-icon>
        {{ t('modSearchType.local') }}
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
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { kInstance } from '@/composables/instance'
import { kModsSearch } from '@/composables/modSearch'
import { kModSearchItems } from '@/composables/modSearchItems'
import { injection } from '@/util/inject'

const { runtime: version } = injection(kInstance)
const { modrinth, curseforge, mods, keyword } = injection(kModsSearch)
const { tab } = injection(kModSearchItems)
const curseforgeCount = computed(() => curseforge.value ? curseforge.value.pagination.totalCount : 0)
const modrinthCount = computed(() => modrinth.value ? modrinth.value.total_hits : 0)
const { t } = useI18n()
</script>
