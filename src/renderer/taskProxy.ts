import { Ref } from '@vue/composition-api'
import { TaskItem } from './entities/task'

export interface TaskProxy {
  dictionary: {
    [key: string]: TaskItem
  }
  tasks: Ref<TaskItem[]>
  pause(item: TaskItem): void
  resume(item: TaskItem): void
  cancel(item: TaskItem): void
}
