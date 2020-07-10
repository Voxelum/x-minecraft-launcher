import LauncherApp from '@main/app/LauncherApp';
import { IS_DEV } from '@main/constant';
import { createWriteStream, WriteStream } from 'fs';
import { ensureDir } from 'fs-extra';
import { resolve } from 'path';
import { PassThrough, pipeline, Transform } from 'stream';
import { format } from 'util';
import { Manager } from '.';

function formatMsg(message: any, options: any[]) { return options.length !== 0 ? format(message, options) : format(message); }
function baseTransform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}\n`); } }); }

export interface Logger {
    log(message: any, ...options: any[]): void;
    warn(message: any, ...options: any[]): void;
    error(message: any, ...options: any[]): void;
}

export default class LogManager extends Manager {
    private loggerEntries = { log: baseTransform('INFO'), warn: baseTransform('WARN'), error: baseTransform('ERROR') };

    private output = new PassThrough();

    private logRoot = '';

    private openedStream: { [name: string]: WriteStream } = {};

    constructor(app: LauncherApp) {
        super(app);

        pipeline(this.loggerEntries.log, this.output, () => { });
        pipeline(this.loggerEntries.warn, this.output, () => { });
        pipeline(this.loggerEntries.error, this.output, () => { });

        process.on('uncaughtException', (err) => {
            this.error('Uncaught Exception');
            this.error(err);
        });
        process.on('unhandledRejection', (reason) => {
            this.error('Uncaught Rejection');
            this.error(reason);
        });
        if (IS_DEV) {
            this.output.on('data', (b) => console.log(b.toString()));
        }
    }

    readonly log = (message: any, ...options: any[]) => { this.loggerEntries.log.write(formatMsg(message, options)); }

    readonly warn = (message: any, ...options: any[]) => { this.loggerEntries.warn.write(formatMsg(message, options)); }

    readonly error = (message: any, ...options: any[]) => { this.loggerEntries.error.write(formatMsg(message, options)); }

    getLoggerFor(tag: string): Logger {
        function transform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] ${c}\n`); } }); }
        const log = transform(tag).pipe(this.loggerEntries.log);
        const warn = transform(tag).pipe(this.loggerEntries.warn);
        const error = transform(tag).pipe(this.loggerEntries.error);
        return {
            log(message: any, ...options: any[]) { log.write(formatMsg(message, options)); },
            warn(message: any, ...options: any[]) { warn.write(formatMsg(message, options)); },
            error(message: any, ...options: any[]) { error.write(formatMsg(message, options)); },
        };
    }

    openWindowLog(name: string) {
        const loggerPath = resolve(this.logRoot, `renderer.${name}.log`);
        this.log(`Setup renderer logger for window ${name} to ${loggerPath}`);
        const stream = createWriteStream(loggerPath, { encoding: 'utf-8', flags: 'w+' });
        this.openedStream[name] = stream;
        return stream;
    }

    closeWindowLog(name: string) {
        this.openedStream[name].close();
    }

    async redirectLogPipeline(root: string) {
        try {
            await ensureDir(resolve(root, 'logs'));
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
        this.redirectLogPipeline(this.app.root);
    }
}
