<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex xs6>
        <v-card v-ripple hover replace to="/curseforge/mc-mods">
          <v-card-media>
            <v-img :src="mods" />
          </v-card-media>
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
          <v-card-media>
            <v-img :src="resourcepack" />
          </v-card-media>
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
        <v-card disabled>
          <v-card-title>
            {{ $t('curseforge.worlds.name') }}
            敬请期待
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.worlds.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex xs6>
        <v-card disabled>
          <v-card-title>
            {{ $t('curseforge.modpacks.name') }}
            敬请期待
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
import resourcepack from 'renderer/assets/curseforge.resourcepack.png';
import mods from 'renderer/assets/curseforge.mods.png';

export default {
  data: () => ({
    resourcepack,
    mods,
  }),
};
</script>

<style scoped=true>
</style>
