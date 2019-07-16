<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $tc('curseforge.name', 2) }}</span>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover replace to="curseforge-mods"> 
          <v-card-title>
            Mods
          </v-card-title>
        </v-card>
      </v-flex>
      <v-flex>
        <v-card v-ripple draggable hover>
          <v-card-title>
            Resource Packs
          </v-card-title>
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
