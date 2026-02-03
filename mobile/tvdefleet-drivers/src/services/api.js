import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, REQUEST_TIMEOUT } from '../config';

// Criar instância do axios
const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado - limpar storage
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Ponto Services (Relógio de Ponto)
export const pontoService = {
  // Registar check-in
  checkIn: async (data) => {
    const response = await api.post('/ponto/check-in', data);
    return response.data;
  },
  
  // Registar check-out
  checkOut: async (data) => {
    const response = await api.post('/ponto/check-out', data);
    return response.data;
  },
  
  // Registar pausa
  registarPausa: async (data) => {
    const response = await api.post('/ponto/pausa', data);
    return response.data;
  },
  
  // Obter estado atual
  getEstadoAtual: async () => {
    const response = await api.get('/ponto/estado-atual');
    return response.data;
  },
  
  // Obter histórico
  getHistorico: async (dataInicio, dataFim) => {
    const response = await api.get('/ponto/historico', {
      params: { data_inicio: dataInicio, data_fim: dataFim }
    });
    return response.data;
  },
  
  // Obter resumo semanal
  getResumoSemanal: async () => {
    const response = await api.get('/ponto/resumo-semanal');
    return response.data;
  },
};

// Documentos Services
export const documentosService = {
  // Upload documento
  upload: async (formData) => {
    const response = await api.post('/documentos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Listar documentos
  listar: async (tipo = null) => {
    const response = await api.get('/documentos/meus', {
      params: tipo ? { tipo } : {}
    });
    return response.data;
  },
  
  // Eliminar documento
  eliminar: async (documentoId) => {
    const response = await api.delete(`/documentos/${documentoId}`);
    return response.data;
  },
};

// Vistoria Services
export const vistoriaService = {
  // Criar vistoria
  criar: async (data) => {
    const response = await api.post('/vistorias', data);
    return response.data;
  },
  
  // Upload foto da vistoria
  uploadFoto: async (vistoriaId, formData) => {
    const response = await api.post(`/vistorias/${vistoriaId}/fotos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Registar dano
  registarDano: async (vistoriaId, data) => {
    const response = await api.post(`/vistorias/${vistoriaId}/danos`, data);
    return response.data;
  },
  
  // Finalizar vistoria
  finalizar: async (vistoriaId, assinatura) => {
    const response = await api.post(`/vistorias/${vistoriaId}/finalizar`, { assinatura });
    return response.data;
  },
  
  // Listar vistorias
  listar: async () => {
    const response = await api.get('/vistorias/minhas');
    return response.data;
  },
  
  // Obter vistoria por ID
  getById: async (vistoriaId) => {
    const response = await api.get(`/vistorias/${vistoriaId}`);
    return response.data;
  },
};

// Veículos Services
export const veiculosService = {
  // Listar veículos do parceiro
  listar: async () => {
    const response = await api.get('/veiculos');
    return response.data;
  },
  
  // Obter veículo atribuído ao motorista
  getMeuVeiculo: async () => {
    const response = await api.get('/veiculos/meu');
    return response.data;
  },
};

export default api;
