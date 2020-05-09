import { TaskState } from '@universal/task';
import { Ref } from '@vue/composition-api';

export interface TaskProxy {
    dictionary: {
        [key: string]: TaskState;
    };
    tasks: Ref<TaskState[]>;
    pause: (id: string) => void;
    resume: (id: string) => void;
    cancel: (id: string) => void;
}
