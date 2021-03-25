<template>
  <v-menu
    v-model="shown"
    :position-x="x"
    :position-y="y"
    absolute
    offset-y
    z-index="205"
  >
    <v-list dense>
      <template v-for="(item, index) in items">
        <v-list-tile
          :key="item.text"
          color="green"
          @click="item.onClick"
        >
          <v-list-tile-avatar>
            <v-icon :size="item.icon === '$vuetify.icons.curseforge' ? 14: undefined">
              {{ item.icon }}
            </v-icon>
          </v-list-tile-avatar>
          <v-list-tile-title>{{ item.text }}</v-list-tile-title>
        </v-list-tile>
        <v-divider :key="index" />
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useContextMenuData } from '../hooks'

export default defineComponent({
  setup() {
    return useContextMenuData()
  },
})
</script>

<style>
</style>
