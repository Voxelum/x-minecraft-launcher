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
      :text="t('failText', { url: errorUrl })"
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
        {{ t('refresh') }}
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
        {{ t('update') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>
<script lang="ts" setup>
import { Ref } from '@vue/composition-api'
import { InstanceIOServiceKey, InstanceUpdate } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { useColorTheme } from '../composables/colorTheme'
import { InstanceFileNode, provideFileNodes } from '../composables/instanceFiles'
import Hint from '/@/components/Hint.vue'
import { useI18n, useService, useServiceBusy } from '/@/composables'
import { basename } from '/@/util/basename'

const props = defineProps<{ shown: boolean }>()

const { fetchInstanceUpdate, applyInstanceFilesUpdate } = useService(InstanceIOServiceKey)
const checkingUpdate = useServiceBusy(InstanceIOServiceKey, 'fetchInstanceUpdate')
const applyingUpdate = useServiceBusy(InstanceIOServiceKey, 'applyInstanceFilesUpdate')
const currentUpdate = ref(undefined as undefined | InstanceUpdate)
const updateFiles = computed(() => currentUpdate.value ? currentUpdate.value.updates : [])
const { errorColor } = useColorTheme()
const errorUrl = ref('')
const { t } = useI18n()

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
      id: file.path,
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
  currentUpdate.value = await fetchInstanceUpdate().catch((e) => {
    hasError.value = true
    console.log(e)
    errorUrl.value = e.exception?.url
    return undefined
  })
}

async function update() {
  const enabled = new Set(...selected.value)
  const result = updateFiles.value.filter(f => enabled.has(f.file.path)).map(f => f.file)
  await applyInstanceFilesUpdate({ path: '', updates: result })
}

onMounted(check)

watch(() => props.shown, (opened) => {
  if (opened) {
    check()
  }
})
</script>

<i18n locale="en" lang="yaml">
failText: Fail to fetch update. {url}
update: Update
refresh: Refresh
</i18n>

<i18n locale="zh-CN" lang="yaml">
failText: 获取更新失败. {url}
update: 更新
refresh: 刷新
</i18n>
