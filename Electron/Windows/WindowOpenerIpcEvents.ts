import { ipcMain, BrowserWindow } from 'electron';
import { isDev, isNightly } from './../config';

export const WindowOpenerIpcEvents = (win: BrowserWindow) => {
    ipcMain.handle('open-donate-window', (event, payload) => {
        const { BrowserWindow, screen } = require('electron');
        const path = require('path');

        // Get the primary screen's dimensions
        const primaryDisplay = screen.getPrimaryDisplay();
        const { height } = primaryDisplay.workAreaSize; // Gets usable height (excluding taskbars/docks)

        // Calculate 70% of the height
        const windowHeight = Math.round(height * 0.7);
        let iconPath = path.join(__dirname, 'assets', 'icon.ico');

        if (isDev || isNightly) iconPath = path.join('assets', 'icon.ico');

        const win = new BrowserWindow({
            width: 700,
            height: windowHeight,
            autoHideMenuBar: true, // Hides the menu bar
            resizable: false,
            icon: iconPath, // Path to your icon
            webPreferences: {
                nodeIntegration: false, // If you need Node.js integration
            },
        });

        win.loadURL('https://buymeacoffee.com/jenuel.dev');
    });

    ipcMain.handle('open-chapter-popout', async (event, payload) => {
        const { screen } = require('electron');
        const path = require('path');

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        let iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');

        if (isDev || isNightly) iconPath = path.join('assets', 'icon.ico');

        const popoutWindow = new BrowserWindow({
            width: Math.min(1100, Math.round(width * 0.75)),
            height: Math.min(900, Math.round(height * 0.9)),
            minWidth: 420,
            minHeight: 500,
            frame: false,
            autoHideMenuBar: true,
            title: payload?.title || 'Chapter Popout',
            icon: iconPath,
            webPreferences: {
                preload: path.join(__dirname, '..', 'preload.js'),
                devTools: isDev || isNightly,
            },
            show: false,
        });

        const query = new URLSearchParams({
            bookNumber: String(payload?.bookNumber ?? ''),
            chapter: String(payload?.chapter ?? ''),
            title: String(payload?.title ?? ''),
            versions: encodeURIComponent(JSON.stringify(payload?.versions ?? [])),
        });

        const routeUrl = isDev
            ? `http://localhost:3000/#/chapter-popout?${query.toString()}`
            : `file://${path.join(__dirname, './index.html')}#/chapter-popout?${query.toString()}`;

        popoutWindow.once('ready-to-show', () => popoutWindow.show());
        await popoutWindow.loadURL(routeUrl);
        if (!popoutWindow.isVisible()) popoutWindow.show();
    });
};
