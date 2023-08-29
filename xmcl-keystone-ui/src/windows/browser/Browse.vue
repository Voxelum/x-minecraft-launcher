<template>
  <v-app
    style="background: transparent;"
    class="max-h-[100vh] overflow-auto overflow-x-hidden"
  >
    <div class="flex flex-col overflow-auto overflow-x-hidden">
      <v-progress-linear v-if="refreshing && installed.length === 0" />
      <div class="moveable flex flex-shrink flex-grow-0 gap-5 bg-[#303030]">
        <span />
        <span class="moveable flex flex-grow p-2 px-40">
          <v-btn
            class="non-moveable mx-2 mt-1.5"
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
            class="non-moveable mx-2 mt-1.5"
            :loading="refreshing"
            text
            icon
            @click="onEnter"
          >
            <v-icon>get_app</v-icon>
          </v-btn>
        </span>
        <span class="flex flex-shrink flex-grow-0 items-start p-0 align-top">
          <v-icon
            v-ripple
            class="xy-0 non-moveable flex cursor-pointer select-none items-center px-2 py-1 hover:bg-[rgba(255,255,255,0.5)]"
            small
            @click="minimize"
          >minimize</v-icon>
          <v-icon
            v-ripple
            class="non-moveable top-0 flex cursor-pointer select-none items-center px-2 py-1 hover:bg-[rgb(209,12,12)]"
            small
            @click="close"
          >close</v-icon>
        </span>
      </div>
      <main class="flex-grow overflow-auto overflow-x-hidden p-2 ">
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
import { computed, defineComponent, onMounted, reactive, toRefs } from 'vue'
import { InstalledAppManifest } from '@xmcl/runtime-api'
import AppCard from './AppCard.vue'
import { useRefreshable } from '@/composables'

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

::-webkit-scrollbar {
    width: 8px;
    cursor: pointer;
}

::-webkit-scrollbar-thumb {
    width: 8px;
    cursor: pointer;
    background: rgba(155, 155, 155, 0.5);
    transition: all 1s;
    border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
    width: 8px;
    background: rgba(192, 192, 192, 0.8);
    transition: all 1s;
}

.v-input__control {
  @apply rounded-xl;
}

.v-text-field.v-text-field--solo .v-input__control {
  min-height: 36px;
}
</style>
