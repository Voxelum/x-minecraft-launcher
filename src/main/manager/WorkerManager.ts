import { IS_DEV } from '@main/constant';
import { CPUWorker, WorkerProxy } from '@main/entities/worker';
import { Worker } from 'worker_threads';
import { Manager } from '.';

export default class WorkerManager extends Manager {
    private worker: WorkerProxy | undefined;

    getWorker(): CPUWorker {
        if (!this.worker) {
            this.worker = new WorkerProxy(new Worker(`${__dirname}/worker.js`));
        }
        return this.worker;
    }
}
