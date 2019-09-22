<template>
  <vue-particles v-if="loading" color="#dedede" style="position: absolute; width: 100%; height: 100%;" />
  <v-layout v-else fill-height>
    <v-navigation-drawer :value="true" mini-variant stateless dark 
                         style="border-radius: 2px 0 0 2px;"
                         class="moveable">
      <v-toolbar flat class="transparent">
        <v-list class="pa-0 non-moveable">
          <v-list-tile avatar @click="goBack">
            <v-list-tile-avatar>
              <v-icon dark>
                arrow_back
              </v-icon>
            </v-list-tile-avatar>
          </v-list-tile>
        </v-list>
      </v-toolbar>
      <v-list class="non-moveable">
        <v-divider dark style="display: block !important;" />
        <v-list-tile :disabled="!logined" replace to="/">
          <v-list-tile-action>
            <v-icon>home</v-icon>
          </v-list-tile-action>
        </v-list-tile>
        <v-list-tile :disabled="!logined" replace to="/profiles">
          <v-list-tile-action>
            <v-icon>apps</v-icon>
          </v-list-tile-action>
        </v-list-tile>
        <v-list-tile :disabled="!logined" replace to="/user">
          <v-list-tile-action>
            <v-icon>person</v-icon>
          </v-list-tile-action>
        </v-list-tile>
        <v-list-tile :disabled="!logined" replace to="/curseforge">
          <v-list-tile-action style="padding-right: 2px;">
            <v-icon :size="14">
              $vuetify.icons.curseforge
            </v-icon>
          </v-list-tile-action>
        </v-list-tile>
        <v-spacer />
      </v-list>
      <v-list class="non-moveable" style="position: absolute; bottom: 0px;">
        <v-list-tile v-ripple @click="showTaskDialog">
          <v-list-tile-action>
            <v-badge right :value="activeTasksCount !== 0">
              <template v-slot:badge>
                <span>{{ activeTasksCount }}</span>
              </template>
              <v-icon dark>
                assignment
              </v-icon>
            </v-badge>
          </v-list-tile-action>
        </v-list-tile>
        <v-divider dark style="display: block !important;" />
        <v-list-tile replace to="/setting">
          <v-list-tile-action>
            <v-icon dark>
              settings
            </v-icon>
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <v-layout style="padding: 0; background: transparent; max-height: 100vh;" fill-height>
      <v-card class="main-body" color="grey darken-4">
        <img v-if="backgroundImage" :src="`file:///${backgroundImage}`" :style="{ filter: `blur:${blur}px` }" style="z-index: -0; filter: blur(4px); position: absolute; width: 100%; height: 100%;">
        <vue-particles v-else color="#dedede" style="position: absolute; width: 100%; height: 100%;" click-mode="repulse" />
        <transition name="fade-transition" mode="out-in">
          <!-- <keep-alive> -->
          <router-view />
          <!-- </keep-alive> -->
        </transition>
        <notifier />
        <context-menu />
        <dialog-login />
        <dialog-task v-model="taskDialog" />
      </v-card>
    </v-layout>
  </v-layout>
</template>

<script>
import 'renderer/assets/common.css';
import {
  onMounted,
  onBeforeMount,
  reactive,
  toRefs,
  computed,
  watch,
  createComponent,
} from '@vue/composition-api';
import { ipcRenderer } from 'electron';
import { useStore, useRouter } from './index';

export default {
  setup(props, ctx) {
    const router = useRouter();
    const store = useStore();
    const template = {
      loading: true,
      localHistory: [],
      timeTraveling: false,
      taskDialog: false,
    };
    const data = reactive(template);

    const activeTasksCount = computed(
      () => store.state.task.tasks.filter(t => t.status === 'running').length,
    );
    const blur = computed(
      () => store.getters.selectedProfile.blur || store.state.setting.defaultBlur,
    );
    const backgroundImage = computed(
      () => store.getters.selectedProfile.image
        || store.state.setting.defaultBackgroundImage,
    );
    const logined = computed(() => store.getters.logined);

    watch(backgroundImage, () => {
      refreshImage();
    });

    router.afterEach((to, from) => {
      if (!data.timeTraveling) data.localHistory.push(from.fullPath);
    });

    onMounted(() => {
      ipcRenderer.once('vuex-sync', () => {
        data.loading = false;
      });
      ipcRenderer.on('task', showTaskDialog);
    });

    function showTaskDialog(show) {
      if (typeof show === 'boolean') {
        data.taskDialog = show;
      } else {
        data.taskDialog = true;
      }
    }

    function refreshImage() {
      const img = backgroundImage;
    }

    function goBack() {
      if (!logined.value && router.currentRoute.path === '/login') {
        return;
      }
      data.timeTraveling = true;
      const before = data.localHistory.pop();
      if (before) {
        router.replace(before);
      }
      data.timeTraveling = false;
    }

    return {
      ...toRefs(data),
      activeTasksCount,
      showTaskDialog,
      blur,
      goBack,
      logined,
      backgroundImage,
    };
  },
};
</script>

<style>
.clip-head {
  clip-path: inset(0px 30px 30px 0px) !important;
  width: 64px;
  height: auto; /*to preserve the aspect ratio of the image*/
}
.v-input__icon--prepend {
  margin-right: 7px;
}
img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>

<style scoped=true>
.main-body {
  max-width: 720px;
  width: 100%;
  border-radius: 0px 2px 2px 0;
}
</style>
