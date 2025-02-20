const { contextBridge, ipcRenderer } = require("electron");

// Base URL da API Django
const BASE_URL = "http://localhost:3001/executavel";
const API_PERFIL = `${BASE_URL}/perfil_demanda_api/`;
const API_CRIAR = `${BASE_URL}/criar_demanda_api/`;
const API_LISTAR = `${BASE_URL}/listar_demanda_api/`;

// Obtém o usuário do sistema e armazena no sessionStorage
async function obterUsuario() {
  let usuarioNome = sessionStorage.getItem("usuario_nome");

  if (!usuarioNome) {
    usuarioNome = await new Promise((resolve) => {
      ipcRenderer.once("response-os-user", (_, username) => {
        resolve(username);
      });
      ipcRenderer.send("request-os-user");
    });

    sessionStorage.setItem("usuario_nome", usuarioNome);
  }

  console.log(`[Preload] Usuário obtido: ${usuarioNome}`);
  return usuarioNome;
}

// Expondo funções para o renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  setUser: async () => {
    const usuarioNome = await obterUsuario();
    sessionStorage.setItem("usuario_nome", usuarioNome);
  },

  getUser: () => sessionStorage.getItem("usuario_nome"),

  goToPerfil: async () => {
    const usuarioNome = await obterUsuario();
    ipcRenderer.send("go-to-perfil");
  },

  goToCriar: async () => {
    const usuarioNome = await obterUsuario();
    ipcRenderer.send("go-to-criar");
  },

  goToAcompanhar: async () => {
    const usuarioNome = await obterUsuario();
    ipcRenderer.send("go-to-acompanhar");
  },

  criarDemandaApi: async (payload) => {
    try {
      const usuarioNome = await obterUsuario();
      console.log(`[Preload] Enviando criação de demanda para usuário: ${usuarioNome}`);

      const response = await fetch(API_CRIAR, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Usuario-Nome": usuarioNome,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("[Preload] Erro ao criar demanda:", error);
      throw error;
    }
  },

  listarDemandaApi: async () => {
    try {
      const usuarioNome = await obterUsuario();
      console.log(`[Preload] Listando demandas para usuário: ${usuarioNome}`);

      const response = await fetch(API_LISTAR, {
        method: "GET",
        headers: {
          "Usuario-Nome": usuarioNome,
        },
        credentials: "include",
      });

      if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("[Preload] Erro ao listar demandas:", error);
      throw error;
    }
  },

  obterPerfilApi: async () => {
    try {
      const usuarioNome = await obterUsuario();
      console.log(`[Preload] Obtendo perfil do usuário: ${usuarioNome}`);

      const response = await fetch(API_PERFIL, {
        method: "GET",
        headers: {
          "Usuario-Nome": usuarioNome,
        },
        credentials: "include",
      });

      if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("[Preload] Erro ao obter perfil:", error);
      throw error;
    }
  },
});

// Ao carregar o Electron, já obtém e armazena o usuário
(async () => {
  await obterUsuario();
})();
