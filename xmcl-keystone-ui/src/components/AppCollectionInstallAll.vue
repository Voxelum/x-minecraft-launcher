<template>
  <div class="flex items-center" data-testid="collection-install-all">
    <v-btn
      :disabled="entries.length === 0"
      :loading="resolving"
      variant="tonal"
      color="primary"
      size="small"
      prepend-icon="download"
      data-testid="collection-install-all-button"
      @click="onInstallAll"
    >
      {{ t('localCollection.installAll') }}
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { marketItemsToEntries, resolveCollectionFiles } from '@/composables/collectionInstall'
import { resolveCollectionEntry } from '@/composables/collectionResolver'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useDialog } from '@/composables/dialog'
import { useNotifier } from '@/composables/notifier'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getModrinthModLoaders } from '@/util/modrinth'
import { ProjectEntry } from '@/util/search'
import { RuntimeVersions } from '@xmcl/instance'
import { CollectionContentType } from '@xmcl/runtime-api'

const props = defineProps<{
  /** The market items currently shown for the selected collection. */
  items: ProjectEntry[]
  contentType: CollectionContentType
  runtime: RuntimeVersions
}>()

const { t } = useI18n()
const { notify } = useNotifier()
const { show } = useDialog(InstanceInstallDialog)

const resolving = ref(false)
const entries = computed(() => marketItemsToEntries(props.items))

/** provider:projectId -> display title, for naming incompatible projects. */
const titleByKey = computed(() => {
  const map = new Map<string, string>()
  for (const item of props.items) {
    const title = item.localizedTitle || item.title || ''
    const modrinthId = item.modrinthProjectId || item.modrinth?.project_id
    const curseforgeId = item.curseforgeProjectId || item.curseforge?.id
    if (modrinthId) map.set(`modrinth:${modrinthId}`, title)
    if (curseforgeId !== undefined) map.set(`curseforge:${curseforgeId}`, title)
  }
  return map
})

async function onInstallAll() {
  if (resolving.value || entries.value.length === 0) return
  resolving.value = true
  try {
    const target = {
      minecraft: props.runtime.minecraft,
      loaders: props.contentType === 'mods' ? getModrinthModLoaders(props.runtime, false) : [],
      contentType: props.contentType,
    }
    const { files, skipped } = await resolveCollectionFiles(
      entries.value,
      props.contentType,
      (entry, signal) => resolveCollectionEntry(entry, target, {
        modrinth: clientModrinthV2,
        curseforge: clientCurseforgeV1,
      }, signal),
    )

    const incompatible = skipped.map((s) => {
      const key = `${s.entry.provider}:${s.entry.projectId}`
      return { id: key, name: titleByKey.value.get(key) || s.entry.projectId }
    })

    // Route through the instance-install dialog: the user reviews the computed
    // manifest — and any incompatible projects — then confirms before install.
    if (files.length > 0 || incompatible.length > 0) {
      show({
        type: 'updates',
        oldFiles: [],
        files,
        id: `collection-install-${props.contentType}-${Date.now()}`,
        incompatible,
      })
    }
  } catch (e) {
    notify({ level: 'error', title: t('localCollection.installAll'), body: (e as Error).message })
  } finally {
    resolving.value = false
  }
}
</script>
