import { readFile, remove } from 'fs-extra';
import { readdirIfPresent } from '@main/util/fs';
import { join } from 'path';
import { gunzip } from 'zlib';
import Service from './Service';

export default class InstanceLogService extends Service {
    /**
     * List the log in current instances
     */
    async listLogs() {
        const files = await readdirIfPresent(join(this.state.instance.path, 'logs'));
        return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt') || f.endsWith('.log'));
    }

    /**
     * Remove a log from disk
     * @param name The log file name
     */
    async removeLog(name: string) {
        const filePath = join(this.state.instance.path, 'logs', name);
        await remove(filePath);
    }

    /**
     * Get the log content. 
     * @param name The log file name
     */
    async getLogContent(name: string) {
        const filePath = join(this.state.instance.path, 'logs', name);
        const buf = await readFile(filePath);
        if (name.endsWith('.gz')) {
            return new Promise<string>((resolve, reject) => {
                gunzip(buf, (e, r) => {
                    if (e) reject(e);
                    else resolve(r.toString());
                });
            });
        }
        return buf.toString();
    }

    /**
     * List crash reports in current instance
     */
    async listCrashReports() {
        const files = await readdirIfPresent(join(this.state.instance.path, 'crash-reports'));
        return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt'));
    }

    /**
     * Remove a crash report from disk
     * @param name The crash report file name
     */
    async removeCrashReport(name: string) {
        const filePath = join(this.state.instance.path, 'crash-reports', name);
        await remove(filePath);
    }

    /**
     * Get the crash report content
     * @param name The name of crash report
     */
    async getCrashReportContent(name: string) {
        const filePath = join(this.state.instance.path, 'crash-reports', name);
        const buf = await readFile(filePath);
        if (name.endsWith('.gz')) {
            return new Promise<string>((resolve, reject) => {
                gunzip(buf, (e, r) => {
                    if (e) reject(e);
                    else resolve(r.toString());
                });
            });
        }
        return buf.toString();
    }

    /**
     * Show the log file on disk. This will open a file explorer.
     * @param name The log file name
     */
    showLog(name: string) {
        const filePath = join(this.state.instance.path, 'logs', name);
        this.appManager.showItemInFolder(filePath);
    }

    /**
     * Show a crash report on disk. This will open a file explorer.
     * @param name The crash report file name
     */
    showCrash(name: string) {
        const filePath = join(this.state.instance.path, 'crash-reports', name);
        this.appManager.showItemInFolder(filePath);
    }
}
