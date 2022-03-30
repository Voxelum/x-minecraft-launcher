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
        {{ $t('save.copyFrom.title') }}
      </v-card-title>
      <v-card-text>
        {{ $t('save.copyFrom.description') }}
      </v-card-text>

      <v-alert
        :value="error !== null"
        type="error"
      >
        {{ error }}
      </v-alert>

      <v-list two-line>
        <v-subheader v-if="storedSaves.length">
          {{ $t('save.copyFrom.fromResource') }}
        </v-subheader>

        <v-list-item
          v-for="(s, i) in storedSaves"
          :key="s.hash"
        >
          <v-list-item-action>
            <v-checkbox v-model="resourcesCopyFrom[i]" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title> {{ s.name }} </v-list-item-title>
            <v-list-item-subtitle> {{ $t('save.copyFrom.from', { src: s.curseforge ? 'curseforge' : 'resources' }) }} </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>

        <v-subheader v-if="loadedProfileSaves.length !== 0">
          {{ $t('save.copyFrom.fromProfile') }}
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
            <v-list-item-subtitle> {{ $t('save.copyFrom.from', {src: s.instanceName}) }} </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="working"
          color="red"
          flat
          @click="$emit('input', false)"
        >
          {{ $t('save.copyFrom.cancel') }}
        </v-btn>
        <v-btn
          :disabled="nothingSelected"
          :loading="working"
          color="primary"
          flat
          @click="startImport"
        >
          {{ $t('save.copyFrom.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs, onMounted, watch } from '@vue/composition-api'
import { useBusy, useSaveResource } from '/@/composables'
import { InstanceSave } from '@xmcl/runtime-api'
import { useInstanceSaves } from '../composables/save'

export default defineComponent({
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const data = reactive({
      loadedProfileSaves: [] as Array<InstanceSave>,

      profilesCopyFrom: [] as boolean[],
      resourcesCopyFrom: [] as boolean[],

      working: false,

      error: null as any,
    })

    const { cloneSave, readAllInstancesSaves: loadAllPreviews, importSave } = useInstanceSaves()
    const { resources: storedSaves } = useSaveResource()
    const nothingSelected = computed(() => data.profilesCopyFrom.every(v => !v) && data.resourcesCopyFrom.every(v => !v))
    const loadingSaves = useBusy(loadAllPreviews)

    onMounted(() => {
      loadAllPreviews().then((all) => {
        data.loadedProfileSaves = all
      })
      watch(() => data.loadedProfileSaves, () => {
        data.profilesCopyFrom = new Array(data.loadedProfileSaves.length)
      })
      watch(storedSaves, () => {
        data.resourcesCopyFrom = new Array(storedSaves.value.length)
      })
    })
    return {
      ...toRefs(data),
      loadingSaves,
      storedSaves,
      nothingSelected,
      async startImport() {
        data.working = true
        try {
          const profilesSaves = data.loadedProfileSaves.filter((_, i) => data.profilesCopyFrom[i])
          const resourcesSaves = storedSaves.value.filter((_, i) => data.resourcesCopyFrom[i])

          if (resourcesSaves.length !== 0) {
            await Promise.all(resourcesSaves.map(save => importSave({ source: save.path })))
          }

          if (profilesSaves.length !== 0) {
            for (const s of profilesSaves) {
              // TODO: fix
              await cloneSave({ saveName: s.name, destInstancePath: s.instanceName })
            }
          }
          context.emit('input', false)
        } catch (e) {
          data.error = e
          console.error('Fail to copy saves')
          console.error(e)
        } finally {
          data.working = false
        }
      },
    }
  },
})
</script>

<style>
</style>
