<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card
        ref="card"
        color="darken-1"
        flat
        hover
        draggable
        :class="{ incompatible: !compatible }"
        class="draggable-card white--text"
        :style="{ transform: dragged ? 'scale(0.8)' : 'scale(1)' }"
        style="margin-top: 10px;"
        v-on="on"
        @mousedown="dragged=true"
        @dragstart="onDragStart"
        @dragend.prevent="onDragEnd"
        @mouseleave="dragged=false"
      >
        <v-layout justify-center align-center fill-height>
          <v-flex xs6 style="padding: 0;">
            <v-img
              ref="iconImage"
              style="user-drag: none; user-select: none; height: 125px;"
              :src="pack.icon"
              contain
            />
          </v-flex>
          <v-flex xs6 style="padding-top: 10px;">
            <text-component
              style="white-space: normal; word-break: break-word;"
              :source="pack.name"
              class="title"
            />
            <text-component
              style="white-space: normal; word-break: break-word;"
              :source="pack.description"
            />
          </v-flex>
        </v-layout>
      </v-card>
    </template>
    <span>
      {{ compatible ? $t('resourcepack.compatible', { format: pack.pack_format, version: mcversion }) : $t('resourcepack.incompatible', {
      accept: pack.acceptedRange,
      actual: mcversion,
      format: pack.pack_format
      }) }}
    </span>
  </v-tooltip>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, Ref, computed } from '@vue/composition-api';
import { useInstanceVersionBase, useCompatible, useDragTransferItem, ResourcePackItem } from '@/hooks';

export interface Props {
  pack: ResourcePackItem;
  isSelected: boolean;
}

export default defineComponent<Props>({
  props: {
    pack: {
      type: Object,
      default: () => ({}),
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const data = reactive({
      dragged: false,
    });
    const iconImage: Ref<any> = ref(null);
    const { minecraft } = useInstanceVersionBase();
    const { compatible } = useCompatible(computed(() => props.pack.acceptingRange), minecraft);
    const card: Ref<Vue | null> = ref(null);

    useDragTransferItem(computed(() => card.value?.$el as HTMLElement), props.isSelected, props.pack.url[0]);

    function onDragStart(e: DragEvent) {
      data.dragged = true;
      context.emit('dragstart', e);
      e.dataTransfer!.setDragImage(iconImage.value.$el, 0, 0);
    }
    function onDragEnd(e: DragEvent) {
      context.emit('dragend', e);
      data.dragged = false;
    }
    return {
      ...toRefs(data),
      compatible,
      iconImage,
      onDragStart,
      onDragEnd,
      mcversion: minecraft,
      card,
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
