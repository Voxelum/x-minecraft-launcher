<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap fill-height style="overflow: auto;">
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex xs6>
        <v-card v-ripple hover replace to="/curseforge/mc-mods">
          <v-responsive>
            <v-img :src="mods" />
          </v-responsive>
          <v-card-title>
            <h2>
              {{ $t('curseforge.mc-mods.name') }}
            </h2>
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.mc-mods.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex xs6>
        <v-card v-ripple hover replace to="/curseforge/texture-packs">
          <v-responsive>
            <v-img :src="resourcepack" />
          </v-responsive>
          <v-card-title>
            <h2>
              {{ $t('curseforge.texture-packs.name') }}
            </h2>
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.texture-packs.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex xs6>
        <v-card v-ripple hover replace to="/curseforge/worlds">
          <v-responsive>
            <v-img :src="worlds" />
          </v-responsive>
          <v-card-title>
            <h2>
              {{ $t('curseforge.worlds.name') }}
            </h2>
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.worlds.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex xs6>
        <v-card v-ripple hover replace to="/curseforge/modpacks">
          <v-responsive>
            <v-img :src="modpack" />
          </v-responsive>
          <v-card-title>
            <h2>
              {{ $t('curseforge.modpacks.name') }}
            </h2>
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.modpacks.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import resourcepack from 'renderer/assets/curseforge_resourcepack.png';
import mods from 'renderer/assets/curseforge_mods.png';
import modpack from 'renderer/assets/curseforge_modpack.png';
import worlds from 'renderer/assets/curseforge_worlds.png';

export default {
  data: () => ({
    resourcepack,
    mods,
    modpack,
    worlds,
  }),
};
</script>

<style scoped=true>
.v-card {
  height: 100%;
}
</style>
