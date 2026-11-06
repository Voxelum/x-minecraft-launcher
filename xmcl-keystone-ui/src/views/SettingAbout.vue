<template>
  <section class="about">
    <SettingCard>
      <div class="pa-4">
        <!-- Logo & Header info -->
        <div class="d-flex align-center flex-wrap gap-4 mb-6">
          <v-img
            :src="logo"
            alt="Vardrynn logo"
            width="64"
            height="64"
            class="mr-4 rounded-lg flex-grow-0 flex-shrink-0"
          ></v-img>
          <div>
            <div class="text-h5 font-weight-bold">Vardrynn Launcher</div>
            <div class="text-caption opacity-70">
              Built on <a :href="UPSTREAM_PROJECT_URL" target="_blank">XMCL</a> by Voxelum and contributors.
              Support the upstream author on
              <a href="https://afdian.com/a/ci010" target="_blank">Afdian</a> or
              <a href="https://ko-fi.com/ci010" target="_blank">Ko-fi</a>.
            </div>
          </div>
          <v-spacer />
          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="small">verified</v-icon>
            <div class="text-caption font-weight-medium">{{ t('setting.aboutLicense') }}</div>
          </div>
        </div>
        <div class="text-caption opacity-70 mb-6">
          NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
        </div>

        <div class="text-caption mb-6" data-testid="vardrynn-service-status">
          {{ t('setting.vardrynnService.label') }}: {{ t(`setting.vardrynnService.${serviceStatus}`) }}
        </div>

        <!-- Debug Info Box -->
        <div class="mb-8">
          <div class="text-subtitle-2 font-weight-bold mb-2 opacity-80">
            {{ t('setting.about') }}
          </div>
          <pre
            class="debug-info-code pa-4 text-caption font-mono"
          ><code>{{ debugInfo }}</code></pre>
        </div>

        <v-divider class="my-6 opacity-20" />

        <!-- Sponsors Section -->
        <div>
          <h3 :id="sponsorsHeadingId" class="text-subtitle-1 font-weight-bold text-center mb-6">
            {{ t('setting.aboutSponsors') }}
          </h3>
          <div
            class="grid grid-cols-1 md:grid-cols-3 gap-6"
            role="group"
            :aria-labelledby="sponsorsHeadingId"
          >
            <!-- SignPath -->
            <div class="sponsor-card d-flex flex-column align-center text-center pa-4">
              <a
                href="https://signpath.io/"
                target="_blank"
                class="sponsor-logo-link mb-3"
                aria-label="SignPath"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 195 39" class="sponsor-svg">
                  <g>
                    <path d="M 0 39 L 0 0 L 194.124 0 L 194.124 39 Z" fill="transparent"></path>
                    <path
                      d="M 33.272 0 L 11.112 0 L 0 19.218 L 11.08 38.437 L 33.272 38.437 L 44.352 19.218 Z M 33.804 21.472 C 33.585 21.973 33.084 22.286 32.521 22.286 L 21.002 22.286 C 20.22 22.286 19.594 21.66 19.594 20.877 C 19.594 20.095 20.22 19.469 21.002 19.469 L 29.391 19.469 L 26.104 15.744 C 25.878 15.49 25.752 15.161 25.752 14.821 C 25.752 14.48 25.878 14.151 26.104 13.897 L 29.391 10.173 L 15.525 10.173 L 15.525 32.458 C 15.525 33.241 14.899 33.867 14.116 33.867 C 13.334 33.867 12.708 33.241 12.708 32.458 L 12.708 5.916 C 12.708 5.133 13.334 4.507 14.116 4.507 C 14.899 4.507 15.525 5.133 15.525 5.916 L 15.525 7.356 L 32.521 7.356 C 33.084 7.356 33.585 7.669 33.804 8.169 C 34.023 8.67 33.929 9.265 33.585 9.672 L 29.078 14.805 L 33.585 19.938 C 33.929 20.376 34.023 20.971 33.804 21.472 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 56.747 25.416 C 59.032 27.231 61.755 28.295 64.666 28.295 C 67.514 28.295 69.518 27.294 69.518 25.04 C 69.518 23.099 68.266 22.317 66.012 21.472 L 62.381 20.157 C 59.063 18.936 56.528 17.152 56.528 13.052 C 56.528 8.67 60.347 6.26 64.948 6.26 C 67.765 6.26 70.3 6.98 72.303 8.294 L 72.303 12.645 C 70.237 11.049 67.953 9.953 65.042 9.953 C 62.506 9.953 60.66 10.924 60.66 12.958 C 60.66 14.773 61.849 15.525 63.915 16.244 L 67.953 17.716 C 71.865 19.124 73.649 21.346 73.649 24.946 C 73.649 29.485 69.799 32.02 64.697 32.02 C 61.38 32.02 58.531 31.049 56.779 29.829 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 79.315 10.611 C 77.969 10.611 76.779 9.516 76.779 8.139 C 76.779 6.762 77.969 5.666 79.315 5.666 C 80.66 5.666 81.85 6.762 81.85 8.139 C 81.85 9.516 80.66 10.611 79.315 10.611 Z M 81.349 31.645 L 77.28 31.645 L 77.28 13.585 L 81.349 13.585 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 97.657 29.861 C 96.843 30.831 95.121 31.739 93.118 31.739 C 87.797 31.739 84.792 27.294 84.792 22.474 C 84.792 17.654 87.797 13.209 93.118 13.209 C 95.153 13.209 96.843 14.117 97.657 15.087 L 97.657 13.616 L 101.726 13.616 L 101.726 30.174 C 101.726 36.747 96.718 39 92.461 39 C 90.051 39 87.922 38.406 86.451 37.467 L 86.451 33.147 C 88.329 34.806 90.176 35.432 92.461 35.432 C 95.34 35.432 97.657 33.711 97.657 30.487 Z M 97.657 18.906 C 96.968 17.685 95.497 16.746 93.807 16.746 C 90.677 16.746 88.893 19.156 88.893 22.443 C 88.893 25.729 90.677 28.139 93.807 28.139 C 95.528 28.139 96.968 27.2 97.657 25.98 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 106.389 13.585 L 110.458 13.585 L 110.458 15.306 C 111.429 14.179 113.213 13.178 115.341 13.178 C 119.442 13.178 121.726 15.901 121.726 19.876 L 121.726 31.614 L 117.657 31.614 L 117.657 20.596 C 117.657 18.374 116.562 16.902 114.246 16.902 C 112.493 16.902 110.928 17.998 110.458 19.782 L 110.458 31.645 L 106.389 31.645 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 130.803 22.316 L 130.803 31.612 L 126.578 31.612 L 126.578 6.666 L 136.218 6.666 C 141.383 6.666 144.763 9.358 144.763 14.522 C 144.763 19.593 141.383 22.316 136.218 22.316 Z M 136.155 10.328 L 130.834 10.328 L 130.834 18.654 L 136.155 18.654 C 139.098 18.654 140.6 16.901 140.6 14.522 C 140.569 12.05 139.066 10.328 136.155 10.328 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 157.44 20.095 C 157.44 18.061 155.812 16.871 153.308 16.871 C 151.368 16.871 149.771 17.466 148.3 18.467 L 148.3 14.743 C 149.49 13.898 151.743 13.209 154.028 13.209 C 158.692 13.209 161.352 15.744 161.352 19.845 L 161.352 31.676 L 157.44 31.676 L 157.44 30.674 C 156.845 31.269 155.03 32.02 152.995 32.02 C 149.302 32.02 146.234 29.829 146.234 26.136 C 146.234 22.724 149.27 20.314 153.277 20.314 C 154.905 20.314 156.689 20.878 157.409 21.41 Z M 157.44 25.353 C 157.002 24.227 155.405 23.538 153.778 23.538 C 151.962 23.538 150.053 24.321 150.053 26.105 C 150.053 27.92 151.962 28.703 153.778 28.703 C 155.405 28.703 157.002 28.014 157.44 26.887 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 171.744 31.644 L 167.675 31.644 L 167.675 16.964 L 164.013 16.964 L 164.013 13.584 L 167.675 13.584 L 167.675 8.764 L 171.744 8.764 L 171.744 13.615 L 175.813 13.615 L 175.813 16.964 L 171.744 16.964 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      d="M 178.787 5.227 L 182.856 5.227 L 182.856 15.305 C 183.826 14.178 185.61 13.177 187.738 13.177 C 191.839 13.177 194.124 15.9 194.124 19.875 L 194.124 31.613 L 190.055 31.613 L 190.055 20.595 C 190.055 18.373 188.959 16.901 186.643 16.901 C 184.89 16.901 183.294 17.997 182.856 19.781 L 182.856 31.644 L 178.787 31.644 Z"
                      fill="currentColor"
                    ></path>
                  </g>
                </svg>
              </a>
              <div class="text-caption mt-1 opacity-80">{{ t('setting.aboutLicenseInfo') }}</div>
            </div>

            <!-- Deno -->
            <div class="sponsor-card d-flex flex-column align-center text-center pa-4">
              <a
                href="https://deno.com/deploy"
                target="_blank"
                class="sponsor-logo-link mb-3"
                aria-label="Deno Deploy"
              >
                Deno Deploy
              </a>
              <div class="text-caption mt-1 opacity-80">
                {{ t('setting.aboutDenoDescription') }}
              </div>
            </div>

            <!-- BMCLAPI -->
            <div class="sponsor-card d-flex flex-column align-center text-center pa-4">
              <a
                href="https://bmcl.dev"
                target="_blank"
                class="sponsor-logo-link mb-3"
                aria-label="BMCLAPI"
              >
                BMCLAPI
              </a>
              <div class="text-caption mt-1 opacity-80">
                {{ t('setting.aboutBmclDescription') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BaseServiceKey, UPSTREAM_PROJECT_URL, type VardrynnServiceState } from '@xmcl/runtime-api'
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { kFlights } from '@/composables/flights'
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { useId } from 'vue'
import logo from '../assets/vardrynn-mark.png'

const env = injection(kEnvironment)
const flights = injection(kFlights)

const sponsorsHeadingId = useId()

const debugInfo = computed(() => {
  return JSON.stringify({ ...env.value, flights }, null, 2)
})

const { t } = useI18n()
const version = computed(() => env.value?.version ?? '')

const { getVardrynnServiceStatus } = useService(BaseServiceKey)
const serviceStatus = ref<VardrynnServiceState | 'checking'>('checking')
onMounted(async () => {
  serviceStatus.value = await getVardrynnServiceStatus()
    .then(status => status.state, () => 'unreachable' as const)
})

</script>

<style scoped>
.debug-info-code {
  background: rgba(0, 0, 0, 0.25);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
  color: rgba(var(--v-theme-on-surface), 0.85);
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.contributor-avatar {
  transition: transform 0.2s;
}
.contributor-avatar:hover {
  transform: scale(1.15) translateY(-2px);
  z-index: 1;
}

.sponsor-card {
  background: rgba(var(--v-theme-surface), 0.3);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
  transition: all 0.2s ease;
  min-height: 120px;
  justify-content: flex-start;
}
.sponsor-card:hover {
  background: rgba(var(--v-theme-surface), 0.5);
  border-color: rgba(var(--v-theme-primary), 0.3);
  transform: translateY(-2px);
}

.sponsor-logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 100%;
}

.sponsor-svg {
  height: 24px;
  max-width: 100%;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

:deep(.v-img__img) {
  object-fit: contain;
}
</style>
