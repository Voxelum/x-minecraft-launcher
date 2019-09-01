<template>
  <v-card color="#grey darken-3" hover dark draggable 
          :style="{ 'transform': dragged ? 'scale(0.8)' : 'scale(1)' }"
          @click="$emit('click', $event)" @mousedown="dragged=true" @dragstart="$emit('dragstart',$event);" @dragend="$emit('dragend', $event);dragged=false">
    <v-img
      :class="{ 'grey': true, 'darken-2': true }"
      class="white--text"
      height="100px"
    >
      <v-container fill-height fluid>
        <v-layout fill-height>
          <v-flex xs12 align-end flexbox>
            <v-icon left>
              {{ profile.type === 'modpack' ? 'layers' : 'storage' }}
            </v-icon>
            <span class="headline">{{ profile.name || `Minecraft ${profile.version.minecraft}` }}</span>
          </v-flex>
        </v-layout>
      </v-container>
    </v-img>
            
    <v-card-text v-if="profile.description" class="headline font-weight-bold">
      {{ profile.description }}
    </v-card-text>

    <v-card-actions style="margin-top: 40px;">
      <v-list-tile class="grow">
        <v-list-tile-avatar color="grey darken-3">
          <v-chip label :selected="false" @click="$event.stopPropagation()">
            {{ profile.version.minecraft }}
          </v-chip>
        </v-list-tile-avatar>

        <v-list-tile-content>
          <v-list-tile-title>{{ profile.author }}</v-list-tile-title>
        </v-list-tile-content>
      </v-list-tile>
    </v-card-actions>
  </v-card>
</template>
<script>
export default {
  props: {
    profile: {
      type: Object,
      required: true,
    },
  },
  data() {
    return { dragged: false };
  },
};
</script>
