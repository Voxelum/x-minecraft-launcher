import { v4 } from 'uuid'
import { EventEmitter } from 'events'
import AllElectron from 'electron'
import utils from '../utils'
import { setInterval } from 'timers';

describe('Launch', () => {
    beforeEach(utils.beforeEach)
    afterEach(utils.afterEach)

    it('should run curseforge', function (done) {
        
        const electron = this.app.electron;

        electron.remote.app.on('ready', () => {
            console.log(this.app.services)
        })
        
        const ipc = electron.ipcRenderer;
        const id = v4();
        ipc.send('query', {
            id,
            service: 'curseforge',
            action: 'project',
            payload: '/jounreymap',
        })
        ipc.on(id, (event, type, childPaths, args) => {
            console.log(`type: ${type}, child: ${childPaths}`)
            console.log(args)
            done()
        })

        // console.log(Object.keys(electron.remote.app))
        
    }).timeout(1000000)
}).timeout(1000000)
