import { computed, inject } from '@vue/composition-api';
import { TASK_PROXY } from '@/constant';
import { requireNonnull } from '@universal/util/assert';

// export function useTask(taskHandle: string | Promise<any>) {
//     const { state } = useStore();
//     const handle = typeof taskHandle === 'string' ? taskHandle : (taskHandle as any).__tasks__[0];
//     const taskState = state.task.tree[handle];
//     const status = computed(() => taskState.status);
//     const progress = computed(() => taskState.progress);
//     const total = computed(() => taskState.total);
//     const message = computed(() => taskState.message);
//     function wait() {
//         // return dispatch('waitTask', taskHandle);
//     }
//     return {
//         name: taskState.name,
//         time: taskState.time,
//         progress,
//         total,
//         message,
//         status,
//         wait,
//     };
// }

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
