import { SERVICES_SEMAPHORE_KEY } from '@/constant';
import { inject, computed } from '@vue/composition-api';

export function useBusy(semaphore: string | Function) {
    const sems = inject(SERVICES_SEMAPHORE_KEY);
    if (!sems) throw new Error();
    const key = typeof semaphore === 'function' ? semaphore.name : semaphore;
    return computed(() => sems[key] > 0);
}
