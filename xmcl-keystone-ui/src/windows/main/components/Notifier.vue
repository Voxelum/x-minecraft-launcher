<template>
  <v-snackbar
    v-model="show"
    :top="true"
    :right="true"
  >
    <v-icon
      :color="colors[level]"
      left
    >
      {{ icons[level] }}
    </v-icon>

    <span v-if="!full">{{ $t(`log.${level}`) }}</span>
    {{ title }}

    <template #action>
      <v-btn
        v-if="more"
        icon
        text
        @click="more"
      >
        <v-icon>arrow_right</v-icon>
      </v-btn>
      <v-btn
        icon
        color="pink"
        text
        @click="close"
      >
        <v-icon>close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useNotifyQueueConsumer } from '/@/windows/main/composables'

export default defineComponent({
  setup() {
    const { level, title, more, show, full } = useNotifyQueueConsumer()
    return {
      close() { show.value = false },
      level,
      title,
      show,
      more,
      full,
      icons: {
        success: 'check_circle',
        info: 'info',
        warning: 'priority_high',
        error: 'warning',
      },
      colors: {
        success: 'green',
        error: 'red',
        info: 'white',
        warning: 'orange',
      },
    }
  },
})
</script>

<style>
</style>
