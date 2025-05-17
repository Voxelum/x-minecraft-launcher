<template>
  <section class="mb-5 mt-2 about mx-6">
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-header>
          {{ t('setting.about') }}
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-card flat class="mb-6 card">
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

              <!-- display env.env, gfw.gfw -->

              <v-textarea filled readonly class="px-4" :value="debugInfo" />
            </div>


            <v-card-text class="contributors">
              <v-subheader> 🧑‍💻 Contributors </v-subheader>
              <a href="https://github.com/voxelum/x-minecraft-launcher/graphs/contributors" class="overflow-hidden">
                <img src="https://contrib.rocks/image?repo=voxelum/x-minecraft-launcher" />
              </a>
            </v-card-text>

            <v-card-text class="sponsors flex flex-col items-center gap-3">
              <span class="headline"> 😇 SPONSORS 😇 </span>
              <v-divider class="w-full h-[1px]" />
              <div class="grid grid-cols-2 w-full">
                <div class="flex flex-col items-center justify-center">
                  <a href="https://signpath.io/" target="_blank" class="flex-grow">
                    <v-img
                      src="https://github.com/DGP-Studio/Snap.Hutao/assets/10614984/73ae8b90-f3c7-4033-b2b7-f4126331ce66"
                      contain class="mb-2"></v-img>
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
            </v-card-text>
          </v-card>
        </v-expansion-panel-content>

      </v-expansion-panel>
    </v-expansion-panels>
  </section>
</template>

<script lang="ts" setup>
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import kofi from '../assets/kofi.webp'
import { kFlights } from '@/composables/flights'

const env = injection(kEnvironment)
const flights = injection(kFlights)

const debugInfo = computed(() => {
  return JSON.stringify({ ...env.value, flights }, null, 2)
})

const { t } = useI18n()
const version = computed(() => env.value?.version ?? '')
</script>
<style scoped>

@media (min-width: 1660px) {
  .about {
    grid-column: span 2 / span 2;
  }

  .card {
    gap: 2rem;
    @apply grid grid-cols-2;
  }

  .sponsors {
    @apply col-span-2;
  }
}
</style>