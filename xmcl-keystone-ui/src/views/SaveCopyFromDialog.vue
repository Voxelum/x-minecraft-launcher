<template>
  <v-dialog
    :value="value"
    width="500"
    persistent
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ t('save.copyFrom.title') }}
      </v-card-title>
      <v-card-text>
        {{ t('save.copyFrom.description') }}
      </v-card-text>

      <v-alert
        :value="error !== null"
        type="error"
      >
        {{ error }}
      </v-alert>

      <v-list two-line>
        <v-subheader v-if="resourcesSave.length">
          {{ t('save.copyFrom.fromResource') }}
        </v-subheader>

        <v-list-item
          v-for="(s, i) in resourcesSave"
          :key="s.hash"
        >
          <v-list-item-action>
            <v-checkbox v-model="resourcesCopyFrom[i]" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title> {{ s.name }} </v-list-item-title>
            <v-list-item-subtitle> {{ t('save.copyFrom.from', { src: s.metadata.curseforge ? 'curseforge' : 'resources' }) }} </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>

        <v-subheader v-if="loadedProfileSaves.length !== 0">
          {{ t('save.copyFrom.fromProfile') }}
        </v-subheader>

        <v-progress-circular
          v-if="loadedProfileSaves.length === 0 && loadingSaves"
          indeterminate
        />
        <v-list-item
          v-for="(s, i) in loadedProfileSaves"
          :key="s.path"
        >
          <v-list-item-action>
            <v-checkbox v-model="profilesCopyFrom[i]" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title> {{ s.name }} </v-list-item-title>
            <v-list-item-subtitle> {{ t('save.copyFrom.from', {src: s.instanceName}) }} </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="working"
          color="error"
          text
          @click="$emit('input', false)"
        >
          {{ t('save.copyFrom.cancel') }}
        </v-btn>
        <v-btn
          :disabled="nothingSelected"
          :loading="working"
          color="primary"
          text
          @click="startImport"
        >
          {{ t('save.copyFrom.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceSave, InstanceSavesServiceKey, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'

const props = withDefaults(defineProps<{
  value: boolean
}>(), {
  value: false,
})
const emit = defineEmits(['input'])
const { t } = useI18n()

const loadedProfileSaves = ref([] as Array<InstanceSave>)
const profilesCopyFrom = ref([] as boolean[])
const resourcesCopyFrom = ref([] as boolean[])
const error = ref(undefined as any)
const resourcesSave = ref([] as Resource[])

// const { cloneSave, readAllInstancesSaves: loadAllPreviews, importSave } = useInstanceSaves()
const { cloneSave, getInstanceSaves, importSave } = useService(InstanceSavesServiceKey)
const { getResources } = useService(ResourceServiceKey)

const { path } = injection(kInstance)

const { refresh: updateSaves, refreshing: loadingSaves } = useRefreshable(async () => {
  const [store, profile] = await Promise.all([getResources(ResourceDomain.Saves), getInstanceSaves(path.value)])
  resourcesSave.value = store
  // loadedProfileSaves.value = profile
})
const clearSaves = () => {
  resourcesSave.value = []
  loadedProfileSaves.value = []
}

watch(computed(() => props.value), (visible) => {
  if (visible) updateSaves()
  else clearSaves()
})

updateSaves()

const nothingSelected = computed(() => profilesCopyFrom.value.every(v => !v) && resourcesCopyFrom.value.every(v => !v))
// const loadingSaves = useServiceBusy(InstanceSavesServiceKey, 'readAllInstancesSaves')

watch(() => loadedProfileSaves.value, () => {
  profilesCopyFrom.value = new Array(loadedProfileSaves.value.length)
})
watch(resourcesSave, () => {
  resourcesCopyFrom.value = new Array(resourcesSave.value.length)
})

const { refresh: startImport, refreshing: working } = useRefreshable(async () => {
  try {
    const profilesSaves = loadedProfileSaves.value.filter((_, i) => profilesCopyFrom.value[i])
    const resourcesSaves = resourcesSave.value.filter((_, i) => resourcesCopyFrom.value[i])

    if (resourcesSaves.length !== 0) {
      await Promise.all(resourcesSaves.map(save => importSave({ instancePath: path.value, path: save.path, saveRoot: save.metadata.save?.root })))
    }

    if (profilesSaves.length !== 0) {
      for (const s of profilesSaves) {
        await cloneSave({ srcInstancePath: path.value, saveName: s.name, destInstancePath: s.instanceName })
      }
    }
    emit('input', false)
  } catch (e) {
    error.value = e
    console.error('Fail to copy saves')
    console.error(e)
  }
})
</script>

<style>
</style>
