import { ForgeModCommonMetadata } from '@xmcl/runtime-api'
import { computed, Ref, ref, nextTick } from '@vue/composition-api'

export type ModStatus = 'existed' | 'absent' | 'founded' | 'not-found' | 'loading' | 'downloading' | 'unknown'

interface MissingMod {
  modid: string
  version: string
  status: ModStatus
  task: string
  info?: ForgeModCommonMetadata & { projectId: string; fileId: string }
}

export function useMissingMods(modList: Ref<{ modid: string; version: string }[]>) {
  // const { getters } = useStore()
  // // const { } = useService('CurseForgeService');
  // const items: Ref<MissingMod[]> = computed(() => (modList.value.map(i => ({ ...i, status: 'unknown', task: '' })))) as any
  // const activated = computed(() => items.value.some(i => i.status === 'founded'))
  // const downloading = computed(() => items.value.some(i => i.status === 'downloading'))
  // const checking = ref(false)

  // async function checkAvailability() {
  //   const unchecked: MissingMod[] = []

  //   checking.value = true

  //   for (const m of items.value) {
  //     // const resource = getters.queryResource(`forge://${m.modid}:${m.version}`);
  //     // if (!resource) {
  //     //     unchecked.push(m);
  //     // }
  //     await nextTick()
  //   }

  //   for (const m of unchecked) {
  //     m.status = 'loading'
  //     try {
  //       // m.info = await services.CurseForgeService.fetchMetadataByModId(m);
  //       m.status = 'founded'
  //     } catch (e) {
  //       m.status = 'not-found'
  //     }
  //   }

  //   checking.value = false
  // }

  // async function downloadAllAvailable() {
  //   for (const m of items.value.filter(i => i.status === 'founded')) {
  //     // await services.CurseForgeService.fetchMetadataByModId(m);
  //   }
  // }

  // return {
  //   items,
  //   activated,
  //   downloading,
  //   checking,
  //   checkAvailability,
  // }
}
