<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap fill-height style="overflow: auto;">
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex v-for="target in targets" :key="target" xs6>
        <v-card draggable="false" :ripple="!online" :hover="!online" replace :to="online ? `/curseforge/${target}` : undefined" :disabled="!online">
          <v-responsive>
            <v-img :src="images[target]">
              <v-expand-transition>
                <div v-if="!online"
                     class="d-flex transition-fast-in-fast-out orange darken-2 v-card--reveal display-3 white--text"
                     style="height: 100%;">
                  Offline
                </div>
              </v-expand-transition>
            </v-img>
          </v-responsive>
          <v-card-title>
            <h2>
              {{ $t(`curseforge.${target}.name`) }}
            </h2>
          </v-card-title>
          <v-card-text>
            {{ $t(`curseforge.${target}.description`) }}
          </v-card-text>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import resourcepack from '@/assets/curseforge_resourcepack.png';
import mods from '@/assets/curseforge_mods.png';
import modpack from '@/assets/curseforge_modpack.png';
import worlds from '@/assets/curseforge_worlds.png';
import { computed } from '@vue/composition-api';
import { useNetworkStatus } from '@/hooks';

export default {
  setup() {
    const { online } = useNetworkStatus();
    return {
      targets: ['mc-mods', 'texture-packs', 'worlds', 'modpacks'],
      online,
      images: {
        'texture-packs': resourcepack,
        'mc-mods': mods,
        modpacks: modpack,
        worlds,
      },
    };
  },
};
</script>

<style scoped=true>
.v-card {
  height: 100%;
}
</style>
