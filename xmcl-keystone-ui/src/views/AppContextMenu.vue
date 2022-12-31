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
          class="min-w-40 mx-1 rounded-lg"
          @click="item.onClick"
        >
          <v-list-item-icon>
            <v-icon
              :size="item.icon === '$vuetify.icons.curseforge' ? 22 : undefined"
              :color="item.color || ''"
            >
              {{ item.icon }}
            </v-icon>
          </v-list-item-icon>
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

<script lang=ts setup>
import { useContextMenuData } from '../composables/contextMenu'

const { x, y, items, shown } = useContextMenuData()
document.addEventListener('keyup', (e) => {
  if (e.key === 'Escape' && shown.value) {
    shown.value = false
    e.preventDefault()
    e.stopPropagation()
  }
}, { capture: true })
</script>
