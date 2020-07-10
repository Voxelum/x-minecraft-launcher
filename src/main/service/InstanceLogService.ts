import { decode, guessEncodingByBuffer, UTF8 } from '@main/util/encoding';
import { readdirIfPresent } from '@main/util/fs';
import { gunzip } from '@main/util/zip';
import { readFile, remove } from 'fs-extra';
import { isAbsolute, join } from 'path';
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
        this.log(`Remove log ${filePath}`);
        await remove(filePath);
    }

    /**
     * Get the log content.
     * @param name The log file name
     */
    async getLogContent(name: string) {
        let filePath = join(this.state.instance.path, 'logs', name);
        let buf = await readFile(filePath);
        if (name.endsWith('.gz')) {
            buf = await gunzip(buf);
        }
        let encoding = await guessEncodingByBuffer(buf);
        let result = decode(buf, encoding || UTF8);
        return result;
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
        this.log(`Remove crash report ${filePath}`);
        await remove(filePath);
    }

    /**
     * Get the crash report content
     * @param name The name of crash report
     */
    async getCrashReportContent(name: string) {
        let filePath: string;
        if (isAbsolute(name)) {
            filePath = name;
        } else {
            filePath = join(this.state.instance.path, 'crash-reports', name);
        }
        let buf = await readFile(filePath.trim());
        if (name.endsWith('.gz')) {
            buf = await gunzip(buf);
        }
        let encoding = await guessEncodingByBuffer(buf);
        let result = decode(buf, encoding || UTF8);
        return result;
    }

    /**
     * Show the log file on disk. This will open a file explorer.
     * @param name The log file name
     */
    showLog(name: string) {
        const filePath = join(this.state.instance.path, 'logs', name);
        this.app.showItemInFolder(filePath);
    }

    /**
     * Show a crash report on disk. This will open a file explorer.
     * @param name The crash report file name
     */
    showCrash(name: string) {
        const filePath = join(this.state.instance.path, 'crash-reports', name);
        this.app.showItemInFolder(filePath);
    }
}
