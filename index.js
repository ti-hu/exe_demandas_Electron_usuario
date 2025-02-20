const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");

const path = require('path');
const os = require('os');
const axios = require('axios');

// URLs da API Django
const BASE_URL = 'http://localhost:3001/executavel';
const API_PERFIL = `${BASE_URL}/perfil_demanda_api/`;
const API_CRIAR = `${BASE_URL}/criar_demanda_api/`;
const API_LISTAR = `${BASE_URL}/listar_demanda_api/`;

let mainWindow;

function getSystemUser() {
  return os.userInfo().username;
}

function createWindow() {
  console.log('[Main] Criando a janela principal...');
  nativeTheme.themeSource = 'dark';
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, 'assets', 'icon.ico'), // coloque seu ícone aqui
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:mySession',
    }
  });

  const username = getSystemUser();
  console.log(`[Main] Usuário do SO detectado: ${username}`);

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: [`${BASE_URL}/*`] },
    (details, callback) => {
      details.requestHeaders['Usuario-Nome'] = username;
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  mainWindow.loadURL(API_CRIAR, {
    extraHeaders: `Usuario-Nome: ${username}`
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      'console.log("Conteúdo do head:", document.head.innerHTML);'
    );
  });

  mainWindow.webContents.session.cookies.get({ name: 'csrftoken' })
    .then((cookies) => {
      console.log('Cookies CSRF:', cookies);
    });

  mainWindow.on('closed', () => {
    console.log('[Main] mainWindow foi fechada!');
    mainWindow = null;
  });
}

ipcMain.on('go-to-perfil', async () => {
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_PERFIL, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

ipcMain.on('go-to-criar', async () => {
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_CRIAR, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

ipcMain.on('go-to-acompanhar', async () => {
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_LISTAR, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

ipcMain.on('create-demand', async (event, demanda) => {
  try {
    const username = getSystemUser();
    const response = await axios.post(API_CRIAR, demanda, {
      headers: { 'Usuario-Nome': username }
    });
    event.reply('demand-created', response.data);
  } catch (error) {
    event.reply('demand-create-error', error.message);
  }
});

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
