import Shell from 'node-powershell';
import { resolve } from 'path';

export async function acrylic(pid: number) {
    const path = process.env.NODE_ENV === 'production'
        ? resolve(__static.replace('app.asar', 'app.asar.unpacked'), 'Acrylic.cs')
        : resolve(__static, 'Acrylic.cs');

    const ps = new Shell({
        executionPolicy: 'RemoteSigned',
        noProfile: true,
    });
    ps.addCommand('[Console]::OutputEncoding = [Text.Encoding]::UTF8');
    ps.addCommand(`Add-Type -Path '${path}'`);
    ps.addCommand(`[Acrylic.Acrylic]::EnableAcrylic(${pid})`);
    try {
        let result = await ps.invoke();
        return result;
    } finally {
        ps.dispose();
    }
}
