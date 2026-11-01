// Electron-Hülle mit GitHub-Auto-Updates für Haus Vesper.
const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#090807',
    title: 'Haus Vesper',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Updates funktionieren nur in der installierten, gepackten Windows-Version.
  if (app.isPackaged && process.platform === 'win32') {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Haus Vesper – Update bereit',
        message: 'Ein Update wurde heruntergeladen. Haus Vesper wird beim Beenden aktualisiert.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('Updater-Fehler:', error);
    });

    // Prüft beim Start, ob es eine neuere GitHub-Release gibt.
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('Update-Prüfung fehlgeschlagen:', error);
    });
  }
});

app.on('window-all-closed', () => app.quit());
