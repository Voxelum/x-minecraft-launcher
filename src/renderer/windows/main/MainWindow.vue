<template>
  <v-app dark style="background: transparent;">
    <v-container v-if="loading" color="primary" align-center justify-center style="position: absolute; width: 100%; height: 100%; background-color: #212121" />
    <v-layout v-else fill-height>
      <side-bar />
      <v-layout style="padding: 0; background: transparent; max-height: 100vh;" fill-height>
        <v-card class="main-body" color="grey darken-4">
          <img v-if="backgroundImage" :src="`file:///${backgroundImage}`" :style="{ filter: `blur:${blur}px` }" style="z-index: -0; filter: blur(4px); position: absolute; width: 100%; height: 100%;">
          <vue-particles v-if="showParticle" 
                         color="#dedede" 
                         :style="{ 'pointer-events': onHomePage ? 'auto' : 'none' }"
                         style="position: absolute; width: 100%; height: 100%; z-index: 0; tabindex = -1;" 
                         :click-mode="particleMode" />
          <transition name="fade-transition" mode="out-in">
            <!-- <keep-alive> -->
            <router-view />
          <!-- </keep-alive> -->
          </transition>
        </v-card>
      </v-layout>
      <context-menu />
      <search-bar />
      <notifier />
      <login-dialog />
      <task-dialog />
      <launch-status-dialog />
    </v-layout>
  </v-app>
</template>

<script lang=ts>
import '@/assets/common.css';
import {
  onMounted,
  onUnmounted,
  reactive,
  toRefs,
  watch,
  defineComponent,
  ref,
  Ref,
} from '@vue/composition-api';
import { IpcRendererEvent } from 'electron';
import {
  useParticle,
  useStore,
  useBackgroundImage,
  useIpc,
  useI18n,
  useRouter,
} from '@/hooks';
import { provideTasks } from '@/providers/provideTasks'; 
import { provideDialog, provideNotifier, useNotifier, provideLoginDialog, provideSearchToggle } from './hooks';
import LoginDialog from './dialog/BaseLoginDialog.vue';
import TaskDialog from './dialog/BaseTaskDialog.vue';
import LaunchStatusDialog from './dialog/BaseLaunchStatusDialog.vue';

export default defineComponent({
  components: { LoginDialog, TaskDialog, LaunchStatusDialog },
  setup() {
    provideDialog();
    provideNotifier();
    provideTasks();

    provideSearchToggle();

    const ipcRenderer = useIpc();
    const { particleMode, showParticle } = useParticle();
    const { blur, backgroundImage } = useBackgroundImage();
    const router = useRouter();
    const onHomePage = ref(router.currentRoute.path === '/');
    provideLoginDialog();

    router.afterEach((to) => {
      onHomePage.value = to.path === '/';
    });

    const data = reactive({
      loading: true,
    });

    function refreshImage() {
      const img = backgroundImage;
    }

    onMounted(() => {
      ipcRenderer.once('synced', () => {
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

    return {
      ...toRefs(data),
      // searchBar,
      blur,
      backgroundImage,
      particleMode,
      showParticle,
      onHomePage,
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
