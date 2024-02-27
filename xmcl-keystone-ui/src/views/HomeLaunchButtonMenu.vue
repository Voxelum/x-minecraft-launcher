<template>
  <div
    v-show="items.length > 0"
    class="select-none"
    @mouseenter="$emit('mouseenter', $event)"
    @mouseleave="$emit('mouseleave', $event)"
  >
    <v-list
      nav
    >
      <template v-for="(item, index) in items">
        <v-list-item
          :key="index"
          v-on="item.onClick ? { click: item.onClick } : {}"
        >
          <v-list-item-avatar class="flex-grow-0">
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
          <v-list-item-action
            v-if="item.rightIcon"
            class="flex-grow-0"
          >
            <v-icon> {{ item.rightIcon }} </v-icon>
          </v-list-item-action>

          <v-list-item-action
            v-if="item.onClick"
            class="flex-grow-0"
          >
            <v-chip
              label
              outlined
              color="grey darken-1"
            >
              {{ t('optional') }}
            </v-chip>
          </v-list-item-action>
        </v-list-item>
      </template>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { LaunchMenuItem } from '@/composables/launchButton'

const { t } = useI18n()
defineProps<{ items: LaunchMenuItem[] }>()
</script>
