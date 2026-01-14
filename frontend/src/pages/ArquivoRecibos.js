import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  FileText, Download, Eye, Calendar, User, Euro, 
  Filter, ChevronLeft, ChevronRight, Upload, CheckCircle,
  Archive, FileCheck, Receipt, CreditCard, Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ArquivoRecibos = ({ user, onLogout }) => {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [semana, setSemana] = useState(null);
  const [statusFilter, setStatusFilter] = useState('liquidado');
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [showUploadComprovativo, setShowUploadComprovativo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    // Calcular semana atual
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(currentWeek);
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchRecibos();
    }
  }, [semana, ano, statusFilter]);

  const fetchRecibos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Buscar status de relatórios
      const statusResponse = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/status?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Buscar resumo semanal para ter dados dos motoristas
      const resumoResponse = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const statusData = statusResponse.data;
      const motoristas = resumoResponse.data?.motoristas || [];
      
      // Combinar dados
      const recibosData = motoristas
        .map(m => ({
          ...m,
          status_info: statusData[m.motorista_id] || { status_aprovacao: 'pendente' }
        }))
        .filter(m => {
          if (statusFilter === 'todos') return true;
          return m.status_info.status_aprovacao === statusFilter;
        });
      
      setRecibos(recibosData);
    } catch (error) {
      console.error('Erro ao carregar recibos:', error);
      toast.error('Erro ao carregar arquivo de recibos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRelatorio = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/pdf?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${motoristaNome}_S${semana}_${ano}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório descarregado!');
    } catch (error) {
      console.error('Erro ao descarregar relatório:', error);
      toast.error('Erro ao descarregar relatório');
    }
  };

  const handleDownloadRecibo = async (recibo) => {
    if (!recibo.status_info?.recibo_path) {
      toast.error('Recibo não disponível');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const filename = recibo.status_info.recibo_path.split('/').pop();
      const response = await fetch(
        `${API}/api/files/recibos/${filename}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', recibo.status_info.recibo_filename || `recibo_${recibo.motorista_nome}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Recibo descarregado!');
    } catch (error) {
      console.error('Erro ao descarregar recibo:', error);
      toast.error('Erro ao descarregar recibo');
    }
  };

  const handleDownloadComprovativo = async (recibo) => {
    if (!recibo.status_info?.comprovativo_path) {
      toast.error('Comprovativo não disponível');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const filename = recibo.status_info.comprovativo_path.split('/').pop();
      const response = await fetch(
        `${API}/api/files/comprovativos/${filename}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', recibo.status_info.comprovativo_filename || `comprovativo_${recibo.motorista_nome}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Comprovativo descarregado!');
    } catch (error) {
      console.error('Erro ao descarregar comprovativo:', error);
      toast.error('Erro ao descarregar comprovativo');
    }
  };

  const handleUploadComprovativo = async (motoristaId) => {
    if (!selectedFile) {
      toast.error('Selecione um ficheiro');
      return;
    }

    setUploadingFile(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      await axios.post(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/upload-comprovativo?semana=${semana}&ano=${ano}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setShowUploadComprovativo(null);
      setSelectedFile(null);
      fetchRecibos();
      toast.success('Comprovativo de pagamento enviado!');
    } catch (error) {
      console.error('Erro ao enviar comprovativo:', error);
      toast.error('Erro ao enviar comprovativo');
    } finally {
      setUploadingFile(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pendente: 'bg-slate-100 text-slate-700',
      aprovado: 'bg-blue-100 text-blue-700',
      aguardar_recibo: 'bg-amber-100 text-amber-700',
      a_pagamento: 'bg-purple-100 text-purple-700',
      liquidado: 'bg-green-100 text-green-700'
    };
    const labels = {
      pendente: 'Pendente',
      aprovado: 'Aprovado',
      aguardar_recibo: 'Aguardar Recibo',
      a_pagamento: 'A Pagamento',
      liquidado: 'Liquidado'
    };
    return <Badge className={styles[status] || styles.pendente}>{labels[status] || status}</Badge>;
  };

  const getSemanaLabel = () => {
    if (!semana) return '';
    const startDate = new Date(ano, 0, 1 + (semana - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('pt-PT')} - ${endDate.toLocaleDateString('pt-PT')}`;
  };

  // Estatísticas
  const stats = {
    liquidados: recibos.filter(r => r.status_info.status_aprovacao === 'liquidado').length,
    total: recibos.length
  };

  const totalLiquidado = recibos
    .filter(r => r.status_info.status_aprovacao === 'liquidado')
    .reduce((sum, r) => {
      const liquido = (r.ganhos_uber || 0) + (r.uber_portagens || 0) + (r.ganhos_bolt || 0) 
        - (r.via_verde || 0) - (r.combustivel || 0) - (r.carregamento_eletrico || 0) 
        - (r.aluguer_veiculo || 0) - (r.extras || 0);
      return sum + liquido;
    }, 0);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Archive className="w-7 h-7" />
              Arquivo de Recibos
            </h1>
            <p className="text-slate-600">Consulte relatórios e recibos arquivados</p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Ano</Label>
                <Input 
                  type="number" 
                  value={ano} 
                  onChange={(e) => setAno(parseInt(e.target.value))}
                  className="w-24"
                />
              </div>
              <div>
                <Label>Semana</Label>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSemana(Math.max(1, semana - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Input 
                    type="number" 
                    value={semana || ''} 
                    onChange={(e) => setSemana(parseInt(e.target.value))}
                    className="w-16 text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSemana(Math.min(53, semana + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">{getSemanaLabel()}</p>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40 p-2 border rounded"
                  data-testid="status-filter"
                >
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="aguardar_recibo">Aguardar Recibo</option>
                  <option value="a_pagamento">A Pagamento</option>
                  <option value="liquidado">Liquidado</option>
                </select>
              </div>
              <Button onClick={fetchRecibos} variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-600">Liquidados</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{stats.liquidados}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-slate-600">Total Liquidado</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalLiquidado)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-600">Total Registos</span>
              </div>
              <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Recibos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Relatórios e Recibos - Semana {semana}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : recibos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum registo encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {recibos.map((recibo) => {
                  const liquido = (recibo.ganhos_uber || 0) + (recibo.uber_portagens || 0) + (recibo.ganhos_bolt || 0) 
                    - (recibo.via_verde || 0) - (recibo.combustivel || 0) - (recibo.carregamento_eletrico || 0) 
                    - (recibo.aluguer_veiculo || 0) - (recibo.extras || 0);
                  const hasRecibo = !!recibo.status_info?.recibo_path;
                  const hasComprovativo = !!recibo.status_info?.comprovativo_path;
                  
                  return (
                    <div 
                      key={recibo.motorista_id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                      data-testid={`arquivo-${recibo.motorista_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            recibo.status_info.status_aprovacao === 'liquidado' 
                              ? 'bg-green-100' 
                              : 'bg-slate-200'
                          }`}>
                            <User className={`w-5 h-5 ${
                              recibo.status_info.status_aprovacao === 'liquidado' 
                                ? 'text-green-600' 
                                : 'text-slate-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-medium">{recibo.motorista_nome}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <Euro className="w-3 h-3" />
                                <strong className={liquido >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatCurrency(liquido)}
                                </strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                S{semana}/{ano}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {getStatusBadge(recibo.status_info.status_aprovacao)}
                          
                          <div className="flex gap-2">
                            {/* Download Relatório */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadRelatorio(recibo.motorista_id, recibo.motorista_nome)}
                              title="Download Relatório PDF"
                              data-testid={`download-relatorio-${recibo.motorista_id}`}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Relatório
                            </Button>
                            
                            {/* Download Recibo (se existir) */}
                            {hasRecibo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadRecibo(recibo)}
                                title="Download Recibo"
                                data-testid={`download-recibo-${recibo.motorista_id}`}
                              >
                                <Receipt className="w-4 h-4 mr-1" />
                                Recibo
                              </Button>
                            )}
                            
                            {/* Download Comprovativo (se existir) */}
                            {hasComprovativo && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleDownloadComprovativo(recibo)}
                                title="Download Comprovativo de Pagamento"
                                data-testid={`download-comprovativo-${recibo.motorista_id}`}
                              >
                                <CreditCard className="w-4 h-4 mr-1" />
                                Comprovativo
                              </Button>
                            )}
                            
                            {/* Upload Comprovativo (se liquidado e não tiver) */}
                            {recibo.status_info.status_aprovacao === 'liquidado' && !hasComprovativo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowUploadComprovativo(recibo)}
                                title="Enviar Comprovativo de Pagamento"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Comprovativo
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Info adicional */}
                      <div className="mt-2 pt-2 border-t flex flex-wrap gap-4 text-xs text-slate-500">
                        {recibo.status_info.data_aprovacao && (
                          <span>Aprovado: {new Date(recibo.status_info.data_aprovacao).toLocaleDateString('pt-PT')}</span>
                        )}
                        {recibo.status_info.data_recibo_uploaded && (
                          <span>Recibo: {new Date(recibo.status_info.data_recibo_uploaded).toLocaleDateString('pt-PT')}</span>
                        )}
                        {recibo.status_info.data_liquidacao && (
                          <span className="text-green-600 font-medium">
                            Liquidado: {new Date(recibo.status_info.data_liquidacao).toLocaleDateString('pt-PT')}
                          </span>
                        )}
                      </div>
                      
                      {/* Indicadores de documentos */}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className={`flex items-center gap-1 ${hasRecibo ? 'text-green-600' : 'text-slate-400'}`}>
                          <Receipt className="w-3 h-3" />
                          Recibo {hasRecibo ? '✓' : '✗'}
                        </span>
                        <span className={`flex items-center gap-1 ${hasComprovativo ? 'text-green-600' : 'text-slate-400'}`}>
                          <CreditCard className="w-3 h-3" />
                          Comprovativo {hasComprovativo ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Upload Comprovativo */}
      <Dialog open={showUploadComprovativo !== null} onOpenChange={() => { setShowUploadComprovativo(null); setSelectedFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Enviar Comprovativo de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">Motorista:</p>
              <p className="font-semibold">{showUploadComprovativo?.motorista_nome}</p>
            </div>
            <div>
              <Label>Selecionar Ficheiro *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              {selectedFile && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {selectedFile.name}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">Formatos aceites: PDF, JPG, PNG</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadComprovativo(null); setSelectedFile(null); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleUploadComprovativo(showUploadComprovativo?.motorista_id)}
              disabled={uploadingFile || !selectedFile}
            >
              {uploadingFile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Comprovativo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ArquivoRecibos;
