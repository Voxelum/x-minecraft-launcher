<template>
  <v-app>
    <v-card
      class="h-full"
    >
      <v-toolbar
        height="40"
        class="moveable fixed w-full"
      >
        <v-toolbar-title>Logger</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          class="non-moveable"
          @click="close"
        >
          <v-icon>
            close
          </v-icon>
        </v-btn>
      </v-toolbar>
      <v-virtual-scroll
        class="mt-[40px]"
        item-height="48"
        :items="logs"
      >
        <template #default="{ item }">
          <v-list-item
            :key="item.id"
            class="flex flex-row gap-2"
            @click="onClick(item)"
          >
            <v-chip
              v-for="t in item.tags"
              :key="t"
              outlined
              label
            >
              {{ t }}
            </v-chip>
            <v-list-item-content>
              <v-list-item-title v-text="item.content" />
            </v-list-item-content>
          </v-list-item>
        </template>
      </v-virtual-scroll>
    </v-card>
  </v-app>
</template>

<script lang=ts>
import { defineComponent, onMounted, reactive, toRefs } from '@vue/composition-api'
import { Log, parseLog } from './log'

export default defineComponent({
  setup() {
    const { hide } = windowController
    const data = reactive({
      logs: [] as Log[],
    })
    function accept(log: string) {
      data.logs.push(parseLog(log))
    }

    onMounted(() => {
      gameOutput.on('minecraft-stderr', accept)
      gameOutput.on('minecraft-stdout', accept)
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
  overflow-x: auto;
  text-overflow: unset;
}
::-webkit-scrollbar {
  display: none;
}
</style>
