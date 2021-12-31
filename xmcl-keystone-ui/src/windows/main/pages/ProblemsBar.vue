<template>
  <v-menu
    v-show="refreshing || issues.length !== 0"
    offset-y
    top
    dark
    max-height="300"
  >
    <v-btn
      slot="activator"
      style="position: absolute; left: 200px; bottom: 10px; "
      :loading="refreshing"
      :flat="issues.length !== 0"
      outline
      dark
      :color="color"
    >
      <v-icon
        left
        dark
        :color="color"
      >
        {{ issues.length !== 0 ?
          'warning' : 'check_circle' }}
      </v-icon>
      {{ $tc('diagnosis.problem', issues.length, { count: issues.length }) }}
    </v-btn>

    <v-list>
      <template v-for="(item, index) in issues">
        <v-list-tile
          :key="index"
          ripple
          @click="fix(item, issues)"
        >
          <v-list-tile-content>
            <v-list-tile-title>
              {{ $tc(`diagnosis.${item.id}`, item.parameters.length || 0, item.parameters) }}
            </v-list-tile-title>
            <v-list-tile-sub-title>
              {{ $t(`diagnosis.${item.id}.message`, item.parameters || {}) }}
            </v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-icon> {{ item.autofix ? 'build' : 'arrow_right' }} </v-icon>
          </v-list-tile-action>
        </v-list-tile>
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { useIssues } from '/@/hooks'

export default defineComponent({
  setup() {
    const { issues, refreshing, fix } = useIssues()
    const color = computed(() => (issues.value.some(p => !p.optional) ? 'red' : 'warning'))
    return {
      issues,
      color,
      refreshing,
      fix,
    }
  },
})
</script>

<style>
</style>
