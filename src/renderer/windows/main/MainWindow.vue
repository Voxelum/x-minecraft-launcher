<template>
  <v-container v-if="loading" color="primary" align-center justify-center style="position: absolute; width: 100%; height: 100%; background-color: #212121" />
  <v-layout v-else fill-height>
    <side-bar />
    <v-layout style="padding: 0; background: transparent; max-height: 100vh;" fill-height>
      <v-card class="main-body" color="grey darken-4">
        <!-- <img v-if="backgroundImage" :src="`file:///${backgroundImage}`" :style="{ filter: `blur:${blur}px` }" style="z-index: -0; filter: blur(4px); position: absolute; width: 100%; height: 100%;"> -->
        <vue-particles v-if="showParticle" color="#dedede" style="position: absolute; width: 100%; height: 100%; z-index: 0; tabindex = -1;" :click-mode="particleMode" />
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
    <dialogs />
  </v-layout>
</template>

<script lang=ts>
import '@/assets/common.css';
import {
  onMounted,
  onUnmounted,
  reactive,
  toRefs,
  watch,
  createComponent,
} from '@vue/composition-api';
import {
  useDialog,
  useParticle,
  useStore,
  useBackgroundImage,
  provideDialog,
  provideNotifier,
  useIpc,
  useI18n,
  useNotifier,
} from '@/hooks';
import dialogs from './dialog';
import { IpcRendererEvent } from 'electron';

export default createComponent({
  components: { dialogs },
  setup() {
    provideDialog();
    provideNotifier();

    const ipcRenderer = useIpc();
    const { particleMode, showParticle } = useParticle();
    const { t } = useI18n();
    const { showDialog } = useDialog('task');
    const { blur, backgroundImage } = useBackgroundImage();
    const { notify } = useNotifier();
    const { state } = useStore();

    const data = reactive({
      loading: true,
    });

    function onSuccessed(event: IpcRendererEvent, id: string) {
      const task = state.task.tree[id];
      if (task.background) return;
      notify('success', t(task.path, task.arguments || {}));
    }
    function onFailed(event: IpcRendererEvent, id: string, error: any) {
      const task = state.task.tree[id];
      if (task.background) return;
      notify('error', t(task.path, task.arguments || {}), error);
    }
    onMounted(() => {
      ipcRenderer.addListener('task-successed', onSuccessed);
      ipcRenderer.addListener('task-failed', onFailed);
    });
    onUnmounted(() => {
      ipcRenderer.removeListener('task-successed', onSuccessed);
      ipcRenderer.removeListener('task-failed', onFailed);
    });

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
    function refreshImage() {
      const img = backgroundImage;
    }

    return {
      ...toRefs(data),
      blur,
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
