import { ipcMain, BrowserWindow, app, Tray, Menu, MenuItem, nativeImage } from 'electron';
import os from 'os';

export default function setup(winURL) {
    let logWindow; // log win ref
    let loginWinRef; // login window ref
    let profileWinRef; // profile window ref
    let userWinRef; // user window ref
    let marketWinRef; // market window ref
    let parking; // ref for if the game is launching and the launcher is paused

    function createUserWindow() {
        userWinRef = new BrowserWindow({
            width: 300,
            height: 680,
            resizable: false,
            frame: false,
            transparent: true,
        });
        userWinRef.setResizable(false);
        userWinRef.loadURL(`${winURL}?window=user`);
        userWinRef.on('close', () => { userWinRef = undefined; });
        ipcMain.on('user/close', () => {
            userWinRef.close();
        });
    }
    function createLoginWindow() {
        loginWinRef = new BrowserWindow({
            width: 300,
            height: 480,
            resizable: false,
            frame: false,
            transparent: true,
        });
        loginWinRef.setResizable(false);
        loginWinRef.loadURL(`${winURL}?window=login`);
        loginWinRef.on('close', () => { loginWinRef = undefined; });
    }

    function createProfileWindow() {
        profileWinRef = new BrowserWindow({
            width: 700,
            height: 580,
            resizable: false,
            frame: false,
            transparent: true,
        });
        profileWinRef.setResizable(false);
        profileWinRef.loadURL(`${winURL}?window=profile`);
        profileWinRef.on('close', () => { profileWinRef = undefined; });
    }
    function createSettingWindow() {
        
    }

    createLoginWindow();
    // createUserWindow();
    // createProfileWindow();

    return {
        dispose() {
        },
    };
}
