<template>
  <v-app ref="app" dark style="background: transparent; overflow: hidden">
    <universal-drop-view />
    <v-container
      v-if="loading"
      color="primary"
      align-center
      justify-center
      class="loading-background"
      style="position: absolute; width: 100%; height: 100%;"
    />
    <v-layout v-else fill-height>
      <side-bar :go-back="goBack" />
      <v-layout style="padding: 0; background: transparent; max-height: 100vh;" fill-height>
        <div class="main-body v-sheet" :class="{ solid: !blurMainBody }">
          <img
            v-if="backgroundImage"
            :src="backgroundImage"
            :style="{ filter: `blur(${blur}px)` }"
            style="z-index: -0; filter: blur(4px); position: absolute; width: 100%; height: 100%;"
          />
          <particles
            v-if="showParticle"
            color="#dedede"
            :style="{ 'pointer-events': onHomePage ? 'auto' : 'none' }"
            style="position: absolute; width: 100%; height: 100%; z-index: 0;"
            :click-mode="particleMode"
          />
          <transition name="fade-transition" mode="out-in">
            <router-view />
          </transition>
        </div>
      </v-layout>
      <context-menu />
      <search-bar />
      <notifier />
      <login-dialog />
      <task-dialog />
      <launch-status-dialog />
      <java-wizard-dialog />
    </v-layout>
  </v-app>
</template>

<script lang=ts>
import '/@/assets/common.css'

import {
  onMounted,
  reactive,
  toRefs,
  watch,
  defineComponent,
  ref,
  Ref,
provide,
} from '@vue/composition-api'
import {
  useParticle,
  useBackgroundImage,
  useRouter,
  useBackgroundBlur,
  provideAsyncRoute,
  useBaseService,
  provideServerStatusCache,
} from '/@/hooks'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import { provideDialog, provideNotifier, provideContextMenu, provideSearch, provideIssueHandler } from './hooks'
import LoginDialog from './dialog/BaseLoginDialog.vue'
import TaskDialog from './dialog/BaseTaskDialog.vue'
import LaunchStatusDialog from './dialog/BaseLaunchStatusDialog.vue'
import Particles from '../../components/Particles.vue'
import JavaWizardDialog from './dialog/BaseJavaWizardDialog.vue'
import { injection } from '/@/util/inject'
import { SYNCABLE_KEY } from '/@/hooks/useSyncable'

export default defineComponent({
  components: { LoginDialog, TaskDialog, LaunchStatusDialog, JavaWizardDialog, Particles: (Particles as any) },
  setup() {
    provideDialog()
    provideNotifier()

    const taskManager = useTaskManager()
    provide(TASK_MANAGER, taskManager)
  
    provideAsyncRoute()
    provideServerStatusCache()
    provideIssueHandler()

    const { text, toggle } = provideSearch()
    provideContextMenu()

    const { particleMode, showParticle } = useParticle()
    const { blurMainBody } = useBackgroundBlur()
    const { blur, backgroundImage } = useBackgroundImage()
    const { syncing } = injection(SYNCABLE_KEY)
    const { state } = useBaseService()
    const router = useRouter()
    const onHomePage = ref(router.currentRoute.path === '/')
    const app: Ref<any> = ref(null)

    function goBack() {
      router.back()
    }

    router.afterEach((to) => {
      onHomePage.value = to.path === '/'
      toggle(true)
      text.value = ''
    })

    const data = reactive({
      loading: false,
    })

    function refreshImage() {
      const img = backgroundImage
    }

    watch(syncing, (v) => {
      if (!v && data.loading) {
        data.loading = false
      }
    })

    onMounted(() => {
      watch(backgroundImage, () => {
        refreshImage()
      })
      watch(particleMode, () => {
        if (showParticle.value) {
          showParticle.value = false
          setImmediate(() => {
            showParticle.value = true
          })
        }
      })
      // app.value!.$el.classList.add(state.platform)
    })

    return {
      ...toRefs(data),
      app,
      blur,
      backgroundImage,
      blurMainBody,
      particleMode,
      showParticle,
      onHomePage,
      goBack,
    }
  },
})
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

html ::-webkit-scrollbar {
  display: none;
}

::-webkit-scrollbar {
  display: unset;
}
</style>

<style scoped=true>
.main-body {
  /* min-width: 720px; */
  width: 100%;
  border-radius: 0px 2px 2px 0;
}
</style>
