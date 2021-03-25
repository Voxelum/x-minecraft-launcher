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

    {{ title }}
    <span v-if="!full">{{ $t(`log.${level}`) }}</span>
    <v-btn
      v-if="more"
      style="margin-right: -30px"
      flat
      @click="more"
    >
      <v-icon>arrow_right</v-icon>
    </v-btn>
    <v-btn
      color="pink"
      flat
      @click="close"
    >
      <v-icon>close</v-icon>
    </v-btn>
  </v-snackbar>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useNotifyQueueConsumer } from '../hooks'

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
