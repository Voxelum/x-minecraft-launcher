<template>
  <v-flex
    style="display: flex; flex-direction: column; height: 100%;"
  >
    <v-card-text class="headline font-weight-bold">
      {{ $t('dropToImport') }}
    </v-card-text>
    <v-divider />
    <v-list style="overflow: auto">
      <file-list-tile
        v-for="file in previews"
        :key="file.name"
        :value="file"
        @remove="$emit('remove', file)"
      />
    </v-list>
    <v-spacer />
    <v-divider />
    <v-card-actions>
      <v-btn
        large
        flat
        @click="cancel"
      >
        {{ $t('cancel') }}
      </v-btn>
      <v-spacer />
      <v-checkbox
        v-model="enableMods"
        style="flex-grow: 0; margin-top: 0; padding-top: 0;"
        :label="$t('enableModsAfterImport')"
        hide-details
      />
      <v-btn
        large
        flat
        style="margin-left: 10px;"
        color="primary"
        :loading="loading"
        :disabled="disabled"
        @click="start"
      >
        {{ $t('profile.import.start') }}
      </v-btn>
    </v-card-actions>
  </v-flex>
</template>

<script lang=ts>
import { useFileDrop, useService } from '/@/hooks'
import { required } from '/@/util/props'
import { defineComponent, computed, ref } from '@vue/composition-api'
import { Resource, ResourceDomain, ResourceType } from '/@shared/entities/resource.schema'
import FileListTile from './UniversalDropViewFileListTile.vue'
import { InstanceResourceServiceKey } from '/@shared/services/InstanceResourceService'
import { FilePreview } from './UniversalDropView.vue'

export default defineComponent({
  components: {
    FileListTile,
  },
  props: {
    previews: required<FilePreview[]>(Array),
  },
  setup(props, context) {
    const status = ref([] as boolean[])
    const enableMods = ref(true)
    const { importFile } = useFileDrop()
    const { deploy } = useService(InstanceResourceServiceKey)
    const loading = computed(() => props.previews.some((v) => v.status === 'loading'))
    const pendings = computed(() => props.previews.filter((v) => (v.status === 'idle' || v.status === 'failed') &&
      (v.type !== ResourceType.Unknown) && v.enabled))
    const disabled = computed(() => pendings.value.length === 0)
    function remove(file: FilePreview) {
      const previews = props.previews.filter((p) => p.path !== file.path)
      console.log(file)
      console.log(previews)
      if (previews.length === 0) {
        cancel()
      }
    }
    function cancel() {
      context.emit('cancel')
    }
    function start() {
      const promises = [] as Promise<any>[]
      const resourcesToDeploy = [] as Resource[]
      // TODO: fix this
      // for (const preview of pendings.value) {
      //   preview.status = 'loading'
      //   const promise = importFile(preview).then((resource) => {
      //     if (resource.domain === ResourceDomain.Mods && enableMods.value) {
      //       resourcesToDeploy.push(resource)
      //     }
      //     preview.status = 'saved'
      //   }, (e) => {
      //     console.log(`Failed to import resource ${preview.path}`)
      //     console.log(e)
      //     preview.status = 'failed'
      //   })
      //   promises.push(promise)
      // }
      // Promise.all(promises)
      //   .then(() => deploy({ resources: resourcesToDeploy }))
      //   .then(() => cancel())
    }
    return {
      enableMods,
      remove,
      cancel,
      start,
      loading,
      disabled,
    }
  },
})
</script>
