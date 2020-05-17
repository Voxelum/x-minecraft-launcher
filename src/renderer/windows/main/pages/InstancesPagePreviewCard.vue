<template>
  <v-card color="#grey darken-3" hover dark draggable 
          :style="{ 'transform': dragged ? 'scale(0.8)' : 'scale(1)' }"
          @click="$emit('click', $event)" 
          @mousedown.left="dragged = true"
          @dragstart="$emit('dragstart',$event);" 
          @dragend="$emit('dragend', $event); dragged = false"
  >
    <v-img
      :class="{ 'grey': true, 'darken-2': true }"
      class="white--text favicon"
      height="100px"
      :src="favicon || ''"
    >
      <v-container fill-height fluid>
        <v-layout fill-height row wrap>
          <v-flex xs12 align-end flexbox>
            <v-icon left>
              {{ instance.server ? 'storage' : 'layers' }}
            </v-icon>
            <span class="headline">
              {{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}
            </span>
          </v-flex>
          <v-flex v-if="instance.server" xs12 align-end flexbox>
            <div style="color: #bdbdbd">
              {{ instance.host }}:{{ instance.port }}
            </div>
          </v-flex>
        </v-layout>
      </v-container>
    </v-img>
            
    <v-card-text v-if="description" class="font-weight-bold">
      <text-component :source="typeof description === 'object' ? description : {text: description}" />
    </v-card-text>

    <v-card-actions style="">
      <v-list-tile class="grow">
        <v-list-tile-content style="overflow-x: auto; max-width: 275px; white-space: nowrap; display: block;">
          <v-chip label small :selected="false" @click.stop>
            <v-avatar>
              <v-icon>power</v-icon>
            </v-avatar>
            {{ instance.runtime.minecraft }}
          </v-chip>
          <v-chip v-if="instance.server" small label :selected="false" @click.stop>
            <v-avatar>
              <v-icon>people</v-icon>
            </v-avatar>
            {{ players.online }}  /{{ players.max }} 
          </v-chip>
          <v-chip v-if="instance.server" small label :selected="false" @click.stop>
            <v-avatar>
              <v-icon :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }">
                signal_cellular_alt
              </v-icon>
            </v-avatar>
            {{ ping }} ms  
          </v-chip>
          <v-chip v-if="instance.server" small label :selected="false" @click.stop>
            {{ version.name }}  
          </v-chip>
          <v-chip v-if="!instance.server" small label :selected="false" @click.stop>
            <v-avatar>
              <v-icon>person</v-icon>
            </v-avatar>
            {{ instance.author }}
          </v-chip>
        </v-list-tile-content>
      </v-list-tile>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts>
import { defineComponent, reactive, toRefs, computed } from '@vue/composition-api';
import { useServerStatusForProfile } from '@/hooks';
import unknownPack from '@/assets/unknown_pack.png';

export default defineComponent({
  props: {
    instance: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const data = reactive({
      dragged: false,
    });
    const refs = toRefs(data);

    return props.instance.server ? {
      dragged: refs.dragged,
      ...useServerStatusForProfile(props.instance.id),
    } : {
      dragged: refs.dragged,
      favicon: unknownPack,
      description: computed(() => props.instance.description),
    };
  },
});
</script>

<style>
.favicon .v-image__image {
   filter: blur(10px);
}
</style>
