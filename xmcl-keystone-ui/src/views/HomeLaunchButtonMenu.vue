<template>
  <div
    v-show="items.length > 0"
    @mouseenter="$emit('mouseenter', $event)"
    @mouseleave="$emit('mouseleave', $event)"
  >
    <v-list>
      <template v-for="(item, index) in items">
        <v-list-item
          :key="index"
        >
          <v-list-item-avatar>
            <v-icon :color="item.color ?? 'warning darken-1'">
              {{ item.icon ?? 'info' }}
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ item.title }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ item.description }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action v-if="item.rightIcon">
            <v-icon> {{ item.rightIcon }} </v-icon>
          </v-list-item-action>
        </v-list-item>
      </template>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { LaunchMenuItem } from '@/composables/launchButton'

defineProps<{ items: LaunchMenuItem[] }>()
</script>
