<template>
  <v-tooltip top>
    <template v-slot:activator="{ on }">
      <v-card color="darken-1" flat hover :class="{ incompatible: !compatible }" class="draggable-card white--text" style="margin-top: 10px;"
              draggable v-on="on" @dragstart="onDragStart">
        <v-layout justify-center align-center fill-height>
          <v-flex xs6 style="padding: 0;">
            <v-img style="user-drag: none; user-select: none; height: 125px;" :src="metadata.icon" contain />
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
      e.dataTransfer.setData('Index', `${this.isSelected ? 'R' : 'L'}${this.index}`);
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
