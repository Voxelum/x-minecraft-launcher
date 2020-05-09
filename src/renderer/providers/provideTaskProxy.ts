import { electron, TASK_PROXY } from '@/constant';
import { TaskState } from '@universal/task';
import { onMounted, onUnmounted, provide, reactive, Ref, ref, set } from '@vue/composition-api';
import { TaskProxy } from '@/taskProxy';

export function provideTasks() {
    const ipc = electron.ipcRenderer;

    const idToNode: { [key: string]: TaskState } = {};
    const tasks: Ref<TaskState[]> = ref(reactive([]));
    const pause = (id: string) => {
        ipc.invoke('task-request', { type: 'pause', id });
    };
    const resume = (id: string) => {
        ipc.invoke('task-request', { type: 'resume', id });
    };
    const cancel = (id: string) => {
        ipc.invoke('task-request', { type: 'cancel', id });
    };

    const proxy: TaskProxy = {
        dictionary: idToNode,
        tasks,
        pause,
        resume,
        cancel,
    };

    provide(TASK_PROXY, proxy);

    function collectAllTaskState(tasks: TaskState[]) {
        for (const t of tasks) {
            idToNode[t.id] = t;
            if (t.children) {
                collectAllTaskState(t.children);
            }
        }
    }

    let parentMap: Record<string, string> = {};
    let deferredTaskMap: Record<string, Array<TaskState>> = {};
    function enqueueToChildren(parentTask: TaskState, newTask: TaskState) {
        parentMap[newTask.id] = parentTask.id;
        let sameGroup = parentTask.children.filter(t => t.name === newTask.name)
            .filter(t => t.status === 'ready' || t.status === 'running');
        if (sameGroup.length > 6) {
            deferredTaskMap[parentTask.id] = deferredTaskMap[parentTask.id] ?? [];
            deferredTaskMap[parentTask.id].push(newTask);
        } else {
            parentTask.children.push(newTask);
        }
    }
    function dequeIfRemaining(oldTask: TaskState) {
        let parent = parentMap[oldTask.id];
        if (parent) {
            let deferrendTasks = deferredTaskMap[parent];
            if (deferrendTasks && deferrendTasks.length > 0) {
                let parentTask = idToNode[parent];
                let oneDeferred = deferrendTasks.pop();
                let index = parentTask.children.findIndex(t => t.id === oldTask.id);
                set(parentTask.children, index, oneDeferred);
            }
        }
    }

    const taskUpdateHanlder = (event: any, { childs, statuses, adds, updates }: {
        adds: { id: string; node: TaskState }[];
        childs: { id: string; node: TaskState }[];
        updates: { [id: string]: { progress?: number; total?: number; message?: string; time?: string } };
        statuses: { id: string; status: string }[];
    }) => {
        for (const add of adds) {
            const { id, node } = add;
            const local = reactive({ ...node });
            tasks.value.unshift(local);
            idToNode[id] = local;
        }
        for (const child of childs) {
            const { id, node } = child;
            const local = reactive({ ...node });
            if (!idToNode[id]) {
                throw new Error(`Cannot add child ${node.id} for parent ${id}.`);
            } else {
                enqueueToChildren(idToNode[id], local);
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
                if (task.status === 'successed') {
                    dequeIfRemaining(task);
                }
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

    return proxy;
}
