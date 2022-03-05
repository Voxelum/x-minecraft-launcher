<template>
  <v-dialog
    :value="value"
    width="500"
    persistent
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ $t('save.copy.title') }}
      </v-card-title>
      <v-card-text>
        {{ $t('save.copy.description') }}
      </v-card-text>

      <v-card-text>
        <v-checkbox
          v-for="(p, index) of instances"
          :key="index"
          v-model="selected[index]"
          hide-details
          :label="p"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="red"
          text
          @click="cancel"
        >
          {{ $t('save.copy.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          text
          @click="operate"
        >
          {{ $t('save.copy.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { defineComponent, ref } from '@vue/composition-api'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    cancel: required<() => void>(Function),
    operate: required<(instances: string[]) => void>(Function),
    value: required<string>(String),
    instances: required<string[]>(Array),
  },
  setup(props) {
    const selected = ref(new Array<string>(props.instances.length))
    return {
      selected,
      doOperation() {
        const func = props.operate
        func(props.instances.filter((_, index) => selected.value[index]))
      },
    }
  },
})
</script>

<style>
</style>
