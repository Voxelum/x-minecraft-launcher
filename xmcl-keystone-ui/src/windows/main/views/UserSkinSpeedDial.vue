<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        v-if="security"
        v-model="fab"
        style="z-index: 3; display: flex; justify-content: center"
        direction="top"
        :open-on-hover="true"
      >
        <template #activator>
          <v-btn
            v-model="fab"
            :disabled="disabled"
            fab
            v-on="on"
            @click="load"
          >
            <v-icon>edit</v-icon>
          </v-btn>
        </template>
        <v-tooltip
          :close-delay="0"
          left
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              :disabled="disabled"
              fab
              small
              v-on="tooltip"
              @click="upload"
            >
              <v-icon>link</v-icon>
            </v-btn>
          </template>
          {{ $t('user.skinImportLink') }}
        </v-tooltip>
        <v-tooltip
          :close-delay="0"
          left
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              :disabled="disabled"
              fab
              small
              v-on="tooltip"
              @click="save"
            >
              <v-icon>save</v-icon>
            </v-btn>
          </template>
          {{ $t('user.skinSave') }}
        </v-tooltip>
      </v-speed-dial>
    </template>
    {{ $t('user.skinImportFile') }}
  </v-tooltip>
</template>

<script lang=ts>
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    load: required<() => void>(Function),
    upload: required<() => void>(Function),
    save: required<() => void>(Function),
    disabled: required<boolean>(Boolean),
    security: required<boolean>(Boolean),
  },
  setup() {
    const data = reactive({
      fab: false,
    })
    return {
      ...toRefs(data),
    }
  },
})
</script>

<style>
</style>
