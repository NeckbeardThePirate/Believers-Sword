import { appConfig } from "./../../ElectronStore/Configuration";
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, screen } from "electron";

const MIN_SCALE = 0.75;
const MAX_SCALE = 1.5;

function normalizeScale(scale: number) {
    if (!Number.isFinite(scale)) return 1;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

const minimizeWindow = (win: any) => {
    win.minimize();
};

const maximizeWindow = (win: BrowserWindow): boolean | void => {
    try {
        if (win.isMaximized()) {
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            const appBounds: any = appConfig.get("setting.appBounds");

            if (appBounds !== undefined && appBounds !== null && appBounds.width > width && appBounds.height > height) {
                win.unmaximize();
                win.setSize(1180, 650, false);
                win.center();
            } else win.restore();
        } else win.maximize();
        return win.isMaximized();
    } catch (e) {
        console.log(e);
    }
};

const closeWindow = (win: BrowserWindow): void => {
    const appBounds = win.isNormal() ? win.getBounds() : win.getNormalBounds();
    appConfig.set('setting.appBounds', appBounds);
    appConfig.set('setting.isFullScreen', win.isFullScreen());
    win.destroy();
};

const getAppScale = (win: BrowserWindow): number => {
    const savedScale = Number(appConfig.get('setting.appScale', 1));
    const normalizedScale = normalizeScale(savedScale);

    if (savedScale !== normalizedScale) {
        appConfig.set('setting.appScale', normalizedScale);
    }

    if (win.webContents.getZoomFactor() !== normalizedScale) {
        win.webContents.setZoomFactor(normalizedScale);
    }

    return normalizedScale;
};

const setAppScale = (win: BrowserWindow, scale: number): number => {
    const normalizedScale = normalizeScale(scale);
    appConfig.set('setting.appScale', normalizedScale);
    win.webContents.setZoomFactor(normalizedScale);
    return normalizedScale;
};

const getWindowBounds = (win: BrowserWindow) => {
    return win.getBounds();
};

const setWindowPosition = (win: BrowserWindow, x: number, y: number) => {
    const currentBounds = win.getBounds();
    win.setPosition(Math.round(x), Math.round(y));
    return {
        ...currentBounds,
        x: Math.round(x),
        y: Math.round(y),
    };
};

export const windowBrowserEvents = (win: BrowserWindow) => {
    const getTargetWindow = (event: IpcMainInvokeEvent) =>
        BrowserWindow.fromWebContents(event.sender) || win;

    ipcMain.handle("minimizeWindow", (event) => minimizeWindow(getTargetWindow(event)));
    ipcMain.handle("maximizeWindow", (event) => maximizeWindow(getTargetWindow(event)));
    ipcMain.handle("closeWindow", (event) => closeWindow(getTargetWindow(event)));
    ipcMain.handle("isWindowBrowserMaximized", (event) => {
        return getTargetWindow(event).isMaximized();
    });
    ipcMain.handle('getAppScale', (event) => getAppScale(getTargetWindow(event)));
    ipcMain.handle('setAppScale', (event, scale: number) => setAppScale(getTargetWindow(event), scale));
    ipcMain.handle('getWindowBounds', (event) => getWindowBounds(getTargetWindow(event)));
    ipcMain.handle('setWindowPosition', (event, x: number, y: number) =>
        setWindowPosition(getTargetWindow(event), x, y)
    );
};
