<template>
  <v-snackbar
    v-model="isShown"
    :top="true"
    :right="true"
  >
    <v-icon
      color="green"
      left
    >
      check_circle
    </v-icon>

    New Version available!
    <span>1.0.0</span>
    <v-btn
      style="margin-right: -30px"
      flat
      @click="updateServiceWorker()"
    >
      Update
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

<script lang="ts">
import { defineComponent, ref, watch } from '@vue/composition-api'
import { useRegisterSW } from 'virtual:pwa-register/vue'

export default defineComponent({
  setup() {
    const isShown = ref(false)
    const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
      onNeedRefresh() {
        isShown.value = true
      },
      onRegistered(info) {
      },
    })
    const close = () => {
      isShown.value = false
    }
    return {
      close,
      updateServiceWorker,
      isShown,
    }
  },
})
</script>
