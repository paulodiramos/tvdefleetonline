import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, XCircle, RefreshCw, 
  Trash2, Download, Calendar, User, FolderOpen
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import Layout from '../components/Layout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATAFORMAS = [
  { id: 'uber', nome: 'Uber Fleet', icone: '🚗', cor: 'bg-black' },
  { id: 'bolt', nome: 'Bolt Fleet', icone: '⚡', cor: 'bg-green-600' },
  { id: 'viaverde', nome: 'Via Verde', icone: '🛣️', cor: 'bg-emerald-600' },
  { id: 'prio_combustivel', nome: 'Prio Combustível', icone: '⛽', cor: 'bg-red-600' },
  { id: 'prio_eletrico', nome: 'Prio Elétrico', icone: '🔌', cor: 'bg-blue-600' }
];

export default function UploadFicheiros({ user, onLogout }) {
  const [ficheiros, setFicheiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processando, setProcessando] = useState(null);
  
  // Form state
  const [plataforma, setPlataforma] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [semana, setSemana] = useState('atual');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar motoristas
      const resMot = await fetch(`${API_URL}/api/motoristas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataMot = await resMot.json();
      if (Array.isArray(dataMot)) {
        setMotoristas(dataMot.filter(m => m.ativo !== false));
      }
      
      // Carregar ficheiros já enviados
      const resFiles = await fetch(`${API_URL}/api/uploads/ficheiros`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resFiles.ok) {
        const dataFiles = await resFiles.json();
        setFicheiros(dataFiles.ficheiros || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo
      const allowedTypes = ['.pdf', '.csv', '.xlsx', '.xls'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(ext)) {
        toast.error('Tipo de ficheiro não suportado. Use PDF, CSV ou Excel.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !plataforma || !motoristaId) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('plataforma', plataforma);
      formData.append('motorista_id', motoristaId);
      formData.append('semana', semana);
      
      const res = await fetch(`${API_URL}/api/uploads/ficheiro`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (data.sucesso) {
        toast.success('Ficheiro enviado com sucesso!');
        setSelectedFile(null);
        setPlataforma('');
        setMotoristaId('');
        // Reset file input
        document.getElementById('file-input').value = '';
        carregarDados();
      } else {
        toast.error(data.erro || 'Erro ao enviar ficheiro');
      }
    } catch (error) {
      toast.error('Erro ao enviar ficheiro');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const processarFicheiro = async (ficheiro) => {
    setProcessando(ficheiro.id);
    
    try {
      const res = await fetch(`${API_URL}/api/uploads/processar/${ficheiro.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      
      if (data.sucesso) {
        toast.success(`Dados importados para o Resumo Semanal!`);
        carregarDados();
      } else {
        toast.error(data.erro || 'Erro ao processar ficheiro');
      }
    } catch (error) {
      toast.error('Erro ao processar ficheiro');
      console.error(error);
    } finally {
      setProcessando(null);
    }
  };

  const eliminarFicheiro = async (ficheiro) => {
    if (!confirm('Tem a certeza que quer eliminar este ficheiro?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/uploads/ficheiro/${ficheiro.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        toast.success('Ficheiro eliminado');
        carregarDados();
      } else {
        toast.error('Erro ao eliminar');
      }
    } catch (error) {
      toast.error('Erro ao eliminar ficheiro');
    }
  };

  const getPlataformaInfo = (platId) => {
    return PLATAFORMAS.find(p => p.id === platId) || { nome: platId, icone: '📄', cor: 'bg-gray-600' };
  };

  const getMotoristaName = (motId) => {
    const mot = motoristas.find(m => m.id === motId);
    return mot?.name || mot?.nome || motId;
  };

  // Calcular semana atual e passada
  const now = new Date();
  const semanaAtual = getWeekNumber(now);
  const semanaPassada = semanaAtual - 1;
  const ano = now.getFullYear();

  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-6 h-6" />
              Upload de Ficheiros
            </h1>
            <p className="text-gray-400 mt-1">
              Faça upload dos relatórios PDF/CSV e importe automaticamente para o Resumo Semanal
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Formulário de Upload */}
            <div className="col-span-5">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Novo Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plataforma */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Plataforma</label>
                    <Select value={plataforma} onValueChange={setPlataforma}>
                      <SelectTrigger className="bg-gray-700 border-gray-600">
                        <SelectValue placeholder="Selecione a plataforma..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATAFORMAS.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span>{p.icone}</span>
                              {p.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Motorista */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Motorista</label>
                    <Select value={motoristaId} onValueChange={setMotoristaId}>
                      <SelectTrigger className="bg-gray-700 border-gray-600">
                        <SelectValue placeholder="Selecione o motorista..." />
                      </SelectTrigger>
                      <SelectContent>
                        {motoristas.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name || m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Semana */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Semana</label>
                    <Select value={semana} onValueChange={setSemana}>
                      <SelectTrigger className="bg-gray-700 border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atual">Semana Atual (S{semanaAtual}/{ano})</SelectItem>
                        <SelectItem value="passada">Semana Passada (S{semanaPassada}/{ano})</SelectItem>
                        <SelectItem value="anterior">2 Semanas Atrás (S{semanaPassada - 1}/{ano})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ficheiro */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Ficheiro (PDF, CSV, Excel)</label>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                      <input
                        id="file-input"
                        type="file"
                        accept=".pdf,.csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <label htmlFor="file-input" className="cursor-pointer">
                        {selectedFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-400">
                            <FileText className="w-5 h-5" />
                            <span>{selectedFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-gray-400">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <p>Clique para selecionar ficheiro</p>
                            <p className="text-xs">ou arraste e solte</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Botão Upload */}
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleUpload}
                    disabled={!selectedFile || !plataforma || !motoristaId || uploading}
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        A enviar...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar Ficheiro
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Info */}
              <Card className="bg-blue-900/30 border-blue-700 mt-4">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">💡 Como funciona:</h4>
                  <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Faça upload do PDF/CSV da plataforma</li>
                    <li>O ficheiro fica guardado na lista</li>
                    <li>Clique em "Sincronizar" para importar para o Resumo Semanal</li>
                    <li>Os dados são extraídos automaticamente do ficheiro</li>
                  </ol>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Ficheiros */}
            <div className="col-span-7">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Ficheiros Enviados
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={carregarDados}
                      disabled={loading}
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {ficheiros.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum ficheiro enviado</p>
                      <p className="text-sm">Faça upload de um ficheiro para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ficheiros.map(f => {
                        const platInfo = getPlataformaInfo(f.plataforma);
                        return (
                          <div 
                            key={f.id} 
                            className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 ${platInfo.cor} rounded-lg flex items-center justify-center text-lg`}>
                                {platInfo.icone}
                              </div>
                              <div>
                                <p className="font-medium text-white">{f.nome_ficheiro}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {getMotoristaName(f.motorista_id)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    S{f.semana}/{f.ano}
                                  </span>
                                  <span>{platInfo.nome}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {f.processado ? (
                                <span className="text-xs text-green-400 flex items-center gap-1 bg-green-900/30 px-2 py-1 rounded">
                                  <CheckCircle className="w-3 h-3" />
                                  Importado
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => processarFicheiro(f)}
                                  disabled={processando === f.id}
                                >
                                  {processando === f.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-1" />
                                      Sincronizar
                                    </>
                                  )}
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                onClick={() => eliminarFicheiro(f)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
