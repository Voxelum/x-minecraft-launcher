<template>
  <div
    class="v-alert white--text"
    style="border-color: transparent !important"
  >
    <i
      aria-hidden="true"
      class="v-icon material-icons theme--dark v-alert__icon"
    >
      <img
        :src="status.favicon || unknownServer"
        style="max-height: 64px;"
      >
    </i>
    <div>
      <text-component :source="status.version.name" />
      <v-spacer />
      <text-component :source="status.description" />
    </div>
    <v-btn
      icon
      :loading="pinging"
      style="align-self: center;"
      @click="refresh"
    >
      <v-icon>refresh</v-icon>
    </v-btn>
  </div>
</template>

<script lang=ts>
import { onMounted, defineComponent } from '@vue/composition-api'
import { useInstanceServerStatus, useBusy } from '/@/hooks'
import unknownServer from '/@/assets/unknown_server.png'

export default defineComponent({
  setup() {
    const { refresh, status, pinging } = useInstanceServerStatus()

    onMounted(() => {
      if (status.value.ping <= 0) {
        refresh()
      }
    })
    return {
      unknownServer,
      status,
      pinging,
      refresh,
    }
  },
})
</script>

<style>
</style>
