import { ipcMain, BrowserWindow, app, Tray, Menu, MenuItem, nativeImage } from 'electron'
import os from 'os';

export default function setup(winURL) {
    let logWindow; // log win ref
    let loginWinRef; // login window ref
    let profileWinRef; // profile window ref
    let userWinRef; // user window ref
    let marketWinRef; // market window ref
    let parking; // ref for if the game is launching and the launcher is paused

    function createLoginWindow() {
        loginWinRef = new BrowserWindow({
            width: 400,
            height: 680,
            resizable: false,
            frame: false,
            transparent: true,
        });
        loginWinRef.setResizable(false)
        loginWinRef.loadURL(`${winURL}?window=login`);
        loginWinRef.on('close', () => { loginWinRef = undefined })
    }

    function createSettingWindow() {
    }

    createLoginWindow();

    return {
        dispose() {
        },
    }
}
