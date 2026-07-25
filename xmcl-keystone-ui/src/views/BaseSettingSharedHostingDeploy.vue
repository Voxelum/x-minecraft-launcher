<template>
  <SettingCard title="Deploy to Shared Hosting" icon="cloud_upload">
    <div class="flex flex-col gap-3">
      <p class="text-body-2 opacity-70">
        Export this resolved modded instance as one reviewed bundle. Local worlds are never included;
        migrate a world explicitly after the deployment has been created.
      </p>
      <v-select
        v-model="serviceId"
        :items="services"
        item-title="serviceId"
        item-value="serviceId"
        label="Shared service"
        :loading="loadingServices"
        :disabled="loading || loadingServices"
        density="compact"
        hide-details
      />
      <v-alert
        v-if="error"
        type="error"
        density="compact"
      >
        {{ error }}
      </v-alert>
      <v-alert
        v-if="review"
        :type="review.preflight.compatible ? 'info' : 'error'"
        density="compact"
      >
        <div>
          Minecraft {{ review.metadata.minecraftVersion }} ·
          {{ review.metadata.loader.kind }} {{ review.metadata.loader.version }} ·
          {{ review.metadata.javaRequirement.component }} {{ review.metadata.javaRequirement.major }}
        </div>
        <div>
          {{ review.preflight.review.modCount }} mods, {{ review.preflight.review.modBytes }} mod bytes,
          {{ review.preflight.review.configDataBytes }} config/data bytes.
        </div>
        <ul v-if="review.preflight.warnings.length" class="mt-2">
          <li v-for="warning in review.preflight.warnings" :key="`${warning.code}:${warning.path}`">
            {{ warning.message }}{{ warning.path ? ` (${warning.path})` : '' }}
          </li>
        </ul>
      </v-alert>
      <v-checkbox
        v-if="review?.preflight.warnings.length"
        v-model="acknowledged"
        label="I reviewed the compatibility warnings."
        density="compact"
        hide-details
      />
      <div v-if="uploadProgress" class="text-body-2">
        <v-progress-linear
          color="green"
          :model-value="uploadPercent"
          rounded
        />
        Uploading {{ uploadPercent }}% ({{ uploadProgress.uploadedBytes }} / {{ uploadProgress.totalBytes }} bytes)
      </div>
      <div class="flex gap-2">
        <v-btn
          :loading="loading"
          :disabled="!serviceId"
          color="primary"
          variant="flat"
          @click="preview"
        >
          Review bundle
        </v-btn>
        <v-btn
          :loading="loading"
          :disabled="!canDeploy"
          color="green"
          variant="flat"
          @click="deploy"
        >
          Upload and compile
        </v-btn>
        <v-btn
          v-if="uploadId"
          :disabled="!loading"
          variant="text"
          @click="cancelUpload"
        >
          Cancel upload
        </v-btn>
      </div>
      <p v-if="deployment" class="text-body-2">
        Deployment {{ deployment.deploymentId }} is {{ deployment.status }}.
        The shared service remains unchanged until compilation and safe selection succeed.
      </p>
    </div>
  </SettingCard>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import {
  InstanceIOServiceKey,
  REVIEWED_SHARED_RUNTIME_CATALOG,
  SharedHostingDeploymentServiceKey,
  type SharedHostingBundlePreview,
  type SharedHostingDeployment,
  type SharedHostingServiceRecord,
} from '@xmcl/runtime-api'

const { instance, path } = injection(kInstance)
const { generateLaunchOptions } = injection(kInstanceLaunch)
const { install: installClient } = injection(kInstanceVersionInstall)
const { userProfile } = injection(kUserContext)
const {
  previewInstanceForSharedHosting,
  deployInstanceToSharedHosting,
} = useService(InstanceIOServiceKey)
const sharedHosting = useService(SharedHostingDeploymentServiceKey)
const {
  listSharedHostingServices,
  cancelSharedHostingBundleUpload,
} = sharedHosting

const serviceId = ref('')
const services = ref<SharedHostingServiceRecord[]>([])
const loadingServices = ref(false)
const loading = ref(false)
const acknowledged = ref(false)
const review = ref<SharedHostingBundlePreview>()
const launchOptions = shallowRef<Awaited<ReturnType<typeof generateLaunchOptions>>>()
const deployment = ref<SharedHostingDeployment>()
const error = ref('')
const uploadId = ref('')
const uploadProgress = ref<{ uploadedBytes: number; totalBytes: number }>()
const uploadPercent = computed(() => uploadProgress.value
  ? Math.min(100, Math.round(uploadProgress.value.uploadedBytes / uploadProgress.value.totalBytes * 100))
  : 0)

const canDeploy = computed(() =>
  Boolean(
    serviceId.value &&
    review.value?.preflight.compatible &&
    launchOptions.value &&
    (!review.value.preflight.warnings.length || acknowledged.value),
  ))

async function refreshServices() {
  loadingServices.value = true
  error.value = ''
  try {
    services.value = await listSharedHostingServices()
    if (!serviceId.value && services.value.length) serviceId.value = services.value[0].serviceId
  } catch {
    // Shared hosting remains fail-closed until its production route composition
    // is installed. Do not expose transport or storage details here.
    error.value = 'Shared hosting is not available for this account yet.'
  } finally {
    loadingServices.value = false
  }
}

async function preview() {
  loading.value = true
  error.value = ''
  deployment.value = undefined
  acknowledged.value = false
  try {
    const version = await installClient(instance.value.runtime)
    const generated = await generateLaunchOptions(
      path.value,
      userProfile.value,
      '',
      'client',
      { version },
      true,
    )
    launchOptions.value = generated
    review.value = await previewInstanceForSharedHosting({
      options: generated,
      instanceName: instance.value.name || 'Local instance',
      runtimeCatalog: REVIEWED_SHARED_RUNTIME_CATALOG,
    })
  } catch {
    error.value = 'The local instance could not be prepared for shared hosting.'
  } finally {
    loading.value = false
  }
}

async function deploy() {
  if (!canDeploy.value || !launchOptions.value) return
  loading.value = true
  error.value = ''
  uploadProgress.value = undefined
  const idempotencyKey = crypto.randomUUID()
  uploadId.value = idempotencyKey
  try {
    deployment.value = await deployInstanceToSharedHosting({
      options: launchOptions.value,
      instanceName: instance.value.name || 'Local instance',
      serviceId: serviceId.value,
      runtimeCatalog: REVIEWED_SHARED_RUNTIME_CATALOG,
      acknowledgeWarnings: true,
      idempotencyKey,
    })
  } catch {
    error.value = 'The bundle upload or compiler request did not complete. Current service content was not changed.'
  } finally {
    loading.value = false
    uploadId.value = ''
  }
}

async function cancelUpload() {
  if (!uploadId.value) return
  await cancelSharedHostingBundleUpload(uploadId.value)
}

function onUploadProgress(progress: {
  idempotencyKey: string
  uploadedBytes: number
  totalBytes: number
}) {
  if (progress.idempotencyKey === uploadId.value) {
    uploadProgress.value = {
      uploadedBytes: progress.uploadedBytes,
      totalBytes: progress.totalBytes,
    }
  }
}

onMounted(() => {
  sharedHosting.on('shared-hosting-bundle-upload-progress', onUploadProgress)
  void refreshServices()
})
onUnmounted(() => {
  sharedHosting.removeListener('shared-hosting-bundle-upload-progress', onUploadProgress)
})
</script>
