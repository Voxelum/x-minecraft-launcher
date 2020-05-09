<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card
        ref="card"
        color="darken-1"
        flat
        hover
        draggable
        :class="{ incompatible: !compatible, unknown: compatible === 'unknown' }"
        class="mod-card white--text"
        :style="{ transform: dragged ? 'scale(0.8)' : 'scale(1)' }"
        style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s;"
        v-on="on"
        @mousedown="dragged=true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @mouseup="dragged=false"
        @mouseleave="dragged=false"
        @contextmenu="tryOpen"
        @click="$emit('click', $event);"
      >
        <v-layout justify-center align-center fill-height>
          <v-flex v-if="mod.icon" xs4 style="padding: 0 10px 0 0;" fill-height>
            <v-img ref="iconImage" :src="mod.icon" style="height: 100%" contain />
          </v-flex>
          <v-flex xs8 style="padding: 10px 0;">
            <h3>{{ mod.name }}</h3>
            <v-chip small outline label style="margin-left: 1px;">{{ mod.version }}</v-chip>
            <div style="color: #bdbdbd">{{ mod.description }}</div>
            <!-- <div v-if="compatible === 'unknown'" 
                 style="font-style: italic; text-decoration: underline">
              @{{ basename(mod.path) }}
            </div>-->
          </v-flex>
        </v-layout>
      </v-card>
    </template>
    {{
    compatible === 'unknown'
    ? $t('mod.nocompatible', { version: mcversion })
    : compatible
    ? $t('mod.compatible', { version: mcversion })
    : $t('mod.incompatible', { accept: mod.acceptedRange, actual: mcversion })
    }}
    <v-divider />
  </v-tooltip>
</template>

<script lang=ts>
import Vue from 'vue';
import { defineComponent, ref, Ref, computed } from '@vue/composition-api';
import { useInstanceVersionBase, useDragTransferItem, useCompatible, useService, ModItem } from '@/hooks';

export interface Props {
  mod: ModItem;
  isSelected: boolean;
}

export default defineComponent<Props>({
  props: {
    mod: {
      required: true,
      type: Object,
    },
    isSelected: {
      required: true,
      type: Boolean,
    },
  },
  setup(props, context) {
    const { minecraft } = useInstanceVersionBase();
    const { compatible } = useCompatible(computed(() => props.mod.acceptMinecraft), minecraft);
    const { openInBrowser } = useService('BaseService');
    const dragged = ref(false);
    const iconImage: Ref<Vue | null> = ref(null);
    const card: Ref<Vue | null> = ref(null);

    useDragTransferItem(computed(() => card.value?.$el as HTMLElement), props.isSelected, props.mod.url);

    function onDragStart(e: DragEvent) {
      dragged.value = true;
      e.dataTransfer!.setDragImage(iconImage.value!.$el, 0, 0);
      context.emit('dragstart', e);
    }
    function onDragEnd(e: DragEvent) {
      dragged.value = false;
      context.emit('dragend', e);
    }
    function tryOpen() {
      if (typeof props.mod.url === 'string') {
        openInBrowser(props.mod.url);
      }
    }
    function basename(s: string) {
      return s.substring(s.lastIndexOf('/') + 1).substring(s.lastIndexOf('\\') + 1);
    }

    return {
      card,
      dragged,
      iconImage,
      compatible,
      onDragEnd,
      onDragStart,
      mcversion: minecraft,
      tryOpen,
      basename,
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
.unknown:hover {
  background-color: #c24f11b6;
}

.title {
  max-width: 100%;
  white-space: nowrap;
}
</style>
