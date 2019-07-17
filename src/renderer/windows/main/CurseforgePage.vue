<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover replace to="/curseforge/mc-mods"> 
          <v-card-title>
            {{ $t('curseforge.mc-mods.name') }}
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.mc-mods.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover replace to="/curseforge/texture-packs">
          <v-card-title>
            {{ $t('curseforge.texture-packs.name') }}
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.texture-packs.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover replace to="/curseforge/worlds">
          <v-card-title>
            {{ $t('curseforge.worlds.name') }}
          </v-card-title>
          <v-card-text>
            {{ $t('curseforge.worlds.description') }}
          </v-card-text>
        </v-card>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover replace to="/curseforge/modpacks">
          <v-card-title>
            {{ $t('curseforge.modpacks.name') }}
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
export default {

};
</script>

<style>
</style>
