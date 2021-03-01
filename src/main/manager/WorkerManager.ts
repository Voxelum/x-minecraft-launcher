import { Manager } from '.'
import createWorker from '../workers/index?worker'
import { CPUWorker, WorkerProxy } from '/@main/entities/worker'

export default class WorkerManager extends Manager {
  private worker: WorkerProxy | undefined;

  getWorker(): CPUWorker {
    if (!this.worker) {
      this.worker = new WorkerProxy(createWorker())
    }
    return this.worker
  }
}
