<template>
  <v-menu
    offset-y
    top

    max-height="300"
  >
    <template #activator="{ on }">
      <v-btn
        v-show="refreshing || issues.length !== 0"
        slot="activator"
        :loading="refreshing"
        :text="issues.length !== 0"
        outlined
        :color="color"
        v-on="on"
      >
        <v-icon
          left

          :color="color"
        >
          {{ issues.length !== 0 ?
            'warning' : 'check_circle' }}
        </v-icon>
        {{ $tc('diagnosis.problem', issues.length, { count: issues.length }) }}
      </v-btn>
    </template>

    <v-list>
      <template v-for="(item, index) in issues">
        <v-list-item
          :key="index"
          ripple
          @click="fix(item, issues)"
        >
          <v-list-item-content>
            <v-list-item-title>
              {{ $tc(`diagnosis.${item.id}`, item.parameters.length || 0, item.parameters) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ $t(`diagnosis.${item.id}.message`, item.parameters || {}) }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-icon> {{ item.autofix ? 'build' : 'arrow_right' }} </v-icon>
          </v-list-item-action>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts setup>
import { useIssues } from '/@/composables'

const { issues, refreshing, fix } = useIssues()
const color = computed(() => (issues.value.some(p => !p.optional) ? 'red' : 'warning'))
</script>

<style>
</style>
