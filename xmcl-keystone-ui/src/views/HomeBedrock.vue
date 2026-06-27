<template>
  <div
    data-testid="home-bedrock"
    class="mx-3 flex flex-col items-center justify-center gap-4 py-12 text-center"
  >
    <v-icon size="64" color="primary">
      view_in_ar
    </v-icon>
    <div class="text-h6 font-bold">
      {{ t('instances.editionBedrock') }}
    </div>

    <!-- Not supported on this platform -->
    <template v-if="!supported">
      <v-alert
        data-testid="home-bedrock-unsupported"
        type="info"
        variant="tonal"
        rounded="lg"
        class="max-w-[480px]"
      >
        {{ t('instances.editionBedrockWindowsOnly') }}
      </v-alert>
    </template>

    <!-- Supported -->
    <template v-else>
      <!-- Requires a Minecraft license on the signed-in Microsoft account -->
      <v-alert
        v-if="!hasMinecraftLicense"
        data-testid="home-bedrock-license-required"
        type="info"
        variant="tonal"
        rounded="lg"
        class="max-w-[480px]"
      >
        {{ t('bedrock.licenseRequired') }}
      </v-alert>

      <template v-else>
        <div
          class="max-w-[480px] text-body-2"
          style="color: rgba(var(--v-theme-on-surface), 0.7);"
        >
          {{ t('bedrock.description') }}
        </div>

        <v-progress-circular
          v-if="loading"
          indeterminate
          color="primary"
        />

        <template v-else>
          <v-chip
            v-if="installation.installed"
            data-testid="home-bedrock-installed"
            color="primary"
            variant="flat"
            label
            prepend-icon="check_circle"
          >
            {{ t('bedrock.installed', { version: installation.version || '—' }) }}
          </v-chip>

          <div class="flex items-center gap-3">
            <v-btn
              v-if="!installation.installed"
              data-testid="home-bedrock-install"
              color="primary"
              variant="flat"
              rounded="pill"
              :loading="installing"
              @click="onInstall"
            >
              <v-icon start>get_app</v-icon>
              {{ t('bedrock.install') }}
            </v-btn>
            <v-btn
              data-testid="home-bedrock-refresh"
              variant="text"
              rounded="pill"
              @click="refresh"
            >
              <v-icon start>refresh</v-icon>
              {{ t('bedrock.refresh') }}
            </v-btn>
          </div>

          <div
            v-if="installation.installed"
            class="text-caption"
            style="color: rgba(var(--v-theme-on-surface), 0.6);"
          >
            {{ t('bedrock.launchHint') }}
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { useNotifier } from '@/composables/notifier'
import { BedrockInstallation, BedrockServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
const { isSupported, getInstallation, install } = useService(BedrockServiceKey)
const { hasMinecraftLicense } = useHasMinecraftLicense()
const { notify } = useNotifier()

const supported = ref(false)
const loading = ref(true)
const installing = ref(false)
const installation = ref<BedrockInstallation>({ installed: false, version: '', packageFullName: '' })

async function refresh() {
  loading.value = true
  try {
    supported.value = await isSupported()
    if (supported.value) {
      installation.value = await getInstallation()
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function onInstall() {
  installing.value = true
  try {
    await install()
    await refresh()
  } catch (e) {
    notify({ title: t('bedrock.installFailed'), level: 'error' })
    console.error(e)
  } finally {
    installing.value = false
  }
}

onMounted(refresh)
</script>
