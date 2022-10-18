<template>
  <div
    v-show="items.length > 0"
    @mouseenter="$emit('mouseenter', $event)"
    @mouseleave="$emit('mouseleave', $event)"
  >
    <!-- <v-card-title>
      <v-icon
        left
        :color="color"
      >
        {{ items.length !== 0 ?
          'warning' : 'check_circle' }}
      </v-icon>
      {{ t('diagnosis.problem', items.length, { count: items.length }) }}
    </v-card-title> -->
    <!-- <v-card-text> -->
    <v-list>
      <template v-for="(item, index) in items">
        <v-list-item
          :key="index"
          ripple
          @click="fix(item, issues)"
        >
          <v-list-item-avatar>
            <v-icon color="warning darken-1">
              info
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
          <!-- <v-list-item-action>
            <v-icon> {{ item.autoFix ? 'build' : 'arrow_right' }} </v-icon>
          </v-list-item-action> -->
        </v-list-item>
      </template>
    </v-list>
    <!-- </v-card-text> -->
  </div>
</template>
<script lang="ts" setup>
import { useProblemItems } from '../composables/problems'
import { useIssues } from '@/composables'
const { refreshing, fix, issues } = useIssues()
const items = useProblemItems(issues)
const { t } = useI18n()
const color = computed(() => (issues.value.some(p => !p.optional) ? 'error' : 'warning'))

</script>
