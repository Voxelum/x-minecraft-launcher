import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { Manager } from '.';

export default class LogManager extends Manager {
    setup() {
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception');
            console.error(err);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('Uncaught Rejection');
            console.error(reason);
        });
    }

    rootReady(root: string) {
        const { log, error, warn } = console;

        try {
            fs.mkdirSync(path.resolve(root, 'logs'));
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }

        const mainLog = path.resolve(root, 'logs', 'main.log');
        const outstream = fs.createWriteStream(mainLog, { encoding: 'utf-8', flags: 'w+' });
        console.log = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[INFO] [${new Date().toUTCString()}]: ${raw}`;
            log(content);
            outstream.write(`${content}\n`);
        };
        console.warn = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[WARN] [${new Date().toUTCString()}]: ${raw}`;
            warn(content);
            outstream.write(`${content}\n`);
        };
        console.error = (message: any, ...options: any[]) => {
            const raw = options.length !== 0 ? util.format(message, options) : util.format(message);
            const content = `[ERROR] [${new Date().toUTCString()}]: ${raw}`;
            error(content);
            outstream.write(`${content}\n`);
        };

        const levels = ['INFO', 'WARN', 'ERROR'];
        ipcMain.on('browser-window-setup', (window, name) => {
            const loggerPath = path.resolve(root, 'logs', `renderer.${name}.log`);
            console.log(`Setup renderer logger for window ${name} to ${loggerPath}.`);
            const stream = fs.createWriteStream(loggerPath, { encoding: 'utf-8', flags: 'w+' });
            window.webContents.on('console-message', (e, level, message, line, id) => {
                stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`);
            });
            window.once('close', () => {
                stream.close();
            });
        });
    }
}
