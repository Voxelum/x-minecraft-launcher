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
        <v-list-item
          :key="item.text"
          color="green"
          @click="item.onClick"
        >
          <v-list-item-avatar>
            <v-icon
              :size="item.icon === '$vuetify.icons.curseforge' ? 22 : undefined"
            >
              {{ item.icon }}
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-title>{{ item.text }}</v-list-item-title>
        </v-list-item>
        <v-divider
          v-if="index !== items.length - 1"
          :key="index"
        />
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useContextMenuData } from '../windows/main/composables/contextMenu'

export default defineComponent({
  setup() {
    return useContextMenuData()
  },
})
</script>

<style>
</style>
