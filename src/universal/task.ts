import { TaskNode } from '@xmcl/task';

export type TaskStatus = 'successed' | 'failed' | 'ready' | 'running';

export interface TaskState extends TaskNode {
    id: string;
    children: TaskState[];
    time?: string;
    background?: boolean;
    progress?: number;
    total?: number;
    message?: string;
    status?: TaskStatus;
}
