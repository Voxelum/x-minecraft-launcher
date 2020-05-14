import { TaskState, TaskStatus } from '@universal/task';
import { TaskRuntime } from '@xmcl/task';

export interface TaskProgress {
    progress?: number;
    total?: number;
    message?: string;
    time?: string;
}

export interface TaskPayload {
    adds: {
        id: string;
        node: TaskState;
    }[];
    childs: {
        id: string;
        node: TaskState;
    }[];
    updates: {
        [id: string]: TaskProgress;
    };
    statuses: {
        id: string;
        status: string;
    }[];
}

export interface TaskMonitor {
    flush(): TaskPayload;
    destroy(): void;
}

/**
 * Create a monitor to a task runtime.
 */
export function createTaskMonitor(
    runtime: TaskRuntime<TaskState>,
    enqueueCallback: (
        adds: {
            id: string;
            node: TaskState;
        }[],
        childs: {
            id: string;
            node: TaskState;
        }[],
        updates: {
            [id: string]: TaskProgress;
        },
        statuses: {
            id: string;
            status: string;
        }[]) => void = () => { },
): TaskMonitor {
    let adds: { id: string; node: TaskState }[] = [];

    let childs: { id: string; node: TaskState }[] = [];

    let updates: { [id: string]: TaskProgress } = {};

    let statuses: { id: string; status: string }[] = [];

    function update(update: TaskProgress, node: TaskState) {
        const uuid = node.id;
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
        enqueueCallback(adds, childs, updates, statuses);
    }
    function add(id: string, node: TaskState) {
        adds.push({
            id,
            node: {
                ...node,
                children: [],
            },
        });
    }
    function child(parent: TaskState, node: TaskState) {
        childs.push({
            id: parent.id,
            node: {
                ...node,
                children: [],
            },
        });
    }
    function status(uuid: string, status: TaskStatus) {
        statuses.push({ id: uuid, status });
    }
    function execute(node: TaskState, parent?: TaskState) {
        if (parent) {
            child(parent, node);
        } else {
            add(node.id, node);
        }
        status(node.id, 'running');
        enqueueCallback(adds, childs, updates, statuses);
    }
    function pause(node: TaskState) {
        status(node.id, 'paused');
        enqueueCallback(adds, childs, updates, statuses);
    }
    function resume(node: TaskState) {
        status(node.id, 'running');
        enqueueCallback(adds, childs, updates, statuses);
    }
    function finish(result: any, node: TaskState) {
        status(node.id, 'successed');
        enqueueCallback(adds, childs, updates, statuses);
    }
    function cancel(node: TaskState) {
        status(node.id, 'cancelled');
        enqueueCallback(adds, childs, updates, statuses);
    }
    function fail(error: any, node: TaskState) {
        status(node.id, 'failed');
        let errorMessage;
        if (error instanceof Error) {
            errorMessage = error.toString();
        } else {
            errorMessage = JSON.stringify(error, null, 4);
        }
        update({ message: errorMessage }, node);
        enqueueCallback(adds, childs, updates, statuses);
    }

    runtime.on('update', update);
    runtime.on('execute', execute);
    runtime.on('pause', pause);
    runtime.on('resume', resume);
    runtime.on('finish', finish);
    runtime.on('cancel', cancel);
    runtime.on('fail', fail);

    function flush() {
        let result = { adds, childs, updates, statuses };

        adds = [];
        childs = [];
        updates = {};
        statuses = [];

        return result;
    }
    function destroy() {
        runtime.removeListener('update', update);
        runtime.removeListener('execute', execute);
        runtime.removeListener('pause', pause);
        runtime.removeListener('pasue', pause);
        runtime.removeListener('resume', resume);
        runtime.removeListener('finish', finish);
        runtime.removeListener('cancel', cancel);
        runtime.removeListener('fail', fail);
    }

    return { flush, destroy };
}

export function createTaskPusher(
    runtime: TaskRuntime<TaskState>,
    interval: number,
    threshold: number,
    consume: (payload: TaskPayload) => void,
) {
    let monitor = createTaskMonitor(runtime, (adds, childs, updates, statuses) => {
        if ((adds.length + statuses.length + childs.length + Object.keys(updates).length) > threshold) {
            consume(monitor.flush());
        }
    });
    let flush = () => {
        let result = monitor.flush();
        if (result.adds.length > 0 || result.childs.length > 0 || result.statuses.length > 0 || Object.keys(result.updates).length > 0) {
            consume(result);
        }
    };
    let handle = setInterval(flush, interval);
    return () => {
        monitor.destroy();
        clearInterval(handle);
    };
}
