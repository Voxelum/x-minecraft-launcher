import { electron, TASK_PROXY } from '@/constant';
import { TaskItem } from '@/entities/task';
import { useI18n } from '@/hooks';
import { TaskProxy } from '@/taskProxy';
import { TaskBatchPayload, TaskPayload, TaskState } from '@universal/task';
import { computed, onMounted, onUnmounted, provide, reactive, Ref, ref } from '@vue/composition-api';

export function provideTasks() {
    const ipc = electron.ipcRenderer;

    const { $t } = useI18n();
    const dictionary: Record<string, TaskItem> = {};
    const nonReactiveChildren: Record<string, TaskItem[]> = {};
    /**
     * All the root tasks
     */
    const tasks: Ref<TaskItem[]> = ref(reactive([]));
    const pause = (task: TaskItem) => {
        ipc.invoke('task-operation', { type: 'pause', id: task.taskId });
    };
    const resume = (task: TaskItem) => {
        ipc.invoke('task-operation', { type: 'resume', id: task.taskId });
    };
    const cancel = (task: TaskItem) => {
        ipc.invoke('task-operation', { type: 'cancel', id: task.taskId });
    };

    const proxy: TaskProxy = ({
        dictionary,
        tasks,
        pause,
        resume,
        cancel,
    });

    let syncing: Promise<void> | undefined;

    provide(TASK_PROXY, proxy);

    function getVisibleChildren(allChildren: Ref<TaskItem[]>) {
        const cached = new Array<TaskItem>(10);
        const children = computed(() => {
            if (allChildren.value.length === 0) return undefined;
            const successed = [];
            const others = [];
            for (const item of allChildren.value) {
                if (item.state === TaskState.Successed) {
                    successed.push(item);
                } else {
                    others.push(item);
                }
            }
            const combined = others.concat(successed);
            for (let i = 0; i < 10; i++) {
                const elem = combined.shift();
                if (elem) {
                    cached[i] = elem;
                } else {
                    cached.length = i + 1;
                    break;
                }
            }
            return cached;
        });
        return children;
    }

    function convertPayloadToItem(payload: TaskPayload): TaskItem {
        const allChildren = ref(payload.children.map(convertPayloadToItem));
        const children = getVisibleChildren(allChildren);
        return reactive({
            id: `${payload.uuid}@${payload.id}`,
            taskId: payload.uuid,
            title: $t(payload.path, payload.param),
            time: new Date(payload.time),
            message: payload.to ?? payload.from ?? '',
            throughput: 0,
            state: payload.state,
            progress: payload.progress,
            total: payload.total,
            children,
            allChildren,
        });
    }

    function mapTasksToDictionary(tasks?: TaskItem[]) {
        if (!tasks || tasks.length === 0) return;
        for (const t of tasks) {
            dictionary[t.id] = t;
            mapTasksToDictionary(t.children);
        }
    }

    const taskUpdateHandler = async (event: any, { adds, updates }: TaskBatchPayload) => {
        if (syncing) {
            await syncing;
        }
        for (const add of adds) {
            const { uuid, id, path, param, time, to, from, parentId } = add;
            const localId = `${uuid}@${id}`;
            const allChildren = ref([] as TaskItem[]);
            const children = getVisibleChildren(allChildren);
            const item = reactive({
                taskId: uuid,
                id: localId,
                title: $t(path, param),
                children,
                time: new Date(time),
                message: to ?? from ?? '',
                throughput: 0,
                state: TaskState.Running,
                progress: 0,
                total: -1,
                parentId,
                allChildren,
            });
            if (typeof parentId === 'number') {
                const parentLocalId = `${uuid}@${parentId}`;
                const parent = dictionary[parentLocalId];
                parent.allChildren.unshift(item);
            } else {
                tasks.value.unshift(item);
            }
            if (dictionary[localId]) {
                console.warn(`Skip for duplicated task ${localId}`);
                continue;
            }
            nonReactiveChildren[localId] = [];
            dictionary[localId] = item;
        }
        for (const update of updates) {
            const { uuid, id, time, to, from, progress, total, chunkSize, state: status } = update;
            const localId = `${uuid}@${id}`;
            const item = dictionary[localId];
            if (item) {
                if (status) {
                    item.state = status;
                }
                if (progress) {
                    item.progress = progress;
                }
                if (total) {
                    item.total = total;
                }
                item.time = new Date(time);
                item.message = from || to || item.message;
                if (chunkSize) {
                    item.throughput += chunkSize;
                }
            } else {
                console.log(`Cannot apply update for task ${localId} as task not found.`);
            }
        }
    };

    onMounted(() => {
        let _resolve: () => void;
        syncing = new Promise((resolve) => { _resolve = resolve; });
        ipc.on('task-update', taskUpdateHandler);
        ipc.invoke('task-subscribe', true).then((payload) => {
            const items = payload.map(convertPayloadToItem);
            tasks.value = items;
            mapTasksToDictionary(items);
            _resolve();
        });
    });
    onUnmounted(() => {
        ipc.invoke('task-unsubscribe');
        ipc.removeListener('task-update', taskUpdateHandler);
    });

    return proxy;
}
