import { createWriteStream, WriteStream, mkdirSync } from 'fs';
import { resolve } from 'path';
import { PassThrough, pipeline, Transform } from 'stream';
import { format } from 'util';
import { Manager } from '.';

const DEV = process.env.NODE_ENV === 'development';

function formatMsg(message: any, options: any[]) { return options.length !== 0 ? format(message, options) : format(message); }
export default class LogManager extends Manager {
    private loggerEntries = { log: new PassThrough(), warn: new PassThrough(), error: new PassThrough() };

    private output = new PassThrough();

    private logRoot = '';

    private openedStream: { [name: string]: WriteStream } = {};

    constructor() {
        super();

        function transform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}\n`); } }); }
        pipeline(this.loggerEntries.log, transform('INFO'), this.output, () => { });
        pipeline(this.loggerEntries.warn, transform('WARN'), this.output, () => { });
        pipeline(this.loggerEntries.error, transform('ERROR'), this.output, () => { });

        process.on('uncaughtException', (err) => {
            this.error('Uncaught Exception');
            this.error(err);
        });
        process.on('unhandledRejection', (reason) => {
            this.error('Uncaught Rejection');
            this.error(reason);
        });
        if (DEV) {
            this.output.on('data', (b) => console.log(b.toString()));
        }
    }

    readonly log = (message: any, ...options: any[]) => { this.loggerEntries.log.write(formatMsg(message, options)); }

    readonly warn = (message: any, ...options: any[]) => { this.loggerEntries.warn.write(formatMsg(message, options)); }

    readonly error = (message: any, ...options: any[]) => { this.loggerEntries.error.write(formatMsg(message, options)); }

    openWindowLog(name: string) {
        const loggerPath = resolve(this.logRoot, `renderer.${name}.log`);
        this.log(`Setup renderer logger for window ${name} to ${loggerPath}.`);
        const stream = createWriteStream(loggerPath, { encoding: 'utf-8', flags: 'w+' });
        this.openedStream[name] = stream;
        return stream;
    }

    closeWindowLog(name: string) {
        this.openedStream[name].close();
    }

    redirectLogPipeline(root: string) {
        try {
            mkdirSync(resolve(root, 'logs'));
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }
        this.logRoot = resolve(root, 'logs');
        let mainLog = resolve(root, 'logs', 'main.log');
        this.output.pipe(createWriteStream(mainLog, { encoding: 'utf-8', flags: 'w+' }));
    }

    // SETUP CODE

    setup() {
        this.redirectLogPipeline(this.managers.appManager.root);
    }
}
