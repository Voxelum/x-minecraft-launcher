import useStore from "@/hooks/useStore";
import { computed } from "@vue/composition-api";

export function useTask(taskHandle: TaskHandle) {
    const { state } = useStore();
    const taskState = state.task.tree[taskHandle];
    const status = computed(() => taskState.status);
    const progress = computed(() => taskState.progress);
    const total = computed(() => taskState.total);
    const message = computed(() => taskState.message);
    return {
        id: taskState._internalId,
        name: taskState.name,
        time: taskState.time,
        progress,
        total,
        message,
        status,
    }
}

