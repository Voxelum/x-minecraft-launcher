import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

export function useTask(taskHandle: string | Promise<any>) {
    const { state } = useStore();
    const handle = typeof taskHandle === 'string' ? taskHandle : (taskHandle as any).__tasks__[0];
    const taskState = state.task.tree[handle];
    const status = computed(() => taskState.status);
    const progress = computed(() => taskState.progress);
    const total = computed(() => taskState.total);
    const message = computed(() => taskState.message);
    function wait() {
        // return dispatch('waitTask', taskHandle);
    }
    return {
        // id: taskState._internalId,
        name: taskState.name,
        time: taskState.time,
        progress,
        total,
        message,
        status,
        wait,
    };
}

export function useTasks() {
    const { state } = useStore();
    const activeTasksCount = computed(
        () => state.task.tasks.filter(t => t.status === 'running').length,
    );
    return {
        activeTasksCount,
    };
}
