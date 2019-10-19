import { TaskState } from "universal/store/modules/task";
import Task from "@xmcl/task";
import { Store } from "vuex";

interface Progress { progress?: number, total?: number, message?: string, time?: string }
const TASK_FORCE_THRESHOLD = 30;

let listener: NodeJS.Timeout | undefined;
let adds: { id: string, node: TaskState }[] = [];
let childs: { id: string, node: TaskState }[] = [];
let updates: { [id: string]: Progress } = {};
let statuses: { id: string, status: string }[] = []
let forceUpdate: () => void = () => { };

export function add(id: string, node: TaskState) {
    adds.push({ id, node });
    checkBatchSize();
}

export function update(uuid: string, update: Progress) {
    const last = updates[uuid];
    if (last) {
        updates[uuid] = {
            progress: last.progress || update.progress,
            total: last.total || update.total,
            message: last.message || update.message,
        };
    } else {
        updates[uuid] = update;
    }
    checkBatchSize();
}

export function child(id: string, node: TaskState) {
    childs.push({
        id,
        node,
    });
    checkBatchSize();
}

export function status(uuid: string, status: Task.Status) {
    statuses.push({ id: uuid, status });
    checkBatchSize();
}

function checkBatchSize() {
    if (adds.length + statuses.length + childs.length + Object.keys(updates).length > TASK_FORCE_THRESHOLD) {
        forceUpdate();
    }
}

export function install(context: Store<any>) {
    if (listener === undefined) {
        forceUpdate = () => {
            if (adds.length !== 0 || childs.length !== 0 || Object.keys(updates).length !== 0 || statuses.length !== 0) {
                context.commit('updateBatchTask', {
                    adds: adds,
                    childs: childs,
                    updates: updates,
                    statuses: statuses,
                });

                adds = [];
                childs = [];
                updates = {};
                statuses = [];
            }
        };
        listener = setInterval(forceUpdate, 500);
    }
}