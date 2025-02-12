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
          <v-list-item-icon v-if="item.icon">
            <v-icon
              :size="item.icon === '$vuetify.icons.curseforge' ? 22 : undefined"
              :color="item.color || ''"
            >
              {{ item.icon }}
            </v-icon>
          </v-list-item-icon>
          <v-list-item-title>{{ item.text }}</v-list-item-title>
          <v-menu v-if="item.children" :key="item.text" offset-x open-on-hover>
            <template #activator="{ on, attrs }">
              <v-list-item-action
                class="w-[100%] justify-end"
                v-bind="attrs"
                v-on="on"
                @click.stop="item.onClick"
              >
                <v-icon>arrow_right</v-icon>
              </v-list-item-action>
            </template>

            <v-list dense :color="isDark ? 'secondary' : ''">
              <v-list-item
                v-for="(child, i) in item.children"
                  :key="child.text"
                  class="min-w-40 mx-1 rounded-lg"
                  @click="child.onClick"
                >
                <v-list-item-icon
                  v-if="child.icon"
                >
                  <v-icon
                    :size="child.icon === '$vuetify.icons.curseforge' ? 22 : undefined"
                    :color="child.color || ''"
                  >
                    {{ child.icon }}
                  </v-icon>
                </v-list-item-icon>
                <v-list-item-title>{{ child.text }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
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
import { injection } from '@/util/inject';
import { useContextMenuData } from '../composables/contextMenu'
import { kTheme } from '@/composables/theme';

const { isDark } = injection(kTheme)

const { x, y, items, shown } = useContextMenuData()
document.addEventListener('keyup', (e) => {
  if (e.key === 'Escape' && shown.value) {
    shown.value = false
    e.preventDefault()
    e.stopPropagation()
  }
}, { capture: true })
</script>
