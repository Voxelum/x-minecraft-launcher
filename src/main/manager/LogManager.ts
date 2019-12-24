import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { Manager } from '.';

export default class LogManager extends Manager {
    private logger: {
        log: (message: any, ...options: any[]) => void;
        warn: (message: any, ...options: any[]) => void;
        error: (message: any, ...options: any[]) => void;
    } = {} as any;

    private logRoot = '';

    private openedStream: { [name: string]: fs.WriteStream } = {};

    setup() {
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception');
            console.error(err);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('Uncaught Rejection');
            console.error(reason);
        });
        const { log, error, warn } = console;

        const root = app.getPath('userData');
        try {
            fs.mkdirSync(path.resolve(root, 'logs'));
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }

        this.logRoot = path.resolve(root, 'logs');

        const mainLog = path.resolve(root, 'logs', 'main.log');
        const outstream = fs.createWriteStream(mainLog, { encoding: 'utf-8', flags: 'w+' });
        this.logger.log = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[INFO] [${new Date().toUTCString()}]: ${raw}`;
            log(content);
            outstream.write(`${content}\n`);
        };
        this.logger.warn = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[WARN] [${new Date().toUTCString()}]: ${raw}`;
            warn(content);
            outstream.write(`${content}\n`);
        };
        this.logger.error = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[ERROR] [${new Date().toUTCString()}]: ${raw}`;
            error(content);
            outstream.write(`${content}\n`);
        };

        console.log = this.logger.log;
        console.warn = this.logger.warn;
        console.error = this.logger.error;
    }

    readonly log = (message: any, ...options: any[]) => { this.logger.log(message, ...options); }

    readonly warn = (message: any, ...options: any[]) => { this.logger.warn(message, ...options); }

    readonly error = (message: any, ...options: any[]) => { this.logger.error(message, ...options); }

    openWindowLog(name: string) {
        const loggerPath = path.resolve(this.logRoot, `renderer.${name}.log`);
        console.log(`Setup renderer logger for window ${name} to ${loggerPath}.`);
        const stream = fs.createWriteStream(loggerPath, { encoding: 'utf-8', flags: 'w+' });
        this.openedStream[name] = stream;
        return stream;
    }

    closeWindowLog(name: string) {
        this.openedStream[name].close();
    }
}
