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
            <v-list-item
              :key="index"
              ripple
            >
              <v-list-item-content>
                <v-list-item-title>{{ $tc(`diagnosis.${item.id}`, item.parameters.length || 0, item.parameters) }}</v-list-item-title>
                <v-list-item-subtitle>{{ $t(`diagnosis.${item.id}.message`, item.parameters || {}) }}</v-list-item-subtitle>
              </v-list-item-content>
              <!-- <v-list-item-action>
                <v-icon> {{ item.autofix ? 'build' : 'arrow_right' }} </v-icon>
              </v-list-item-action>-->
            </v-list-item>
          </template>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="hide">
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn @click="launch()">
          {{ $t('launch.blocked.ignore') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { useDialog } from '../composables/dialog'
import { useLaunch } from '../composables/launch'
import { useIssues } from '/@/composables'

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
