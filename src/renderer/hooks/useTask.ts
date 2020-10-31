import { computed, inject, watch, ref, Ref } from '@vue/composition-api';
import { TASK_PROXY } from '@/constant';
import { requireNonnull } from '@universal/util/assert';
import { getServiceCallTasks } from '@/providers/provideServiceProxy';
import { TaskState } from '@universal/task';

export function useTaskCount() {
    const proxy = inject(TASK_PROXY);
    requireNonnull(proxy);
    const { tasks } = proxy;
    const activeTasksCount = computed(
        () => tasks.value.filter(t => t.status === 'running').length,
    );
    return {
        activeTasksCount,
    };
}

export function useTasks() {
    const proxy = inject(TASK_PROXY);
    requireNonnull(proxy);
    const { pause, resume, cancel, tasks } = proxy;
    return { tasks, pause, resume, cancel };
}

export function useTaskFromServiceCall(call: Ref<Readonly<Promise<any> | undefined>>) {
    const proxy = inject(TASK_PROXY);
    requireNonnull(proxy);

    let { tasks: tasksList } = proxy;

    const task = computed(() => tasksList.value.find(() => (call.value ? getServiceCallTasks(call.value)?.value[0] : undefined)));
    const name = computed(() => task.value?.name ?? '');
    const time = computed(() => task.value?.time ?? '');
    const status = computed(() => task.value?.status ?? 'running');
    const progress = computed(() => task.value?.progress ?? -1);
    const total = computed(() => task.value?.total ?? -1);
    const message = computed(() => task.value?.message ?? '');

    function wait() {
        // return dispatch('waitTask', taskHandle);
    }
    return {
        name,
        time,
        progress,
        total,
        message,
        status,
        wait,
    };
}
