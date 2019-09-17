<template>
  <v-dialog>
    <v-toolbar color="primary">
      Download Missing Server Mods
    </v-toolbar>
    <v-card>
      <v-card-text>
        We are trying to resolve the mod from my self host server.
        <br>
        And the launcher will download the mods if it's found on the server.
        <br>
        Otherwise, you will have to download it by yourself. (You can use curseforge.)
      </v-card-text>
      <v-list>
        <v-list-tile v-for="item in items" :key="`${item.modid}:${item.version}`">
          <v-list-tile-content>
            <v-list-tile-title>{{ item.modid }}</v-list-tile-title>
            <v-list-tile-title>{{ item.version }}</v-list-tile-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-progress-circular indeterminate />
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
      <v-card-actions>
        <v-btn color="success">
          Start
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      default: () => [],
    },
  },
};
</script>

<style>
</style>
