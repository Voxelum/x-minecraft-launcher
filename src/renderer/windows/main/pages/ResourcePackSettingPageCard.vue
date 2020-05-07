<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card color="darken-1" 
              flat hover draggable
              :class="{ incompatible: !compatible }" 
              class="draggable-card white--text" 
              :style="{ transform: dragged ? 'scale(0.8)' : 'scale(1)' }"
              style="margin-top: 10px;"
              v-on="on"
              @mousedown="dragged=true" 
              @dragstart="onDragStart" 
              @dragend.prevent="onDragEnd"
              @mouseleave="dragged=false">
        <v-layout justify-center align-center fill-height>
          <v-flex xs6 style="padding: 0;">
            <v-img ref="iconImage" style="user-drag: none; user-select: none; height: 125px;" :src="metadata.icon" contain />
          </v-flex>
          <v-flex xs6 style="padding-top: 10px;">
            <text-component style="white-space: normal; word-break: break-word;" :source="metadata.packName"
                            class="title" />
            <text-component style="white-space: normal; word-break: break-word;" :source="metadata.description" />
          </v-flex>
        </v-layout>
      </v-card>
    </template>
    {{ compatible ? $t('resourcepack.compatible', { format: metadata.format, version: mcversion }) : $t('resourcepack.incompatible', {
      accept: acceptedRange,
      actual: mcversion,
      format: metadata.format
    }) }}
    <v-divider />
  </v-tooltip>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, Ref } from '@vue/composition-api';
import { ResourcePackResource } from '@universal/store/modules/resource';
import { useResourcePackResource, useInstanceVersionBase, useCompatible } from '@/hooks';

export default defineComponent({
  props: {
    data: {
      type: Object,
      default: () => ({}),
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    index: {
      type: Number,
      default: 0,
    },
  },
  setup(props, context) {
    const data = reactive({
      dragged: false,
    });
    const iconImage: Ref<any> = ref(null);
    const { metadata, icon, acceptedRange } = useResourcePackResource(props.data as ResourcePackResource);
    const { minecraft } = useInstanceVersionBase();
    const { compatible } = useCompatible(acceptedRange, minecraft);
    function onDragStart(e: DragEvent) {
      data.dragged = true;
      context.emit('dragstart', e);
      e.dataTransfer!.setDragImage(iconImage.value.$el, 0, 0);
      e.dataTransfer!.setData('Index', `${props.isSelected ? 'R' : 'L'}${props.index}`);
      e.dataTransfer!.setData('Hash', props.data.hash);
    }
    function onDragEnd(e: DragEvent) {
      context.emit('dragend', e);
      data.dragged = false;
    }
    return {
      ...toRefs(data),
      metadata,
      icon,
      compatible,
      acceptedRange,
      iconImage,
      onDragStart,
      onDragEnd,
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
