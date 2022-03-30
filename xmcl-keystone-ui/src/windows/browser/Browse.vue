<template>
  <v-app
    style="background: transparent;"
  >
    <div class="flex flex-col">
      <v-progress-linear v-if="refreshing && installed.length === 0" />
      <div class="bg-[#303030] flex moveable flex-grow-0 flex-shrink gap-5">
        <span />
        <span class="moveable flex-grow px-40 p-2 flex">
          <v-btn
            class="non-moveable"
            :loading="refreshing"
            text
            icon
            @click="refresh"
          >
            <v-icon>refresh</v-icon>
          </v-btn>
          <v-text-field
            v-model="url"
            :loading="loading"
            :rules="rules"
            :error="!!error"
            :disabled="loading"
            class="non-moveable rounded-2xl"
            solo
            text
            append-icon="arrow_right"
            @keypress.enter="onEnter"
          />
          <v-btn
            class="non-moveable"
            :loading="refreshing"
            text
            icon
            @click="onEnter"
          >
            <v-icon>get_app</v-icon>
          </v-btn>
        </span>
        <span class="p-0 flex flex-shrink flex-grow-0 align-top items-start">
          <v-icon
            v-ripple
            class="flex items-center px-2 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)]"
            small
            @click="minimize"
          >minimize</v-icon>
          <!-- <v-icon
            v-ripple
            class="flex items-center px-2 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)]"
            small
            @click="maximize"
          >maximize</v-icon>-->

          <v-icon
            v-ripple
            class="flex items-center px-2 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgb(209,12,12)]"
            small
            @click="close"
          >close</v-icon>
        </span>
      </div>
      <main class="p-2 flex-grow">
        <AppCard
          v-for="app in installed"
          :key="app.url"
          :manifest="app"
          :default-app="defaultApp"
          @uninstall="uninstall(app.url)"
          @shortcut="createShortcut(app.url)"
          @boot="boot(app.url)"
        />
      </main>
    </div>
  </v-app>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, reactive, toRefs } from '@vue/composition-api'
import { InstalledAppManifest } from '@xmcl/runtime-api'
import AppCard from './AppCard.vue'
import { useRefreshable } from '/@/composables'

export default defineComponent({
  components: { AppCard },
  setup() {
    const { maximize, minimize, hide } = windowController

    const data = reactive({
      url: '',
      defaultApp: '',
      error: '',
      installed: [] as InstalledAppManifest[],
    })
    const isUrl = /^https?:\/\/.+$/g
    const rules = computed(() => [
      (v: string) => !v ? true : !(isUrl.test(v) || 'Invalid URL!'),
    ])
    const { refresh, refreshing } = useRefreshable(async () => {
      data.installed = await appsHost.getInstalledApps()
      data.defaultApp = await appsHost.getDefaultApp()
    })
    const createShortcut = (url: string) => {
      appsHost.createShortcut(url)
    }
    function close() {
      hide()
    }
    const { refresh: onEnter, refreshing: loading } = useRefreshable(async () => {
      try {
        data.error = ''
        await appsHost.installApp(data.url)
        refresh()
      } catch (e) {
        if (e === 'NonHTML') {
          data.error = 'The url is not targeting an html!'
        } else if (e === 'InvalidHTML') {
          data.error = 'The url is not targeting an valid html! Maybe manifest in html is missing!'
        } else {
          data.error = (e as any).toString()
        }
        console.error(e)
      }
    })
    const uninstall = async (url: string) => {
      await appsHost.uninstallApp(url)
      refresh()
    }
    const boot = async (url: string) => {
      await appsHost.bootAppByUrl(url)
      refresh()
    }
    onMounted(() => {
      refresh()
    })
    return {
      ...toRefs(data),
      createShortcut,
      uninstall,
      boot,
      rules,
      refreshing,
      refresh,
      loading,
      onEnter,
      maximize,
      minimize,
      close,
    }
  },
})
</script>
<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}

html ::-webkit-scrollbar {
  display: none;
}

.v-input__control {
  @apply rounded-xl;
}

.v-text-field.v-text-field--solo .v-input__control {
  min-height: 36px;
}
</style>
