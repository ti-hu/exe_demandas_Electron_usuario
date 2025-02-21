const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");

const path = require('path');
const os = require('os');
const axios = require('axios');
const { dialog } = require('electron');
const fs = require('fs');

// URLs da API Django
const BASE_URL = 'http://172.16.3.66:3001/executavel';

// const BASE_URL = 'http://localhost:3001/executavel';
const API_PERFIL = `${BASE_URL}/perfil_demanda_api/`;
const API_CRIAR = `${BASE_URL}/criar_demanda_api/`;
const API_LISTAR = `${BASE_URL}/listar_demanda_api/`;

let mainWindow;

// Função para obter o usuário do sistema operacional
function getSystemUser() {
  return os.userInfo().username;
}

function createWindow() {
  console.log('[Main] Criando a janela principal...');
  nativeTheme.themeSource = 'dark';
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:mySession',
    }
  });

  const username = getSystemUser();
  console.log(`[Main] Usuário do SO detectado: ${username}`);

  // Adiciona o cabeçalho "Usuario-Nome" para todas as requisições que coincidam com BASE_URL
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: [`${BASE_URL}/*`] },
    (details, callback) => {
      details.requestHeaders['Usuario-Nome'] = username;
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Carrega a URL inicial com o header extra
  mainWindow.loadURL(API_CRIAR, {
    extraHeaders: `Usuario-Nome: ${username}`
  });

  // Exibe o conteúdo do <head> no console do renderer após o carregamento
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      'console.log("Conteúdo do head:", document.head.innerHTML);'
    );
  });

  // Exemplo de verificação de cookies (como o csrftoken)
  mainWindow.webContents.session.cookies.get({ name: 'csrftoken' })
    .then((cookies) => {
      console.log('Cookies CSRF:', cookies);
    });

  mainWindow.on('closed', () => {
    console.log('[Main] mainWindow foi fechada!');
    mainWindow = null;
  });
}

// Listener para responder ao pedido do usuário do sistema
ipcMain.on('request-os-user', (event) => {
  event.reply('response-os-user', getSystemUser());
});

// ---------- IPC: Navegação ----------
ipcMain.on('go-to-perfil', async () => {
  console.log('[Main] Navegando para Perfil...');
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_PERFIL, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

ipcMain.on('go-to-criar', async () => {
  console.log('[Main] Navegando para Criar Demanda...');
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_CRIAR, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

ipcMain.on('go-to-acompanhar', async () => {
  console.log('[Main] Navegando para Acompanhar Demandas...');
  const username = getSystemUser();
  if (mainWindow) {
    mainWindow.loadURL(API_LISTAR, {
      extraHeaders: `Usuario-Nome: ${username}`
    });
  }
});

// ---------- IPC: Criar Demanda ----------
ipcMain.on('create-demand', async (event, demanda) => {
  try {
    const username = getSystemUser();
    console.log(`[Main] Criando demanda para usuário: ${username}`);
    
    const response = await axios.post(API_CRIAR, demanda, {
      headers: { 'Usuario-Nome': username }
    });

    console.log('[Main] Demanda criada com sucesso!', response.data);
    event.reply('demand-created', response.data);
  } catch (error) {
    console.error('[Main] Erro ao criar demanda:', error.message);
    event.reply('demand-create-error', error.message);
  }
});

// ---------- IPC: Salvar Arquivo ----------
ipcMain.on('save-file', async (event, fileContent, fileName = 'arquivo', fileType = 'txt') => {
  const options = {
    title: 'Salvar Arquivo',
    defaultPath: path.join(app.getPath('desktop'), `${fileName}.${fileType}`),
    buttonLabel: 'Salvar',
    filters: [
      { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
      { name: 'Arquivos de Texto', extensions: ['txt', 'log', 'csv'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  };

  const { filePath } = await dialog.showSaveDialog(mainWindow, options);

  if (filePath) {
    let dataToWrite = fileContent;
    if (['png', 'jpg', 'jpeg', 'gif'].includes(fileType)) {
      dataToWrite = Buffer.from(fileContent, 'base64');
    }
    fs.writeFile(filePath, dataToWrite, (err) => {
      if (err) {
        console.error('[Main] Erro ao salvar arquivo:', err);
        event.reply('file-save-error', err.message);
      } else {
        console.log('[Main] Arquivo salvo com sucesso:', filePath);
        event.reply('file-saved', filePath);
      }
    });
  } else {
    event.reply('file-save-cancelled');
  }
});

// ---------- Ciclo de vida do app ----------
app.on('ready', () => {
  console.log('[Main] App está pronto. Criando janela...');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('[Main] Todas as janelas fechadas.');
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  console.log('[Main] Reabrindo janela no macOS...');
  if (mainWindow === null) createWindow();
});
