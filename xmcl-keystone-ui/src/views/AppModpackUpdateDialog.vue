<template>
  <v-dialog
    v-model="isShown"
    width="500"
    :persistent="installing"
  >
    <v-card>
      <v-card-title class="text-lg font-bold">
        {{ t('modpackUpdateOrCreate.title') }}
      </v-card-title>
      <v-card-text class="select-none">
        {{ t('modpackUpdateOrCreate.description', { name: instanceName }) }}
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          variant="text"
          :disabled="installing"
          @click="isShown = false"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="installing"
          @click="onCreateNew"
        >
          <v-icon start>add</v-icon>
          {{ t('modpackUpdateOrCreate.createNew') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="text"
          :loading="installing"
          @click="onUpdate"
        >
          <v-icon start>update</v-icon>
          {{ t('modpackUpdateOrCreate.update') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { toRaw } from 'vue'
import { useDialog } from '@/composables/dialog'
import {
  ModpackUpdateDialogKey,
  ModpackUpdateDialogPayload,
  useModpackFinishInstall,
} from '@/composables/modpackInstaller'

const { t } = useI18n()
const finishModpackInstall = useModpackFinishInstall()

const payload = ref(undefined as ModpackUpdateDialogPayload | undefined)
const installing = ref(false)

const { isShown } = useDialog(
  ModpackUpdateDialogKey,
  (param) => {
    payload.value = param
    installing.value = false
  },
  () => {
    payload.value = undefined
    installing.value = false
  },
)

const instanceName = computed(() => payload.value?.instanceName ?? '')

async function run(instancePath?: string) {
  const p = payload.value
  if (!p) return
  installing.value = true
  try {
    const rawUpstream = p.upstream ? JSON.parse(JSON.stringify(toRaw(p.upstream))) : undefined
    await finishModpackInstall(p.modpackFile, p.icon, rawUpstream, instancePath)
    isShown.value = false
  } finally {
    installing.value = false
  }
}

const onUpdate = () => run(payload.value?.instancePath)
const onCreateNew = () => run(undefined)
</script>
