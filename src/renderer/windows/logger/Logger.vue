<template>
  <v-app
    dark
    style="background: transparent;"
  >
    <v-card
      fill-heigh
      style="height: 100%;"
      dark
    >
      <v-toolbar
        dark
        height="40"
        width="500"
        class="moveable"
      >
        <v-toolbar-title>Logger</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          class="non-moveable"
          @click="close"
        >
          <v-icon dark>
            close
          </v-icon>
        </v-btn>
      </v-toolbar>
      <v-list style="overflow: auto; max-height: 90vh; max-width: 100%">
        <v-list-tile
          v-for="(l, index) in logs"
          :key="index"
          avatar
          @click="onClick(l)"
        >
          <v-chip
            v-for="t in l.tags"
            :key="t"
            dark
            outline
            label
          >
            {{ t }}
          </v-chip>
          <v-list-tile-content>
            <v-list-tile-title v-text="l.content" />
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
    </v-card>
  </v-app>
</template>

<script lang=ts>
import { defineComponent, onMounted, onUnmounted, reactive, toRefs } from '@vue/composition-api'
import { useService, useWindowController } from '/@/hooks'
import { parseLog, Log } from './log'
import { LaunchServiceKey } from '/@shared/services/LaunchService'

export default defineComponent({
  setup() {
    const { on, removeListener } = useService(LaunchServiceKey)
    const { hide } = useWindowController()
    const data = reactive({
      logs: [] as Log[],
    })
    function accept(log: string) {
      data.logs.push(parseLog(log))
    }

    onMounted(() => {
      on('minecraft-stderr', accept)
      on('minecraft-stdout', accept)
    })
    onUnmounted(() => {
      removeListener('minecraft-stderr', accept)
      removeListener('minecraft-stdout', accept)
    })
    return {
      ...toRefs(data),
      close() {
        hide()
      },
      onClick(log: Log) {
        navigator.clipboard.writeText(log.raw)
      },
    }
  },
})
</script>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.01s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.v-list__tile__content {
  margin-left: 7px;
}
.v-list__tile__title {
  overflow: auto;
  text-overflow: unset;
}
::-webkit-scrollbar {
  display: none;
}
</style>
