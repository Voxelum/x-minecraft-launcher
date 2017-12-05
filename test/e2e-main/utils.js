import electron from 'electron'
import { Application } from 'spectron'

export default {
    afterEach() {
        this.timeout(1000000)
        if (this.app && this.app.isRunning()) {
            return this.app.stop()
        }
        return undefined;
    },
    beforeEach() {
        this.timeout(1000000)
        /**
         * @type {Application}
         */
        this.app = new Application({
            path: electron,
            args: ['dist/electron/main.js'],
            startTimeout: 1000000,
            waitTimeout: 1000000,
        })

        return this.app.start()
    },
}
