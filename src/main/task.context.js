import { Task } from 'ts-minecraft'
import { ipcMain } from 'electron'
import { EventEmitter } from 'events'


class InnerContext extends EventEmitter {
    /**
     * 
     * @param {Task} task 
     * @param {EventEmitter} sender 
     */
    constructor(parent, task, uuid, sender) {
        super();
        this.sender = sender;
        this.uuid = uuid;
        this.id = task.id;
        this.parent = parent;
        task.on('update', (progress, total, status) => {
            this.sender.send(uuid, 'update', this.paths, { progress, total, status })
        })
        task.on('error', (error) => {
            this.sender.send(uuid, 'error', this.paths, error)
        })
        task.on('finish', (result) => {
            this.sender.send(uuid, 'finish', this.paths, result)
        })
    }
    get paths() {
        const paths = [this.id]
        let task = this;
        while (task.parent !== null && task.parent !== undefined) {
            paths.unshift(task.parent.id)
            task = task.parent
        }
        return paths;
    }
    /**
        * @template T
        * @param {Task<T>} task 
        * @return {Promise<T>}
        */
    execute(task) {
        this.sender.send(this.uuid, 'child', this.paths, task.id)
        task.execute(new InnerContext(this, task, this.uuid, this.sender));
    }
}

export default {
    /**
     * @template T
     * @param {Task<T>} task 
     * @return {Promise<T>}
     */
    execute(uuid, id, sender, task) {
        return task.execute(new InnerContext({ id }, task, uuid, sender));
    },
    isTask: object => object.id && object.execute && typeof object.execute === 'function' && object instanceof EventEmitter,
};
