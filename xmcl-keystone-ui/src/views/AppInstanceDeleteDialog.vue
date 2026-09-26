<template>
  <v-dialog
    v-model="isShown"
    :persistent="false"
    :width="440"
  >
    <v-card class="rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      <v-card-item class="pb-2">
        <template #prepend>
          <div class="w-10 h-10 rounded-xl bg-error/15 text-error flex items-center justify-center mr-2 shadow-sm">
            <v-icon size="22">delete_forever</v-icon>
          </div>
        </template>
        <v-card-title class="text-base font-bold">
          {{ t('instance.delete') }}
        </v-card-title>
      </v-card-item>

      <v-card-text class="pt-2">
        <div class="text-sm opacity-80 mb-3">
          {{ isBedrock ? t('instance.deleteHintBedrock') : t('instance.deleteHint') }}
        </div>

        <div v-if="name || path" class="p-3 rounded-xl bg-white/5 border border-white/5 mb-2">
          <div v-if="name" class="font-semibold text-sm text-white/90 truncate">
            {{ name }}
          </div>
          <div v-if="path" class="text-xs text-white/50 break-all select-all font-mono mt-0.5">
            {{ path }}
          </div>
        </div>

        <v-checkbox
          v-if="!isBedrock"
          v-model="deleteFiles"
          :label="t('instance.deleteFile')"
          density="comfortable"
          hide-details
          color="error"
        />
      </v-card-text>

      <v-divider class="border-white/5" />
      <v-card-actions class="px-5 py-3">
        <v-btn
          variant="text"
          rounded="pill"
          @click="isShown = false"
        >
          {{ t('delete.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="error"
          variant="flat"
          rounded="pill"
          class="font-semibold px-4"
          :loading="deleting"
          @click="doDelete"
        >
          <v-icon start size="18">
            delete
          </v-icon>
          {{ t('delete.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { useNotifier } from '@/composables/notifier'

const { t } = useI18n()
const name = ref('')
const path = ref('')
const deleteFiles = ref(true)
const isBedrock = ref(false)
const deleting = ref(false)

const { parameter, isShown } = useDialog('delete-instance')
const { instances, selectedInstance, remove } = injection(kInstances)
const instanceCtx = inject(kInstance, undefined)

function resolveTarget() {
  const p = parameter.value
  let targetPath = ''
  let targetName = ''
  let targetBedrock = false

  if (typeof p === 'string' && p) {
    targetPath = p
  } else if (p && typeof p === 'object') {
    targetPath = (p as any).path || (p as any).instancePath || (p as any).instance || ''
    targetName = (p as any).name || (p as any).instanceName || ''
    targetBedrock = (p as any).edition === 'bedrock'
  }

  // Fallback to currently selected instance if path is not specified
  if (!targetPath) {
    targetPath = instanceCtx?.path.value || selectedInstance.value || ''
  }

  // Resolve instance metadata from instances list
  const inst = instances.value.find((i) => i.path === targetPath) || (instanceCtx?.instance.value?.path === targetPath ? instanceCtx.instance.value : undefined)
  if (inst) {
    if (!targetName) {
      targetName = inst.name || (inst.runtime?.minecraft ? `Minecraft ${inst.runtime.minecraft}` : '')
    }
    if (inst.edition === 'bedrock') {
      targetBedrock = true
    }
  }

  path.value = targetPath
  name.value = targetName || (targetPath ? targetPath.split(/[/\\]/).pop() || '' : '')
  isBedrock.value = targetBedrock
  if (targetBedrock) {
    deleteFiles.value = true
  }
}

watch([isShown, parameter], ([shown]) => {
  if (shown) {
    resolveTarget()
  }
}, { immediate: true })

const router = useRouter()
const { notify } = useNotifier()

const doDelete = async () => {
  if (deleting.value) return
  resolveTarget()
  const instancePath = path.value || selectedInstance.value
  if (!instancePath) {
    notify({
      title: t('instance.deleteFailed'),
      level: 'error',
    })
    isShown.value = false
    return
  }

  deleting.value = true
  const isSelectedInstance = selectedInstance.value === instancePath
  try {
    const isLastInstance = await remove(instancePath, deleteFiles.value)
    if (isLastInstance) {
      await router.push('/me')
    } else if (router.currentRoute.value.fullPath !== '/' && isSelectedInstance) {
      await router.push('/')
    }
    isShown.value = false
  } catch (e) {
    console.error('Failed to delete instance:', e)
    if (e instanceof Error && 'code' in e && e.code === 'EBUSY') {
      notify({
        title: t('instance.deleteFailed'),
        body: t('instance.deleteFailedPermission'),
        level: 'error',
      })
    } else {
      notify({
        title: t('instance.deleteFailed'),
        body: e instanceof Error ? e.message : String(e),
        level: 'error',
      })
    }
  } finally {
    deleting.value = false
  }
}
</script>
