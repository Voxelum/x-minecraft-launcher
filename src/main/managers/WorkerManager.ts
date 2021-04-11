import { Manager } from '.'
import createWorker from '../workers/index?worker'
import { WorkerAgent } from '/@main/entities/worker'

export default class WorkerManager extends Manager {
  private worker: WorkerAgent | undefined

  getWorker(): WorkerAgent {
    if (!this.worker) {
      this.worker = new WorkerAgent(createWorker())
    }
    return this.worker
  }
}
