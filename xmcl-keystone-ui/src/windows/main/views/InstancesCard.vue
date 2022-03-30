<template>
  <v-card
    v-draggable-card
    :ripple="!isBusy"
    class="draggable-card w-full flex flex-col"
    :dark="!isSelected"
    :color="isSelected ? 'primary' : ''"
    outlined
    :shaped="isSelected"
    :class="{ selected: isSelected }"
    style="padding: 0;"
    hover
    :draggable="!isBusy"
    @click="$emit('click', $event)"
    @dragstart="onDragStart"
  >
    <div
      v-if="isBusy"
      class="absolute w-full h-full flex items-center justify-center"
    >
      <v-progress-circular
        class="z-10"
        :size="100"
        :width="4"
        indeterminate
      />
    </div>
    <v-img
      class="white--text favicon grey en-2 max-h-50"
      :src="image"
    >
      <v-layout
        fill-height
        class="justify-center flex-col relative"
      >
        <v-flex
          flexbox
          class="justify-center items-center"
        >
          <v-icon left>
            {{ instance.server ? 'storage' : 'layers' }}
          </v-icon>
          <span class="headline">{{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}</span>
        </v-flex>
        <v-flex
          v-if="instance.server"
          class="justify-center absolute bottom-0 w-full"
        >
          <v-chip
            color="green"
            label
            small
            style
          >
            {{ instance.server.host }}:{{ instance.server.port }}
          </v-chip>
        </v-flex>
      </v-layout>
    </v-img>

    <v-card-text
      v-if="description"
      class="font-weight-bold"
    >
      <text-component
        :source="typeof description === 'object' ? description : { text: description }"
      />
    </v-card-text>

    <v-card-actions>
      <div class="flex flex-wrap flex-row justify-center gap-2">
        <v-chip
          v-if="instance.server"
          small
          label
          outlined
          :input-value="false"
          @click.stop
        >
          <text-component :source="status.version.name" />
        </v-chip>
        <v-chip
          v-if="instance.server"
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon
              :style="{ color: status.ping < 0 ? 'grey' : status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'red' }"
            >
              signal_cellular_alt
            </v-icon>
          </v-avatar>
          {{ status.ping }} ms
        </v-chip>
        <v-chip
          v-if="instance.server"
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon>people</v-icon>
          </v-avatar>
          {{ status.players.online }} / {{ status.players.max }}
        </v-chip>
        <v-chip
          label
          outlined
          small
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <img
              :src="minecraftPng"
              alt="minecraft"
            >
            <!-- <v-icon>power</v-icon> -->
          </v-avatar>
          {{ instance.runtime.minecraft }}
        </v-chip>
        <v-chip
          v-if="!instance.server && instance.author"
          outlined
          small
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon>person</v-icon>
          </v-avatar>
          {{ instance.author }}
        </v-chip>
        <v-chip
          v-if="instance.runtime.forge"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="forgePng"
              alt="forge"
            >
          </v-avatar>
          {{ instance.runtime.forge }}
        </v-chip>
        <v-chip
          v-if="instance.runtime.fabricLoader"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="fabricPng"
              alt="fabric"
            >
          </v-avatar>
          {{ instance.runtime.fabricLoader }}
        </v-chip>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import unknownServer from '/@/assets/unknown_server.png'
import { useBusy, useService } from '/@/composables'
import { Instance, InstanceServiceKey, write } from '@xmcl/runtime-api'
import { required } from '/@/util/props'
import { getBanner } from '/@/util/banner'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import fabricPng from '/@/assets/fabric.png'
import { useInstanceServerStatus } from '../composables/serverStatus'

export default defineComponent({
  props: {
    instance: required<Instance>(Object),
  },
  setup(props, context) {
    const isBusy = useBusy(write(props.instance.path))
    const { state } = useService(InstanceServiceKey)
    const isSelected = computed(() => state.path === props.instance.path)
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
      isSelected,
      isBusy,
      image,
      status,
      description: computed(() => props.instance.description),
      onDragStart,
      minecraftPng,
      forgePng,
      fabricPng,
    }
  },
})
</script>

<style>
.favicon .v-image__image {
  filter: blur(2px);
}
</style>
<style scoped>
.draggable-card {
  transition: all;
  transition-duration: 0.2s;
}
.selected {
}

</style>
