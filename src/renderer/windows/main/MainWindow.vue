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
        <!-- <img v-if="backgroundImage" :src="`file:///${backgroundImage}`" :style="{ filter: `blur:${blur}px` }" style="z-index: -0; filter: blur(4px); position: absolute; width: 100%; height: 100%;"> -->
        <vue-particles v-if="showParticle" color="#dedede" style="position: absolute; width: 100%; height: 100%; z-index: 0; tabindex = -1;" :click-mode="particleMode" />
        <transition name="fade-transition" mode="out-in">
          <!-- <keep-alive> -->
          <router-view />
          <!-- </keep-alive> -->
        </transition>
        <context-menu />
      </v-card>
    </v-layout>
    <notifier />
    <dialogs />
  </v-layout>
</template>

<script lang=ts>
import 'renderer/assets/common.css';
import {
  onMounted,
  onBeforeMount,
  reactive,
  toRefs,
  computed,
  watch,
  createComponent,
  InjectionKey,
  ref,
  provide,
} from '@vue/composition-api';
import { ipcRenderer } from 'electron';
import {
  useDialog,
  useParticle,
  useStore,
  useRouter,
  useCurrentUserStatus,
  useBackgroundImage,
  useTasks,
  DIALOG_SHOWING,
  DIALOG_OPTION,
  DIALOG_RESULT,
  provideDialog,
  provideNotifier,
} from '@/hooks';
import dialogs from './dialog';

export default createComponent({
  components: { dialogs },
  setup(props, ctx) {
    provideDialog();
    provideNotifier();
  
    const { particleMode, showParticle } = useParticle();
    const { activeTasksCount } = useTasks();
    const { logined } = useCurrentUserStatus();
    const { showDialog } = useDialog('task');
    const { blur, backgroundImage } = useBackgroundImage();
    const router = useRouter();

    const data = reactive<{
      loading: boolean;
      localHistory: string[];
      timeTraveling: boolean;
      taskDialog: boolean;
    }>({
      loading: true,
      localHistory: [],
      timeTraveling: false,
      taskDialog: false,
    });
    
    onMounted(() => {
      ipcRenderer.once('vuex-sync', () => {
        data.loading = false;
      });
      watch(backgroundImage, () => {
        refreshImage();
      });
      watch(particleMode, () => {
        if (showParticle.value) {
          showParticle.value = false;
          setImmediate(() => {
            showParticle.value = true;
          });
        }
      });
    });
    router.afterEach((to, from) => {
      if (!data.timeTraveling) data.localHistory.push(from.fullPath);
    });
    function showTaskDialog() {
      showDialog();
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
      particleMode,
      showParticle,
    };
  },
});
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
