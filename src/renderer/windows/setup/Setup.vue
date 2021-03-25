<template>
  <v-app
    dark
    class="moveable"
    fill-height
  >
    <!-- <v-container> -->
    <v-card
      v-if="!fetching"
      style="height: 100%; display: flex; flex-direction: column;"
    >
      <v-card-title
        style="background-color: black"
        class="elevation-3;"
      >
        <h2>{{ $t('title') }}</h2>
      </v-card-title>
      <v-divider />
      <v-list
        class="non-moveable"
        three-line
        subheader
        style="background: transparent; width: 100%"
      >
        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ $t('defaultPath') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ defaultPath }}</v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ $t('path') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ path }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-btn
              outline
              flat
              style="margin-right: 10px;"
              @click="browse"
            >
              {{ $t('browse') }}
            </v-btn>
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
      <div style="flex-grow: 1" />
      <v-card-actions
        class="non-moveable"
        style="justify-content: center; display: flex;"
      >
        <v-btn
          large
          block
          flat
          color="green"
          :loading="loading"
          @click="setup"
        >
          {{ $t('confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-card
      v-else
      style="height: 100%"
    >
      <v-container fill-height>
        <v-layout
          align-center
          justify-center
          row
          fill-height
        >
          <v-flex
            shrink
            style="text-align:center; user-select: none;"
          >
            <v-progress-circular
              :size="100"
              color="white"
              indeterminate
            />
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
    <!-- </v-container> -->
  </v-app>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, inject } from '@vue/composition-api'
import { useIpc, useNativeDialog, useI18n } from '/@/hooks'
import { I18N_KEY } from '/@/constant'

export default defineComponent({
  setup() {
    const i18n = inject(I18N_KEY)
    const { $t } = useI18n()
    const ipcRenderer = useIpc()
    const dialog = useNativeDialog()
    const data = reactive({
      fetching: true,
      minecraftPath: '',
      path: '',
      defaultPath: '',
      loading: false,
    })
    ipcRenderer.invoke('preset').then(({ minecraftPath, defaultPath, locale }) => {
      data.fetching = false
      i18n!.locale = locale
      data.minecraftPath = minecraftPath
      data.path = defaultPath
      data.defaultPath = defaultPath
    })
    function setup() {
      ipcRenderer.invoke('setup', data.path)
      data.loading = true
    }
    async function browse() {
      const { filePaths } = await dialog.showOpenDialog({
        title: $t('browse'),
        defaultPath: data.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      })
      if (filePaths && filePaths.length !== 0) {
        data.path = filePaths[0]
      }
    }
    return {
      ...toRefs(data),
      setup,
      browse,
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

body {
  height: 100%;
}
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
</style>
