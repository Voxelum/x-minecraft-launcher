import { computed, Ref, ref } from "@vue/composition-api";
import { Forge } from "@xmcl/minecraft-launcher-core";
import { useStore } from "./useStore";
import Vue from 'vue';

export type ModStatus = 'existed' | 'absent' | 'founded' | 'not-found' | 'loading' | 'downloading' | 'unknown';

interface MissingMod {
    modid: string;
    version: string;
    status: ModStatus;
    task: TaskHandle;
    info?: Forge.MetaData & { projectId: string; fileId: string };
};

export function useMissingMods(modList: Ref<{ modid: string; version: string }[]>) {
    const { dispatch, getters } = useStore();
    const items: Ref<MissingMod[]> = computed(() => (modList.value.map(i => ({ ...i, status: 'unknown', task: '' }))));
    const activated = computed(() => items.value.some(i => i.status === 'founded'));
    const downloading = computed(() => items.value.some(i => i.status === 'downloading'));
    const checking = ref(false);

    async function checkAvailability() {
        const unchecked: MissingMod[] = [];

        checking.value = true;

        for (const m of items.value) {
            const resource = getters.queryResource(m);
            if (!resource) {
                unchecked.push(m);
            }
            await Vue.nextTick();
        }

        for (const m of unchecked) {
            m.status = 'loading';
            try {
                m.info = await dispatch('fetchMetadataByModId', m);
                m.status = 'founded';
            } catch (e) {
                m.status = 'not-found';
            }
        }

        checking.value = false;
    }

    async function downloadAllAvailable() {
        for (let m of items.value.filter(i => i.status === 'founded')) {
            await dispatch('fetchMetadataByModId', m);
        }
    }

    return {
        items,
        activated,
        downloading,
        checking,
        checkAvailability,
    }
}
