<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card color="darken-1" 
              flat hover draggable
              :class="{ incompatible: !compatible }" 
              class="draggable-card white--text" 
              :style="{ transform: dragged ? 'scale(0.8)' : 'scale(1)' }"
              style="margin-top: 10px;"
              v-on="on" @dragstart="onDragStart" @dragend="onDragEnd">
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

<script>
import { isCompatible } from 'universal/utils/versions';

export default {
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
  data() {
    return {
      dragged: false,
    };
  },
  computed: {
    metadata() { return this.data.metadata; },
    mcversion() { return this.$repo.getters.selectedProfile.version.minecraft; },
    acceptedRange() {
      return this.$repo.getters.getAcceptMinecraftRangeByFormat(this.metadata.format);
    },
    compatible() {
      return isCompatible(this.acceptedRange, this.mcversion);
    },
  },
  methods: {
    onDragStart(e) {
      this.dragged = true;
      this.$emit('dragstart', e);
      e.dataTransfer.setDragImage(this.$refs.iconImage.$el, 0, 0);
      e.dataTransfer.setData('Index', `${this.isSelected ? 'R' : 'L'}${this.index}`);
      e.dataTransfer.setData('Hash', this.data.hash);
    },
    onDragEnd(e) {
      this.$emit('dragend', e);
      this.dragged = false;
    },
  },
};
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
