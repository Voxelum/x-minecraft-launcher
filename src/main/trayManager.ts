import { app, Menu, Tray, dialog, ipcMain, nativeImage } from 'electron';
import { t } from './i18n';

let tray: Tray | null = null;

app.on('before-quit', () => {
    if (tray !== null) {
        tray.destroy();
    }
});
app.on('ready', () => {
    const img = nativeImage.createFromPath(`${__static}/favicon@2x.png`);
    tray = new Tray(img);

    function createMenu() {
        return Menu.buildFromTemplate([
            { type: 'normal', label: t('launcher.checkUpdate') },
            { type: 'separator' },
            {
                label: t('launcher.showDiagnosis'),
                type: 'normal',
                click() {
                    const cpu = process.getCPUUsage();
                    const mem = process.getProcessMemoryInfo();
                    const sysmem = process.getSystemMemoryInfo();

                    const p: Promise<Electron.ProcessMemoryInfo> = mem instanceof Promise ? mem : Promise.resolve(mem);
                    p.then((m) => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Diagnosis Info',
                            message: `CPU: ${JSON.stringify(cpu)}\nMem: ${JSON.stringify(m)}\nSysMem: ${JSON.stringify(sysmem)}`,
                        });
                    });
                },
            },
            { type: 'separator' },
            {
                label: t('launcher.quit'),
                type: 'normal',
                click(item, window, event) {
                    app.quit();
                },
            },
        ]);
    }

    tray.setContextMenu(createMenu());

    ipcMain.on('locale-changed', () => {
        if (tray) {
            tray.setToolTip(t('launcher.title'));
            tray.setContextMenu(createMenu());
        }
    });
});

export default function getTray() {
    return tray;
}
