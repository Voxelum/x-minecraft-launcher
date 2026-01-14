<template>
  <section class="about">
    <SettingCard>
      <div>
        <v-card-title class="w-full flex mr-2 title">
          <v-img src="http://launcher/icons/logoDark" alt="XMCL Logo" max-width="64" class="mr-4"></v-img>
          <div>
            <a class="text-h5" href="https://www.xmcl.app">X Minecraft Launcher</a>
            <div class="flex justify-center items-center gap-2 pt-1">
              <a href="https://afdian.com/a/ci010" class="flex items-center justify-center">
                <img
                  height="24"
                  src="https://img.shields.io/badge/%E8%B5%9E%E5%8A%A9-%E7%88%B1%E5%8F%91%E7%94%B5-946ce6?style=flat&logo=data:image/png;base64,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&logoSize=auto&labelColor=106ac4" />
              </a>
              <a href="https://ko-fi.com/ci010" class="flex items-center justify-center">
                <img height="25" :src="kofi">
              </a>
            </div>
          </div>
          <v-spacer />
          <div>
            <div class="flex items-center justify-center flex-grow-0 gap-2">
              <v-icon color="primary">verified</v-icon>
              <div class="text-caption">MIT LICENSE</div>
            </div>
          </div>
        </v-card-title>

        <v-textarea filled readonly class="px-4" :value="debugInfo" />
      </div>

      <div class="select-none text-lg my-6 text-center flex justify-center"> 🧑‍💻 Contributors 🧑‍💻 </div>
      <div class="flex flex-wrap gap-1 justify-center overflow-auto py-4">
        <a
          v-for="c in contributors" :key="c.login"
          v-shared-tooltip="_ => c.login"
          :href="c.html_url"
          target="_blank"
        >
          <v-avatar size="40">
            <v-img :src="c.avatar_url"></v-img>
          </v-avatar>
        </a>
      </div>

      <div class="select-none text-lg my-6 text-center flex justify-center"> 😇 Sponsors 😇 </div>
      <div class="flex flex-col items-center gap-3 py-4">
        <div class="grid grid-cols-2 gap-4 w-full">
          <div class="flex flex-col items-center justify-center">
            <a href="https://signpath.io/" target="_blank" class="flex-grow w-full flex">
              <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 195 39"><g><path d="M 0 39 L 0 0 L 194.124 0 L 194.124 39 Z" fill="transparent"></path><path d="M 33.272 0 L 11.112 0 L 0 19.218 L 11.08 38.437 L 33.272 38.437 L 44.352 19.218 Z M 33.804 21.472 C 33.585 21.973 33.084 22.286 32.521 22.286 L 21.002 22.286 C 20.22 22.286 19.594 21.66 19.594 20.877 C 19.594 20.095 20.22 19.469 21.002 19.469 L 29.391 19.469 L 26.104 15.744 C 25.878 15.49 25.752 15.161 25.752 14.821 C 25.752 14.48 25.878 14.151 26.104 13.897 L 29.391 10.173 L 15.525 10.173 L 15.525 32.458 C 15.525 33.241 14.899 33.867 14.116 33.867 C 13.334 33.867 12.708 33.241 12.708 32.458 L 12.708 5.916 C 12.708 5.133 13.334 4.507 14.116 4.507 C 14.899 4.507 15.525 5.133 15.525 5.916 L 15.525 7.356 L 32.521 7.356 C 33.084 7.356 33.585 7.669 33.804 8.169 C 34.023 8.67 33.929 9.265 33.585 9.672 L 29.078 14.805 L 33.585 19.938 C 33.929 20.376 34.023 20.971 33.804 21.472 Z" fill="rgb(255,255,255)"></path><path d="M 56.747 25.416 C 59.032 27.231 61.755 28.295 64.666 28.295 C 67.514 28.295 69.518 27.294 69.518 25.04 C 69.518 23.099 68.266 22.317 66.012 21.472 L 62.381 20.157 C 59.063 18.936 56.528 17.152 56.528 13.052 C 56.528 8.67 60.347 6.26 64.948 6.26 C 67.765 6.26 70.3 6.98 72.303 8.294 L 72.303 12.645 C 70.237 11.049 67.953 9.953 65.042 9.953 C 62.506 9.953 60.66 10.924 60.66 12.958 C 60.66 14.773 61.849 15.525 63.915 16.244 L 67.953 17.716 C 71.865 19.124 73.649 21.346 73.649 24.946 C 73.649 29.485 69.799 32.02 64.697 32.02 C 61.38 32.02 58.531 31.049 56.779 29.829 Z" fill="rgb(255,255,255)"></path><path d="M 79.315 10.611 C 77.969 10.611 76.779 9.516 76.779 8.139 C 76.779 6.762 77.969 5.666 79.315 5.666 C 80.66 5.666 81.85 6.762 81.85 8.139 C 81.85 9.516 80.66 10.611 79.315 10.611 Z M 81.349 31.645 L 77.28 31.645 L 77.28 13.585 L 81.349 13.585 Z" fill="rgb(255,255,255)"></path><path d="M 97.657 29.861 C 96.843 30.831 95.121 31.739 93.118 31.739 C 87.797 31.739 84.792 27.294 84.792 22.474 C 84.792 17.654 87.797 13.209 93.118 13.209 C 95.153 13.209 96.843 14.117 97.657 15.087 L 97.657 13.616 L 101.726 13.616 L 101.726 30.174 C 101.726 36.747 96.718 39 92.461 39 C 90.051 39 87.922 38.406 86.451 37.467 L 86.451 33.147 C 88.329 34.806 90.176 35.432 92.461 35.432 C 95.34 35.432 97.657 33.711 97.657 30.487 Z M 97.657 18.906 C 96.968 17.685 95.497 16.746 93.807 16.746 C 90.677 16.746 88.893 19.156 88.893 22.443 C 88.893 25.729 90.677 28.139 93.807 28.139 C 95.528 28.139 96.968 27.2 97.657 25.98 Z" fill="rgb(255,255,255)"></path><path d="M 106.389 13.585 L 110.458 13.585 L 110.458 15.306 C 111.429 14.179 113.213 13.178 115.341 13.178 C 119.442 13.178 121.726 15.901 121.726 19.876 L 121.726 31.614 L 117.657 31.614 L 117.657 20.596 C 117.657 18.374 116.562 16.902 114.246 16.902 C 112.493 16.902 110.928 17.998 110.458 19.782 L 110.458 31.645 L 106.389 31.645 Z" fill="rgb(255,255,255)"></path><path d="M 130.803 22.316 L 130.803 31.612 L 126.578 31.612 L 126.578 6.666 L 136.218 6.666 C 141.383 6.666 144.763 9.358 144.763 14.522 C 144.763 19.593 141.383 22.316 136.218 22.316 Z M 136.155 10.328 L 130.834 10.328 L 130.834 18.654 L 136.155 18.654 C 139.098 18.654 140.6 16.901 140.6 14.522 C 140.569 12.05 139.066 10.328 136.155 10.328 Z" fill="rgb(255,255,255)"></path><path d="M 157.44 20.095 C 157.44 18.061 155.812 16.871 153.308 16.871 C 151.368 16.871 149.771 17.466 148.3 18.467 L 148.3 14.743 C 149.49 13.898 151.743 13.209 154.028 13.209 C 158.692 13.209 161.352 15.744 161.352 19.845 L 161.352 31.676 L 157.44 31.676 L 157.44 30.674 C 156.845 31.269 155.03 32.02 152.995 32.02 C 149.302 32.02 146.234 29.829 146.234 26.136 C 146.234 22.724 149.27 20.314 153.277 20.314 C 154.905 20.314 156.689 20.878 157.409 21.41 Z M 157.44 25.353 C 157.002 24.227 155.405 23.538 153.778 23.538 C 151.962 23.538 150.053 24.321 150.053 26.105 C 150.053 27.92 151.962 28.703 153.778 28.703 C 155.405 28.703 157.002 28.014 157.44 26.887 Z" fill="rgb(255,255,255)"></path><path d="M 171.744 31.644 L 167.675 31.644 L 167.675 16.964 L 164.013 16.964 L 164.013 13.584 L 167.675 13.584 L 167.675 8.764 L 171.744 8.764 L 171.744 13.615 L 175.813 13.615 L 175.813 16.964 L 171.744 16.964 Z" fill="rgb(255,255,255)"></path><path d="M 178.787 5.227 L 182.856 5.227 L 182.856 15.305 C 183.826 14.178 185.61 13.177 187.738 13.177 C 191.839 13.177 194.124 15.9 194.124 19.875 L 194.124 31.613 L 190.055 31.613 L 190.055 20.595 C 190.055 18.373 188.959 16.901 186.643 16.901 C 184.89 16.901 183.294 17.997 182.856 19.781 L 182.856 31.644 L 178.787 31.644 Z" fill="rgb(255,255,255)"></path></g></svg>
            </a>
            <div class="text-caption mb-4"> Free code signing on Windows provided by SignPath.io, certificate by
              SignPath Foundation </div>
          </div>

          <div class="flex flex-col items-center justify-center">
            <a href="https://deno.com/deploy" target="_blank" class="">
              <v-img src="https://deno.com/images/deno_logo_4.gif" max-width="120" contain class="mb-2"></v-img>
            </a>
            <div class="text-caption mb-4"> XMCL leverages Deno Deploy's hassle-free platform for serverless
              JavaScript
              applications </div>
          </div>

          <div class="flex flex-col items-center justify-center">
            <a href="https://bmcl.dev" target="_blank" class="">
              <v-img src="https://bmclapidoc.bangbang93.com/assets/favicon.ico?v=1742218388684" max-width="120"
                contain class="mb-2"></v-img>
            </a>
            <div class="text-caption mb-4"> BMCL API 给中国区用户提供了下载的便利 </div>
          </div>
        </div>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { kFlights } from '@/composables/flights'
import { useSWRVConfig } from '@/composables/swrvConfig'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import useSWRV from 'swrv'
import kofi from '../assets/kofi.webp'

const env = injection(kEnvironment)
const flights = injection(kFlights)

const debugInfo = computed(() => {
  return JSON.stringify({ ...env.value, flights }, null, 2)
})

const { t } = useI18n()
const version = computed(() => env.value?.version ?? '')

const config = useSWRVConfig()
const { data: contributors } = useSWRV<{ login: string; avatar_url: string; html_url: string }[]>('https://api.github.com/repos/voxelum/x-minecraft-launcher/contributors', (e) => 
  fetch(e).then(r => r.json()), config)

</script>
<style scoped>

</style>