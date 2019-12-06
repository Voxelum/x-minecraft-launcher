<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card color="darken-1" 
              flat hover draggable
              :class="{ incompatible: !compatible }" 
              class="draggable-card mod-card white--text" 
              :style="{ transform: dragged ? 'scale(0.8)' : 'scale(1)' }"
              style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s;"
              v-on="on" 
              @mousedown="dragged=true" 
              @dragstart="onDragStart" 
              @dragend="onDragEnd"
              @mouseup="dragged=false"
              @mouseleave="dragged=false"
              @click="$emit('click', $event)">
        <v-layout justify-center align-center fill-height>
          <v-flex v-if="icon" xs4 style="padding: 0 10px 0 0;" fill-height>
            <v-img ref="iconImage" :src="icon" style="height: 100%" contain />
          </v-flex>
          <v-flex xs8 style="padding: 10px 0;">
            <h3>
              {{ metadata.name || data.name }}
              {{ metadata.version }}
            </h3>
            <span style="color: #bdbdbd">
              {{ metadata.description }}
            </span>
          </v-flex>
        </v-layout>
      </v-card>
    </template>
    {{ compatible ? $t('mod.compatible', { version: mcversion }) : $t('mod.incompatible', { accept: acceptedRange, actual:
      mcversion }) }}
    <v-divider />
  </v-tooltip>
</template>

<script lang=ts>
import { createComponent, ref, Ref } from '@vue/composition-api';
import { useForgeModResource, useCompatible, useInstanceVersionBase, useShell } from '@/hooks';

export default createComponent({
  props: {
    data: {
      required: true,
      type: Object,
    },
    isSelected: {
      required: true,
      type: Boolean,
    },
    index: {
      required: true,
      type: Number,
    },
  },
  setup(props, context) {
    const shell = useShell();
    const { icon, metadata, acceptedRange } = useForgeModResource(props.data as any);
    const { minecraft } = useInstanceVersionBase();
    const { compatible } = useCompatible(acceptedRange, minecraft);
    const dragged = ref(false);
    const iconImage: Ref<any> = ref(null);

    function onDragStart(e: DragEvent) {
      dragged.value = true;
      e.dataTransfer!.setDragImage(iconImage.value!.$el, 0, 0);
      e.dataTransfer!.setData('Index', `${props.isSelected ? 'R' : 'L'}${props.index}`);
      e.dataTransfer!.setData('Hash', props.data.hash);
      context.emit('dragstart', e);
    }
    function onDragEnd(e: DragEvent) {
      dragged.value = false;
      context.emit('dragend', e);
    }
    // function tryOpen(e) {
    //   if (props.data.url) {
    //     shell.openExternal(props.data.url);
    //   }
    // }

    return {
      dragged,
      icon,
      iconImage,
      metadata,
      compatible,
      acceptedRange,
      onDragEnd,
      onDragStart,
      mcversion: minecraft,
    };
  },
});
</script>

<style scoped=true>
.incompatible.draggable-card:hover {
  background-color: #e65100;
}
.draggable-card:hover {
  background-color: #388e3c;
}

.title {
  max-width: 100%;
  white-space: nowrap;
}
</style>
