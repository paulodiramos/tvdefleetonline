import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, XCircle, RefreshCw, 
  Trash2, Calendar, User, FolderOpen, Eye, Link2,
  DollarSign, Car, Fuel, CreditCard, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import Layout from '../components/Layout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATAFORMAS = [
  { id: 'uber', nome: 'Uber Fleet', icone: '🚗', cor: 'bg-black', campos: ['ganhos', 'viagens', 'gorjetas', 'bonus'] },
  { id: 'bolt', nome: 'Bolt Fleet', icone: '⚡', cor: 'bg-green-600', campos: ['ganhos', 'viagens', 'gorjetas', 'bonus'] },
  { id: 'viaverde', nome: 'Via Verde', icone: '🛣️', cor: 'bg-emerald-600', campos: ['portagens'] },
  { id: 'prio_combustivel', nome: 'Prio Combustível', icone: '⛽', cor: 'bg-red-600', campos: ['litros', 'valor'] },
  { id: 'prio_eletrico', nome: 'Prio Elétrico', icone: '🔌', cor: 'bg-blue-600', campos: ['kwh', 'valor'] }
];

export default function ImportarDados({ user, onLogout }) {
  const [ficheiros, setFicheiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processando, setProcessando] = useState(null);
  
  // Form state
  const [plataforma, setPlataforma] = useState('');
  const [semana, setSemana] = useState('passada');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [motoristaAssociado, setMotoristaAssociado] = useState('');
  
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
      const resFiles = await fetch(`${API_URL}/api/importacao/ficheiros`, {
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
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!['.pdf', '.csv', '.xlsx', '.xls'].includes(ext)) {
        toast.error('Tipo de ficheiro não suportado. Use PDF, CSV ou Excel.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndPreview = async () => {
    if (!selectedFile || !plataforma) {
      toast.error('Selecione plataforma e ficheiro');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('plataforma', plataforma);
      formData.append('semana', semana);
      
      const res = await fetch(`${API_URL}/api/importacao/upload-preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (data.sucesso) {
        setPreviewData(data);
        setMotoristaAssociado(data.motorista_sugerido || '');
        setShowPreview(true);
      } else {
        toast.error(data.erro || 'Erro ao processar ficheiro');
      }
    } catch (error) {
      toast.error('Erro ao enviar ficheiro');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const confirmarImportacao = async () => {
    if (!motoristaAssociado) {
      toast.error('Selecione um motorista');
      return;
    }
    
    setProcessando('preview');
    
    try {
      const res = await fetch(`${API_URL}/api/importacao/confirmar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: previewData.file_id,
          motorista_id: motoristaAssociado,
          dados: previewData.dados,
          plataforma: plataforma,
          semana: previewData.semana,
          ano: previewData.ano
        })
      });
      
      const data = await res.json();
      
      if (data.sucesso) {
        toast.success(`Dados importados para o Resumo Semanal!`);
        setShowPreview(false);
        setSelectedFile(null);
        setPlataforma('');
        setPreviewData(null);
        document.getElementById('file-input').value = '';
        carregarDados();
      } else {
        toast.error(data.erro || 'Erro ao importar');
      }
    } catch (error) {
      toast.error('Erro ao importar dados');
      console.error(error);
    } finally {
      setProcessando(null);
    }
  };

  const reprocessarFicheiro = async (ficheiro) => {
    setProcessando(ficheiro.id);
    
    try {
      const res = await fetch(`${API_URL}/api/importacao/reprocessar/${ficheiro.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.sucesso) {
        toast.success('Dados atualizados no Resumo Semanal!');
        carregarDados();
      } else {
        toast.error(data.erro || 'Erro ao reprocessar');
      }
    } catch (error) {
      toast.error('Erro ao reprocessar');
    } finally {
      setProcessando(null);
    }
  };

  const eliminarFicheiro = async (ficheiro) => {
    if (!confirm('Eliminar este ficheiro?')) return;
    
    try {
      await fetch(`${API_URL}/api/importacao/ficheiro/${ficheiro.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Ficheiro eliminado');
      carregarDados();
    } catch (error) {
      toast.error('Erro ao eliminar');
    }
  };

  const getPlataformaInfo = (platId) => {
    return PLATAFORMAS.find(p => p.id === platId) || { nome: platId, icone: '📄', cor: 'bg-gray-600' };
  };

  const getMotoristaName = (motId) => {
    const mot = motoristas.find(m => m.id === motId);
    return mot?.name || mot?.nome || 'N/A';
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-';
    return `€${parseFloat(val).toFixed(2)}`;
  };

  // Calcular semanas
  const now = new Date();
  const semanaAtual = getWeekNumber(now);
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-6 h-6" />
              Importar Dados
            </h1>
            <p className="text-gray-400 mt-1">
              Importe ficheiros da Uber, Bolt, Via Verde e Prio para o Resumo Semanal
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Formulário de Upload */}
            <div className="col-span-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    1. Upload Ficheiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plataforma */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Plataforma</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATAFORMAS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setPlataforma(p.id)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            plataforma === p.id 
                              ? 'border-blue-500 bg-blue-900/30' 
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="text-2xl mb-1">{p.icone}</div>
                          <div className="text-xs text-gray-300">{p.nome}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Semana */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Semana</label>
                    <Select value={semana} onValueChange={setSemana}>
                      <SelectTrigger className="bg-gray-700 border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atual">Semana Atual (S{semanaAtual})</SelectItem>
                        <SelectItem value="passada">Semana Passada (S{semanaAtual - 1})</SelectItem>
                        <SelectItem value="anterior">2 Semanas Atrás (S{semanaAtual - 2})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ficheiro */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Ficheiro</label>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
                      <input
                        id="file-input"
                        type="file"
                        accept=".pdf,.csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <label htmlFor="file-input" className="cursor-pointer block">
                        {selectedFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-400">
                            <FileText className="w-5 h-5" />
                            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-gray-400">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">Clique para selecionar</p>
                            <p className="text-xs">PDF, CSV ou Excel</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Botão */}
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleUploadAndPreview}
                    disabled={!selectedFile || !plataforma || uploading}
                  >
                    {uploading ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A processar...</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" /> Ver Preview e Associar</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Info */}
              <Card className="bg-yellow-900/30 border-yellow-700 mt-4">
                <CardContent className="pt-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-semibold mb-1">Como obter os ficheiros:</p>
                      <ul className="text-xs space-y-1 text-yellow-300">
                        <li>• <b>Uber</b>: Relatórios → Gerar → Download</li>
                        <li>• <b>Bolt</b>: Pagamentos → Exportar</li>
                        <li>• <b>Via Verde</b>: Extratos → Download PDF</li>
                        <li>• <b>Prio</b>: Histórico → Exportar</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Importações */}
            <div className="col-span-8">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Importações Recentes
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {ficheiros.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">Nenhuma importação</p>
                      <p className="text-sm">Faça upload de um ficheiro para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ficheiros.map(f => {
                        const platInfo = getPlataformaInfo(f.plataforma);
                        return (
                          <div 
                            key={f.id} 
                            className="bg-gray-700/50 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className={`w-12 h-12 ${platInfo.cor} rounded-lg flex items-center justify-center text-xl`}>
                                  {platInfo.icone}
                                </div>
                                <div>
                                  <p className="font-medium text-white">{f.nome_ficheiro}</p>
                                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {getMotoristaName(f.motorista_id)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      S{f.semana}/{f.ano}
                                    </span>
                                  </div>
                                  
                                  {/* Dados importados */}
                                  {f.dados_extraidos && (
                                    <div className="flex gap-4 mt-2 text-xs">
                                      {f.dados_extraidos.ganhos_liquidos !== undefined && (
                                        <span className="text-green-400">
                                          💰 {formatCurrency(f.dados_extraidos.ganhos_liquidos)}
                                        </span>
                                      )}
                                      {f.dados_extraidos.viagens !== undefined && (
                                        <span className="text-blue-400">
                                          🚗 {f.dados_extraidos.viagens} viagens
                                        </span>
                                      )}
                                      {f.dados_extraidos.total_portagens !== undefined && (
                                        <span className="text-yellow-400">
                                          🛣️ {formatCurrency(f.dados_extraidos.total_portagens)}
                                        </span>
                                      )}
                                      {f.dados_extraidos.total_valor !== undefined && (
                                        <span className="text-red-400">
                                          ⛽ {formatCurrency(f.dados_extraidos.total_valor)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {f.sincronizado ? (
                                  <span className="text-xs text-green-400 flex items-center gap-1 bg-green-900/30 px-2 py-1 rounded">
                                    <CheckCircle className="w-3 h-3" />
                                    Sincronizado
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => reprocessarFicheiro(f)}
                                    disabled={processando === f.id}
                                  >
                                    {processando === f.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <><Link2 className="w-4 h-4 mr-1" /> Sincronizar</>
                                    )}
                                  </Button>
                                )}
                                
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => eliminarFicheiro(f)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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

      {/* Modal Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview dos Dados - {getPlataformaInfo(plataforma).nome}
            </DialogTitle>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4">
              {/* Dados extraídos */}
              <Card className="bg-gray-700/50 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Dados Extraídos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {previewData.dados?.ganhos_liquidos !== undefined && (
                      <div className="bg-green-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                          <DollarSign className="w-4 h-4" /> Ganhos Líquidos
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(previewData.dados.ganhos_liquidos)}
                        </div>
                      </div>
                    )}
                    {previewData.dados?.viagens !== undefined && (
                      <div className="bg-blue-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                          <Car className="w-4 h-4" /> Viagens
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {previewData.dados.viagens}
                        </div>
                      </div>
                    )}
                    {previewData.dados?.gorjetas !== undefined && previewData.dados.gorjetas > 0 && (
                      <div className="bg-purple-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                          <CreditCard className="w-4 h-4" /> Gorjetas
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(previewData.dados.gorjetas)}
                        </div>
                      </div>
                    )}
                    {previewData.dados?.total_portagens !== undefined && (
                      <div className="bg-yellow-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                          🛣️ Portagens
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(previewData.dados.total_portagens)}
                        </div>
                      </div>
                    )}
                    {previewData.dados?.total_valor !== undefined && (
                      <div className="bg-red-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                          <Fuel className="w-4 h-4" /> Valor Total
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(previewData.dados.total_valor)}
                        </div>
                      </div>
                    )}
                    {previewData.dados?.total_litros !== undefined && previewData.dados.total_litros > 0 && (
                      <div className="bg-orange-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-orange-400 text-sm mb-1">
                          ⛽ Litros
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {previewData.dados.total_litros.toFixed(1)} L
                        </div>
                      </div>
                    )}
                    {previewData.dados?.total_kwh !== undefined && previewData.dados.total_kwh > 0 && (
                      <div className="bg-cyan-900/30 p-3 rounded">
                        <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
                          🔌 kWh
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {previewData.dados.total_kwh.toFixed(1)} kWh
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Associar a motorista */}
              <Card className="bg-gray-700/50 border-gray-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    2. Associar a Motorista
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={motoristaAssociado} onValueChange={setMotoristaAssociado}>
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
                  
                  <div className="mt-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Semana {previewData.semana}/{previewData.ano}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Botões */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPreview(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={confirmarImportacao}
                  disabled={!motoristaAssociado || processando === 'preview'}
                >
                  {processando === 'preview' ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A importar...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar e Importar</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
