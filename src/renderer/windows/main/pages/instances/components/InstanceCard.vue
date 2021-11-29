<template>
  <v-card
    v-draggable-card
    :ripple="!isBusy"
    color="grey darken-3"
    class="draggable-card w-full flex flex-col"
    style="padding: 0;"
    hover
    dark
    :draggable="!isBusy"
    @click="$emit('click', $event)"
    @dragstart="onDragStart"
  >
    <div v-if="isBusy" class="absolute w-full h-full flex items-center justify-center">
      <v-progress-circular class="z-10" :size="100" :width="4" indeterminate></v-progress-circular>
    </div>
    <v-img class="white--text favicon grey darken-2 max-h-50" :src="image">
      <v-layout fill-height class="justify-center flex-col relative">
        <v-flex flexbox class="justify-center items-center">
          <v-icon left>{{ instance.server ? 'storage' : 'layers' }}</v-icon>
          <span class="headline">{{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}</span>
        </v-flex>
        <v-flex v-if="instance.server" class="justify-center absolute bottom-0 w-full">
          <v-chip
            color="green"
            label
            small
            style
          >{{ instance.server.host }}:{{ instance.server.port }}</v-chip>
        </v-flex>
      </v-layout>
    </v-img>

    <v-card-text v-if="description" class="font-weight-bold">
      <text-component
        :source="typeof description === 'object' ? description : { text: description }"
      />
    </v-card-text>

    <v-card-actions>
      <div class="flex flex-wrap flex-row justify-center">
        <v-chip v-if="instance.server" small label :selected="false" @click.stop>
          <text-component :source="status.version.name" />
        </v-chip>
        <v-chip v-if="instance.server" small label :selected="false" @click.stop>
          <v-avatar>
            <v-icon
              :style="{ color: status.ping < 0 ? 'grey' : status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'red' }"
            >signal_cellular_alt</v-icon>
          </v-avatar>
          {{ status.ping }} ms
        </v-chip>
        <v-chip v-if="instance.server" small label :selected="false" @click.stop>
          <v-avatar>
            <v-icon>people</v-icon>
          </v-avatar>
          {{ status.players.online }} / {{ status.players.max }}
        </v-chip>
        <v-chip label small :selected="false" @click.stop>
          <v-avatar>
            <v-icon>power</v-icon>
          </v-avatar>
          {{ instance.runtime.minecraft }}
        </v-chip>
        <v-chip
          v-if="!instance.server && instance.author"
          small
          label
          :selected="false"
          @click.stop
        >
          <v-avatar>
            <v-icon>person</v-icon>
          </v-avatar>
          {{ instance.author }}
        </v-chip>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts>
import { defineComponent, reactive, toRefs, computed } from '@vue/composition-api'
import unknownServer from '/@/assets/unknown_server.png'
import { useBusy, useInstanceServerStatus } from '/@/hooks'
import { Instance } from '/@shared/entities/instance'
import { required } from '/@/util/props'
import { getBanner } from '/@/util/banner'
import { write } from '/@shared/util/mutex'

export default defineComponent({
  props: {
    instance: required<Instance>(Object),
  },
  setup(props, context) {
    const isBusy = useBusy(write(props.instance.path))
    function onDragStart(event: DragEvent) {
      event.dataTransfer!.effectAllowed = 'move'
    }
    const { status } = useInstanceServerStatus(props.instance.path)
    const image = computed(() => {
      if (status.value.favicon && status.value.favicon !== unknownServer) {
        return status.value.favicon
      }
      const banner = getBanner(props.instance.runtime.minecraft)
      if (banner) {
        return banner
      }
      return unknownServer
    })
    return {
      isBusy,
      image,
      status,
      description: computed(() => props.instance.description),
      onDragStart,
    }
  },
})
</script>

<style>
.favicon .v-image__image {
  filter: blur(2px);
}
</style>
