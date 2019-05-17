
import { ipcMain } from 'electron';
import { resolve } from 'path';
import getTray from './trayManager';

export default function setup(context, store) {
    /**
     * @type { import('electron').BrowserWindow }
     */
    let profileRef;

    function createProfileWindow() {
        profileRef = context.createWindow('index.html?window=profile', {
            title: 'VoxeLauncher',
            width: 770,
            height: 580,
            resizable: false,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            icon: resolve(__static, 'apple-touch-icon.png'),
            // nodeIntegration: false,
        });
        ipcMain.on('task-successed', (id) => {
            profileRef.webContents.send('task-successed', id);
        });
        ipcMain.on('task-failed', (id) => {
            profileRef.webContents.send('task-failed', id);
        });
        ipcMain.on('minecraft-exit', (status) => {
            profileRef.webContents.send('minecraft-exit', status);
        });
        ipcMain.on('minecraft-stdout', (out) => {
            if (out.indexOf('Reloading ResourceManager') !== -1 || out.indexOf('LWJGL Version: ') !== -1) {
                profileRef.webContents.send('minecraft-window-ready');
                profileRef.hide();
            }
        });
    }
    function onWindowOpen(event, id) {
        switch (id) {
            case 'profile': createProfileWindow(); break;
            default:
        }
    }
    function onMinecraftExit() {
        const { showLog, hideLauncher } = store.getters['profile/current'];
        if (hideLauncher) { profileRef.show(); }
    }

    const tray = getTray();
    tray.on('click', () => {
        if (!profileRef.isFocused()) {
            profileRef.focus();
        }
    });
    tray.on('double-click', () => {
        if (!profileRef.isVisible()) {
            profileRef.show();
        } else {
            profileRef.hide();
        }
    });

    ipcMain.on('window-open', onWindowOpen)
        .on('minecraft-exit', onMinecraftExit);

    createProfileWindow();

    return {
        requestFocus() {
        },
        dispose() {
            profileRef.close();
            ipcMain.removeListener('window-open', onWindowOpen);
            ipcMain.removeListener('minecraft-exit-open', onMinecraftExit);
        },
    };
}
