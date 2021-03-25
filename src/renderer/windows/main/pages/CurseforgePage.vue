<template>
  <v-container
    grid-list-xl
    fill-height
    style="overflow: auto;"
  >
    <v-layout
      row
      wrap
      fill-height
    >
      <v-flex
        tag="h1"
        class="white--text"
        xs12
      >
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex
        v-for="target in targets"
        :key="target"
        xs6
      >
        <v-card
          draggable="false"
          :ripple="ready"
          :hover="ready"
          replace
          :to="ready ? `/curseforge/${target}` : undefined"
          :disabled="!ready"
        >
          <v-responsive>
            <v-img :src="images[target]">
              <div
                v-if="!ready"
                style="display: flex; align-items: center; justify-content: center; height: 100%;"
              >
                <v-progress-circular
                  indeterminate
                  :size="100"
                />
              </div>
            </v-img>
          </v-responsive>
          <v-card-title>
            <h2>{{ $t(`curseforge.${target}.name`) }}</h2>
          </v-card-title>
          <v-card-text>{{ $t(`curseforge.${target}.description`) }}</v-card-text>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import resourcepack from '/@/assets/curseforge_resourcepack.webp'
import mods from '/@/assets/curseforge_mods.webp'
import modpack from '/@/assets/curseforge_modpack.webp'
import worlds from '/@/assets/curseforge_worlds.webp'
import { useNetworkStatus, useCurseforgeCategories } from '/@/hooks'

export default defineComponent({
  setup() {
    const { online } = useNetworkStatus()
    const { refreshing } = useCurseforgeCategories()
    const ready = computed(() => online.value && !refreshing.value)
    return {
      targets: ['mc-mods', 'texture-packs', 'worlds', 'modpacks'] as const,
      ready,
      images: {
        'texture-packs': resourcepack,
        'mc-mods': mods,
        modpacks: modpack,
        worlds,
      },
    }
  },
})
</script>

<style scoped=true>
.v-card {
  height: 100%;
}
</style>
