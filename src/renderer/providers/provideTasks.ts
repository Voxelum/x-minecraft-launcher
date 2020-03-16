import { onMounted, onUnmounted, provide, reactive, Ref, ref } from "@vue/composition-api";
import { electron, TASKS_KEY, TASK_DICT_KEY } from '@/constant';
import { TaskState } from "universal/task";

export function provideTasks() {
    const ipc = electron.ipcRenderer;

    const idToNode: { [key: string]: TaskState } = {};
    const tasks: Ref<TaskState[]> = ref(reactive([]));

    provide(TASK_DICT_KEY, idToNode);
    provide(TASKS_KEY, tasks);

    function collectAllTaskState(tasks: TaskState[]) {
        for (const t of tasks) {
            idToNode[t.id] = t;
            if (t.children) {
                collectAllTaskState(t.children);
            }
        }
    }

    const taskUpdateHanlder = (event: Electron.IpcRenderer, { childs, statuses, adds, updates }: {
        adds: { id: string; node: TaskState }[];
        childs: { id: string; node: TaskState }[];
        updates: { [id: string]: { progress?: number; total?: number; message?: string; time?: string } };
        statuses: { id: string; status: string }[];
    }) => {
        for (const add of adds) {
            const { id, node } = add;
            const local = reactive({ ...node, tasks: [], errors: [] });
            tasks.value.unshift(local);
            idToNode[id] = local;
        }
        for (const child of childs) {
            const { id, node } = child;
            const local = reactive({ ...node, tasks: [], errors: [] });
            if (!idToNode[id]) {
                console.log(`Cannot add child ${node.id} for parent ${id}.`);
            } else {
                idToNode[id].children.push(local);
                idToNode[node.id] = local;
            }
        }
        for (const update of Object.keys(updates).map(k => ({ id: k, ...updates[k] }))) {
            const { id, progress, total, message, time } = update;
            const task = idToNode[id];
            if (task) {
                if (progress) task.progress = progress;
                if (total) task.total = total;
                if (message) task.message = message;
                if (time) task.time = time || new Date().toLocaleTimeString();
            } else {
                console.log(`Cannot apply update for task ${id}.`);
            }
        }
        for (const s of statuses) {
            if (!s) { continue; }
            const { id, status } = s;
            const task = idToNode[id];
            if (task) {
                task.status = status as any;
            } else {
                console.log(`Cannot update status for task ${id}.`);
            }
        }
    };

    onMounted(() => {
        ipc.on('task-update', taskUpdateHanlder);
        ipc.invoke('task-state').then((t) => {
            collectAllTaskState(t);
            Object.values(t).forEach(ta => tasks.value.push(reactive(ta)));
        });
    });
    onUnmounted(() => {
        ipc.removeListener('task-update', taskUpdateHanlder);
    });
}
