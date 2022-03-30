<template>
  <v-dialog
    v-if="inside"
    v-model="inside"
    @dragover.prevent
  >
    <div
      style="display: flex"
      class="h-[80vh] w-full"
      @drop="onDrop"
      @dragover.prevent
    >
      <v-fade-transition>
        <v-card
          class="w-full h-full items-center justify-center flex"
          :elevation="14"
        >
          <div
            v-if="loading"
          >
            <refreshing-tile />
          </div>
          <div
            v-else-if="pending"
            class="text-center select-none"
          >
            <v-icon
              :style="{ 'font-size': `${50}px` }"
              style="display: block"
            >
              save_alt
            </v-icon>
            <v-card-text
              class="headline font-weight-bold"
              style="font-size: 100px"
            >
              {{ $t("dropToImport") }}
            </v-card-text>

            <v-card-text class="font-weight-bold">
              <v-icon>$vuetify.icons.forge</v-icon>
              {{ $tc("mod.name", 0) }}
              <v-icon>$vuetify.icons.fabric</v-icon>
              Fabric
              {{ $tc("mod.name", 0) }}
              <v-icon>$vuetify.icons.zip</v-icon>
              {{ $tc("resourcepack.name", 0) }}
              <v-icon>$vuetify.icons.package</v-icon>
              {{ $tc("save.name", 0) }}
              <v-icon :size="16">
                $vuetify.icons.curseforge
              </v-icon>
              {{ $tc("profile.modpack.name", 0) }}
            </v-card-text>
          </div>
          <preview-view
            v-else
            :previews="previews"
            @remove="remove"
            @cancel="cancel"
          />
        </v-card>
      </v-fade-transition>
    </div>
  </v-dialog>
</template>

<script lang=ts>
import { useFileDrop, useRouter } from '/@/composables'
import { isPersistedResource, Resource, ResourceDomain } from '@xmcl/runtime-api'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import PreviewView from './AppDropDialogPreview.vue'

export interface FilePreview extends Resource {
  enabled: boolean
  status: 'loading' | 'idle' | 'failed' | 'saved'
}

export default defineComponent({
  components: {
    PreviewView,
    RefreshingTile,
  },
  setup() {
    const pending = ref(true)
    const inside = ref(false)
    const loading = ref(false)
    const previews = ref([] as FilePreview[])
    const { resolveFiles } = useFileDrop()
    async function onDrop(event: DragEvent) {
      const files = [] as Array<File>
      const dataTransfer = event.dataTransfer!
      if (dataTransfer.files.length > 0) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
          const file = dataTransfer.files.item(i)!
          if (previews.value.every(p => p.path !== file.path)) {
            files.push(file)
          }
        }
      }
      loading.value = true
      const result = await resolveFiles({ files: files.map(f => ({ path: f.path })) }).finally(() => { loading.value = false })
      for (let i = 0; i < result.length; i++) {
        const r = result[i][0]
        const f = files[i]
        previews.value.push({
          ...r,
          name: f.name,
          size: f.size,
          enabled: isPersistedResource(r),
          status: isPersistedResource(r) && r.domain !== ResourceDomain.Unknown ? 'saved' : 'idle',
        })
      }
      pending.value = false
    }
    function remove(file: FilePreview) {
      previews.value = previews.value.filter((p) => p.path !== file.path)
      if (previews.value.length === 0) {
        cancel()
      }
    }
    function cancel() {
      pending.value = true
      inside.value = false
      previews.value = []
    }
    const router = useRouter()
    document.addEventListener('dragleave', (e) => {
      if (router.currentRoute.fullPath === '/user') {
        return
      }
      if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'all') {
        if (!pending.value || previews.value.length > 0) {
          pending.value = false
        } else {
          cancel()
        }
      }
    })
    document.addEventListener('dragenter', (e) => {
      if (router.currentRoute.fullPath === '/user') {
        return
      }
      if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'all') {
        inside.value = true
        pending.value = true
      }
    })
    return {
      loading,
      onDrop,
      inside,
      pending,
      previews,
      remove,
      cancel,
    }
  },
})
</script>
