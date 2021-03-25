<template>
  <v-dialog
    v-model="isShown"
    :width="300"
    :persistent="true"
  >
    <v-card>
      <v-card-title primary-title>
        {{ $t(`launch.blocked.title`) }}
      </v-card-title>
      <v-card-text>
        {{ $t(`launch.blocked.description`) }}
        <v-list>
          <template v-for="(item, index) in issues">
            <v-list-tile
              :key="index"
              ripple
            >
              <v-list-tile-content>
                <v-list-tile-title>{{ $tc(`diagnosis.${item.id}`, item.arguments.count || 0, item.arguments) }}</v-list-tile-title>
                <v-list-tile-sub-title>{{ $t(`diagnosis.${item.id}.message`, item.arguments || {}) }}</v-list-tile-sub-title>
              </v-list-tile-content>
              <!-- <v-list-tile-action>
                <v-icon> {{ item.autofix ? 'build' : 'arrow_right' }} </v-icon>
              </v-list-tile-action>-->
            </v-list-tile>
          </template>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="hide">
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn @click="launch(true)">
          {{ $t('launch.blocked.ignore') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { useLaunch, useIssues } from '/@/hooks'
import { useDialog } from '../hooks'

export default defineComponent({
  setup() {
    const { launch, status } = useLaunch()
    const { issues } = useIssues()
    const { isShown, hide } = useDialog('launch-blocked')
    return {
      status,
      isShown,
      launch,
      issues: computed(() => issues.value.filter(i => !i.optional)),
      hide,
    }
  },
})
</script>

<style>
</style>
