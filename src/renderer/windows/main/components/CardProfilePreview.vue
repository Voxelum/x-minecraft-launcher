<template>
  <v-card color="#grey darken-3" hover dark draggable 
          :style="{ 'transform': dragged ? 'scale(0.8)' : 'scale(1)' }"
          @click="$emit('click', $event)" @mousedown="dragged=true" @dragstart="$emit('dragstart',$event);" @dragend="$emit('dragend', $event);dragged=false">
    <v-img
      :class="{ 'grey': true, 'darken-2': true }"
      class="white--text favicon"
      height="100px"
      :src="favicon || ''"
    >
      <v-container fill-height fluid>
        <v-layout fill-height row wrap>
          <v-flex xs12 align-end flexbox>
            <!-- <v-chip large class="headline" label> -->
            <v-icon left>
              {{ profile.type === 'modpack' ? 'layers' : 'storage' }}
            </v-icon>
            <span class="headline">
              {{ profile.name || `Minecraft ${profile.version.minecraft}` }}
            </span>
            <!-- </v-chip> -->
          </v-flex>
          <v-flex v-if="profile.type === 'server'" xs12 align-end flexbox>
            <div style="color: #bdbdbd">
              {{ profile.host }}:{{ profile.port }}
            </div>
          </v-flex>
        </v-layout>
      </v-container>
    </v-img>
            
    <v-card-text v-if="description" class="font-weight-bold">
      <text-component :source="description" />
    </v-card-text>

    <v-card-actions style="">
      <v-list-tile class="grow">
        <v-list-tile-content style="overflow-x: auto; max-width: 275px; white-space: nowrap; display: block;">
          <v-chip label small :selected="false" @click="$event.stopPropagation()">
            <v-avatar>
              <v-icon>power</v-icon>
            </v-avatar>
            {{ profile.version.minecraft }}
          </v-chip>
          <v-chip v-if="profile.type === 'server'" small label :selected="false" @click="$event.stopPropagation()">
            <v-avatar>
              <v-icon>people</v-icon>
            </v-avatar>
            {{ players.online }}  /{{ players.max }} 
          </v-chip>
          <v-chip v-if="profile.type === 'server'" small label :selected="false" @click="$event.stopPropagation()">
            <v-avatar>
              <v-icon :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }">
                signal_cellular_alt
              </v-icon>
            </v-avatar>
            {{ ping }} ms  
          </v-chip>
          <v-chip v-if="profile.type === 'server'" small label :selected="false" @click="$event.stopPropagation()">
            {{ version.name }}  
          </v-chip>
          <v-chip v-if="profile.type === 'modpack'" small label :selected="false" @click="$event.stopPropagation()">
            <v-avatar>
              <v-icon>person</v-icon>
            </v-avatar>
            {{ profile.author }}
          </v-chip>
        </v-list-tile-content>
      </v-list-tile>
    </v-card-actions>
  </v-card>
</template>
<script>
import { createComponent, reactive, toRefs, computed, onMounted, watch } from '@vue/composition-api';
import { useStore, useAction, useServerStatusForProfile } from '@/hooks';

export default createComponent({
  props: {
    profile: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const data = reactive({
      dragged: false,
    });
    const refs = toRefs(data);

    return props.profile.type === 'modpack' ? {
      dragged: refs.dragged,
      description: computed(() => props.profile.description),
      favicon: '',
    } : {
      dragged: refs.dragged,
      ...useServerStatusForProfile(props.profile.id),
    };
  },
});
</script>

<style>
.favicon .v-image__image {
   filter: blur(10px);
}
</style>
