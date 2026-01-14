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
  Filter, ChevronLeft, ChevronRight, Upload, CheckCircle
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
      const path = recibo.status_info.recibo_path.split('/').map(s => encodeURIComponent(s)).join('/');
      const response = await fetch(
        `${API}/api/vehicles/download/${path}`,
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

  const handleUploadComprovativo = async (motoristaId, file) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo', 'comprovativo_pagamento');
      
      await axios.post(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/upload-comprovativo?semana=${semana}&ano=${ano}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setShowUploadComprovativo(null);
      fetchRecibos();
      toast.success('Comprovativo de pagamento enviado!');
    } catch (error) {
      console.error('Erro ao enviar comprovativo:', error);
      toast.error('Erro ao enviar comprovativo');
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

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Arquivo de Recibos</h1>
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

        {/* Lista de Recibos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatórios e Recibos - Semana {semana}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">A carregar...</div>
            ) : recibos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum registo encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {recibos.map((recibo) => (
                  <div 
                    key={recibo.motorista_id}
                    className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">{recibo.motorista_nome}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Euro className="w-3 h-3" />
                              {formatCurrency(recibo.valor_liquido_motorista || 0)}
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
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Relatório
                          </Button>
                          
                          {/* Download Recibo (se existir) */}
                          {recibo.status_info.recibo_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadRecibo(recibo)}
                              title="Download Recibo"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Recibo
                            </Button>
                          )}
                          
                          {/* Download Comprovativo (se existir) */}
                          {recibo.status_info.comprovativo_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600"
                              title="Download Comprovativo de Pagamento"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Comprovativo
                            </Button>
                          )}
                          
                          {/* Upload Comprovativo (se liquidado e não tiver) */}
                          {recibo.status_info.status_aprovacao === 'liquidado' && !recibo.status_info.comprovativo_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowUploadComprovativo(recibo.motorista_id)}
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
                    {recibo.status_info.data_liquidacao && (
                      <div className="mt-2 pt-2 border-t text-xs text-slate-500">
                        Liquidado em: {new Date(recibo.status_info.data_liquidacao).toLocaleString('pt-PT')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Upload Comprovativo */}
      <Dialog open={showUploadComprovativo !== null} onOpenChange={() => setShowUploadComprovativo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Comprovativo de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              Envie o comprovativo de pagamento (transferência bancária, recibo, etc.)
            </p>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && showUploadComprovativo) {
                  handleUploadComprovativo(showUploadComprovativo, file);
                }
              }}
            />
            <p className="text-xs text-slate-500 mt-2">Formatos aceites: PDF, JPG, PNG</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadComprovativo(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ArquivoRecibos;
