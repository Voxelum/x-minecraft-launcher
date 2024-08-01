<template>
  <v-dialog
    v-model="isShown"
    width="700"
  >
    <v-card>
      <v-toolbar
        color="green en"
      >
        <v-toolbar-title>
          <template v-if="sharing">
            {{ t('AppShareInstanceDialog.shareTitle') }}
          </template>
          <template v-else>
            {{ t('AppShareInstanceDialog.downloadTitle') }}
          </template>
        </v-toolbar-title>
      </v-toolbar>

      <v-container
        grid-list-sm
        class="visible-scroll max-h-[70vh]"
        style="overflow: auto;"
      >
        <v-card-text>
          <template v-if="sharing">
            {{ t('AppShareInstanceDialog.description') }}
          </template>
          <template v-else>
            {{ t('AppShareInstanceDialog.downloadDescription', { name }) }}
          </template>
        </v-card-text>
        <v-card-text v-if="!sharing">
          {{ t('AppShareInstanceDialog.alterDownloadDescription') }}
        </v-card-text>
        <v-subheader>{{ t('AppShareInstanceDialog.baseInfo') }}</v-subheader>
        <div class="flex flex-col p-5 ">
          <div class="flex gap-5">
            <v-text-field
              flat
              :value="minecraft"
              label="Minecraft"
              dense
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.minecraft"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="forge"
              flat
              dense
              label="Forge"
              :value="forge"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.forge"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="fabricLoader"
              flat
              dense
              label="Fabric"
              :value="fabricLoader"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.fabric"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="fabricLoader"
              flat
              dense
              label="Fabric"
              :value="fabricLoader"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.fabric"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="quiltLoader"
              flat
              dense
              label="Fabric"
              :value="quiltLoader"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.quilt"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="neoForged"
              flat
              dense
              label="Fabric"
              :value="neoForged"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.neoForged"
                  width="32"
                >
              </template>
            </v-text-field>
          </div>
          <div class="flex gap-5">
            <v-text-field
              v-if="vmOptions.length > 0"
              :value="vmOptions"
              readonly
              :label="t('instance.vmOptions')"
            />
          </div>
          <div class="flex gap-5">
            <v-text-field
              v-if="mcOptions.length > 0"
              :value="mcOptions"
              readonly
              :label="t('instance.mcOptions')"
            />
          </div>
        </div>
        <v-subheader>
          <template v-if="sharing">
            {{ t('AppShareInstanceDialog.filesToShare') }}
          </template>
          <template v-else>
            {{ t('AppShareInstanceDialog.filesToDownload') }}
          </template>
        </v-subheader>

        <div v-if="loading">
          <v-skeleton-loader
            class="flex flex-col gap-3 overflow-auto"
            type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
          />
        </div>
        <InstanceManifestFileTree
          v-else
          v-model="selected"
          selectable
          multiple
        />
      </v-container>
      <v-card-actions v-if="sharing">
        <v-btn
          text
          color="error"
          @click="onCancelShare"
        >
          <v-icon left>
            delete
          </v-icon>
          {{ t('AppShareInstanceDialog.cancelShare') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          color="primary"
          @click="onShareInstance"
        >
          <v-icon left>
            share
          </v-icon>
          {{ t('AppShareInstanceDialog.share') }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else>
        <v-btn
          text
          @click="isShown = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          @click="onCreateInstance"
        >
          <v-icon left>
            add
          </v-icon>
          {{ t('instances.add') }}
        </v-btn>
        <v-btn
          text
          color="primary"
          @click="onDownloadInstance"
        >
          <v-icon left>
            download
          </v-icon>
          {{ t('download') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { InstanceInstallServiceKey, InstanceManifest, InstanceManifestServiceKey, InstanceServiceKey, PeerServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { useDialog } from '../composables/dialog'
import { useNotifier } from '../composables/notifier'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { injection } from '@/util/inject'
import { kInstance } from '@/composables/instance'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { BuiltinImages } from '../constant'

const { isShown, parameter } = useDialog('share-instance')

const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const { shareInstance } = useService(PeerServiceKey)
const { path, name } = injection(kInstance)
const { t } = useI18n()
const { subscribeTask } = useNotifier()

const sharing = computed(() => isShown.value && !parameter.value)
/**
 * The sharing user name. Only for sharing == false
 */
const currentUser = ref('')
const manifest: Ref<InstanceManifest | undefined> = ref(undefined)
const selected = ref([] as string[])

provideFileNodes(useInstanceFileNodesFromLocal(computed(() => manifest.value?.files || [])))

const minecraft = computed(() => manifest.value?.runtime.minecraft)
const forge = computed(() => manifest.value?.runtime.forge)
const fabricLoader = computed(() => manifest.value?.runtime.fabricLoader)
const quiltLoader = computed(() => manifest.value?.runtime.quiltLoader)
const neoForged = computed(() => manifest.value?.runtime.neoForged)
const optifine = computed(() => manifest.value?.runtime.optifine)
const mcOptions = computed(() => manifest.value?.mcOptions || [])
const vmOptions = computed(() => manifest.value?.vmOptions || [])
const loading = ref(false)

const onCancelShare = () => {
  shareInstance({ manifest: undefined, instancePath: path.value })
  isShown.value = false
}

const onShareInstance = () => {
  if (manifest.value) {
    const man = { ...manifest.value }
    const allow = new Set(selected.value)
    man.files = man.files.filter(f => allow.has(f.path))
    subscribeTask(shareInstance({ manifest: man, instancePath: path.value }), t('AppShareInstanceDialog.shareNotifyTitle'))
    isShown.value = false
  }
}

const onDownloadInstance = () => {
  if (manifest.value) {
    const man = manifest.value
    let files = man.files
    const allow = new Set(selected.value)
    files = files.filter(f => allow.has(f.path))

    subscribeTask(installInstanceFiles({
      path: path.value,
      files,
    }), t('AppShareInstanceDialog.downloadNotifyTitle', { user: currentUser.value }))

    isShown.value = false
  }
}

const { show } = useDialog(AddInstanceDialogKey)
const onCreateInstance = () => {
  if (manifest.value) {
    show({
      type: 'manifest',
      manifest: manifest.value,
    })
  }
}

watch(isShown, async (shown) => {
  if (shown) {
    windowController.focus()
    if (parameter.value) {
      manifest.value = parameter.value as any
    } else {
      loading.value = true
      manifest.value = await getInstanceManifest({ path: path.value, hashes: ['sha1'] }).finally(() => { loading.value = false })
    }
  }
})
</script>
