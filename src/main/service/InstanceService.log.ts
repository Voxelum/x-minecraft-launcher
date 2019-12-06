import { fs } from 'main/utils';
import { readFolder } from 'main/utils/persistence';
import { gunzip } from 'zlib';
import InstanceService from './InstanceService';

export async function listLogs(this: InstanceService) {
    const files = await readFolder(`profiles/${this.state.profile.id}/logs`);
    return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt'));
}
export async function removeLog(this: InstanceService, name: string) {
    const filePath = this.getPath('profiles', this.state.profile.id, 'logs', name);
    await fs.remove(filePath);
}
export async function getLogContent(this: InstanceService, name: string) {
    const filePath = this.getPath('profiles', this.state.profile.id, 'logs', name);
    const buf = await fs.readFile(filePath);
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
export async function listCrashReports(this: InstanceService) {
    const files = await readFolder(`profiles/${this.state.profile.id}/crash-reports`);
    return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt'));
}
export async function removeCrashReport(this: InstanceService, name: string) {
    const filePath = this.getPath('profiles', this.state.profile.id, 'crash-reports', name);
    await fs.remove(filePath);
}
export async function getCrashReportContent(this: InstanceService, name: string) {
    const filePath = this.getPath('profiles', this.state.profile.id, 'crash-reports', name);
    const buf = await fs.readFile(filePath);
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
