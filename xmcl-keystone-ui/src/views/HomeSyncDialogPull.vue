<template>
  <div>
    <v-skeleton-loader
      v-if="checkingUpdate"
      type="list-item-avatar-three-line,list-item-avatar-three-line,list-item-avatar-three-line"
    />
    <InstanceManifestFileTree
      v-model="selected"
      selectable
    />
    <Hint
      v-if="hasError"
      :text="t('HomeSyncDialogPull.failText', { url: errorUrl })"
      :color="errorColor"
      class="h-40vh"
      :size="70"
      icon="warning"
    />
    <v-card-actions>
      <v-spacer />
      <v-btn
        :loading="checkingUpdate"
        text
        @click="check"
      >
        <v-icon left>
          refresh
        </v-icon>
        {{ t('HomeSyncDialogPull.refresh') }}
      </v-btn>
      <v-btn
        text
        :disabled="hasError"
        :loading="applyingUpdate"
        color="primary"
        @click="update"
      >
        <v-icon left>
          download
        </v-icon>
        {{ t('HomeSyncDialogPull.update') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>
<script lang="ts" setup>
import { Ref } from 'vue'
import { InstanceInstallServiceKey, InstanceUpdate, XUpdateServiceKey } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import Hint from '@/components/Hint.vue'
import { useService, useServiceBusy } from '@/composables'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { kInstance } from '@/composables/instance'
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { kTheme } from '@/composables/theme'

const props = defineProps<{ shown: boolean }>()

const { fetchInstanceUpdate } = useService(XUpdateServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const checkingUpdate = useServiceBusy(XUpdateServiceKey, 'fetchInstanceUpdate')
const applyingUpdate = useServiceBusy(InstanceInstallServiceKey, 'installInstanceFiles')
const currentUpdate = ref(undefined as undefined | InstanceUpdate)
const updateFiles = computed(() => currentUpdate.value ? currentUpdate.value.updates : [])
const { errorColor } = injection(kTheme)
const errorUrl = ref('')
const { t } = useI18n()
const { path } = injection(kInstance)

const selected = ref([] as string[])
const hasError = ref(false)

interface UpdateData {

}

function useInstanceFileNodesFromUpdate(updates: Ref<InstanceUpdate['updates']>) {
  function getChoices(operation: 'update' | 'add') {
    return [{
      value: operation,
      text: operation,
    }]
  }
  function getFileNode({ operation, file }: InstanceUpdate['updates'][number]): InstanceFileNode<UpdateData> {
    return reactive({
      name: basename(file.path),
      path: file.path,
      size: 0,
      data: {
        operation,
      },
    })
  }
  return computed(() => updates.value.map(getFileNode))
}

provideFileNodes(useInstanceFileNodesFromUpdate(updateFiles))

async function check() {
  hasError.value = false
  currentUpdate.value = await fetchInstanceUpdate(path.value).catch((e) => {
    hasError.value = true
    console.log(e)
    errorUrl.value = e.exception?.url
    return undefined
  })
}

async function update() {
  const enabled = new Set(...selected.value)
  const result = updateFiles.value.filter(f => enabled.has(f.file.path)).map(f => f.file)
  await installInstanceFiles({ files: result, path: path.value })
}

onMounted(check)

watch(() => props.shown, (opened) => {
  if (opened) {
    check()
  }
})
</script>
