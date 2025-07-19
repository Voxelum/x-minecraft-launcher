<template>
  <v-menu
    v-model="shown"
    :target="[x, y]"
    absolute
    z-index="205"
  >
    <v-list density="compact">
      <template 
        v-for="(item, index) in items" 
        :key="item.text"
      >
        <v-list-item
          class="min-w-40 mx-1 rounded-lg"
          :title="item.text"
          @click="item.onClick"
        >
          <template 
            v-if="item.icon" 
            #prepend
          >
            <v-icon
              :size="item.icon === 'xmcl:curseforge' ? 22 : undefined"
              :color="item.color || ''"
            >
              {{ item.icon }}
            </v-icon>
          </template>
          <v-menu
            v-if="item.children"
            :key="item.text"
            location="end"
            open-on-hover
          >
            <template #activator="{ props }">
              <v-list-item-action
                class="w-[100%] justify-end"
               
                v-bind="props"
                @click.stop="item.onClick"
              >
                <v-icon>arrow_right</v-icon>
              </v-list-item-action>
            </template>

            <v-list
              density="compact"
              :color="isDark ? 'secondary' : ''"
            >
              <v-list-item
                v-for="child in item.children"
                :key="child.text"
                :title="child.text"
                class="min-w-40 mx-1 rounded-lg"
                @click="child.onClick(); shown = false"
              >
                <template 
                  v-if="child.icon"
                  #prepend
                >
                  <v-icon
                    :size="child.icon === 'xmcl:curseforge' ? 22 : undefined"
                    :color="child.color || ''"
                  >
                    {{ child.icon }}
                  </v-icon>
                </template>
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
