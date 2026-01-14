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
  FileText, Download, Upload, Calendar, User, Euro, 
  Filter, ChevronLeft, ChevronRight, CheckCircle, Clock, 
  CreditCard, Eye, Loader2, Wallet, BanknoteIcon
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PagamentosParceiro = ({ user, onLogout }) => {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [semana, setSemana] = useState(null);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showConfirmLiquidar, setShowConfirmLiquidar] = useState(null);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(currentWeek);
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchPagamentos();
    }
  }, [semana, ano]);

  const fetchPagamentos = async () => {
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
      
      // Combinar dados e filtrar apenas status "a_pagamento"
      const pagamentosData = motoristas
        .map(m => ({
          ...m,
          status_info: statusData[m.motorista_id] || { status_aprovacao: 'pendente' }
        }))
        .filter(m => m.status_info.status_aprovacao === 'a_pagamento');
      
      setPagamentos(pagamentosData);
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
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
      
      setShowUploadModal(null);
      setSelectedFile(null);
      toast.success('Comprovativo enviado com sucesso!');
      
      // Perguntar se quer marcar como liquidado
      setShowConfirmLiquidar({ motorista_id: motoristaId, motorista_nome: showUploadModal?.motorista_nome });
    } catch (error) {
      console.error('Erro ao enviar comprovativo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar comprovativo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleMarcarLiquidado = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/status`,
        { status: 'liquidado', semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowConfirmLiquidar(null);
      fetchPagamentos();
      toast.success('Pagamento marcado como liquidado! Relatório arquivado.');
    } catch (error) {
      console.error('Erro ao marcar como liquidado:', error);
      toast.error('Erro ao marcar como liquidado');
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

  const handleDownloadRecibo = async (pagamento) => {
    if (!pagamento.status_info?.recibo_path) {
      toast.error('Recibo não disponível');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      // Extrair apenas o nome do ficheiro do path
      const filename = pagamento.status_info.recibo_path.split('/').pop();
      const response = await fetch(
        `${API}/api/files/recibos/${filename}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', pagamento.status_info.recibo_filename || `recibo_${pagamento.motorista_nome}.pdf`);
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const getSemanaLabel = () => {
    if (!semana) return '';
    const startDate = new Date(ano, 0, 1 + (semana - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('pt-PT')} - ${endDate.toLocaleDateString('pt-PT')}`;
  };

  // Calcular totais
  const totalAPagar = pagamentos.reduce((sum, p) => {
    const liquido = (p.ganhos_uber || 0) + (p.uber_portagens || 0) + (p.ganhos_bolt || 0) 
      - (p.via_verde || 0) - (p.combustivel || 0) - (p.carregamento_eletrico || 0) 
      - (p.aluguer_veiculo || 0) - (p.extras || 0);
    return sum + liquido;
  }, 0);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pagamentos a Parceiro</h1>
            <p className="text-slate-600">Relatórios aprovados prontos para pagamento</p>
          </div>
          <Badge className="bg-purple-100 text-purple-700 text-lg px-4 py-2">
            {pagamentos.length} a pagar
          </Badge>
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
              <Button onClick={fetchPagamentos} variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-slate-600">A Pagamento</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{pagamentos.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-600">Total a Transferir</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalAPagar)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-600">Período</span>
              </div>
              <p className="text-lg font-bold text-slate-700">S{semana}/{ano}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Pagamentos Pendentes - Semana {semana}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : pagamentos.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum pagamento pendente!</h3>
                <p className="text-slate-600">
                  Não há relatórios a aguardar pagamento nesta semana.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pagamentos.map((pagamento) => {
                  const liquido = (pagamento.ganhos_uber || 0) + (pagamento.uber_portagens || 0) + (pagamento.ganhos_bolt || 0) 
                    - (pagamento.via_verde || 0) - (pagamento.combustivel || 0) - (pagamento.carregamento_eletrico || 0) 
                    - (pagamento.aluguer_veiculo || 0) - (pagamento.extras || 0);
                  
                  const hasRecibo = !!pagamento.status_info?.recibo_path;
                  const hasComprovativo = !!pagamento.status_info?.comprovativo_path;
                  
                  return (
                    <div 
                      key={pagamento.motorista_id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                      data-testid={`pagamento-${pagamento.motorista_id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{pagamento.motorista_nome}</h3>
                            <div className="flex items-center gap-3 text-sm mt-1">
                              <span className="flex items-center gap-1 text-purple-700 font-semibold">
                                <BanknoteIcon className="w-4 h-4" />
                                A Pagar: {formatCurrency(liquido)}
                              </span>
                            </div>
                            {pagamento.status_info.data_recibo_uploaded && (
                              <p className="text-xs text-slate-500 mt-1">
                                Recibo recebido em: {new Date(pagamento.status_info.data_recibo_uploaded).toLocaleString('pt-PT')}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className="bg-purple-100 text-purple-700">A Pagamento</Badge>
                          
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadRelatorio(pagamento.motorista_id, pagamento.motorista_nome)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Relatório
                            </Button>
                            
                            {hasRecibo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadRecibo(pagamento)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Recibo
                              </Button>
                            )}
                            
                            {!hasComprovativo ? (
                              <Button
                                size="sm"
                                onClick={() => setShowUploadModal(pagamento)}
                                className="bg-purple-600 hover:bg-purple-700"
                                data-testid={`upload-comprovativo-${pagamento.motorista_id}`}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Enviar Comprovativo
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => setShowConfirmLiquidar(pagamento)}
                                className="bg-green-600 hover:bg-green-700"
                                data-testid={`liquidar-${pagamento.motorista_id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Marcar Liquidado
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Documentos disponíveis */}
                      <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs">
                        <span className={`flex items-center gap-1 ${hasRecibo ? 'text-green-600' : 'text-slate-400'}`}>
                          {hasRecibo ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          Recibo {hasRecibo ? '✓' : 'pendente'}
                        </span>
                        <span className={`flex items-center gap-1 ${hasComprovativo ? 'text-green-600' : 'text-slate-400'}`}>
                          {hasComprovativo ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          Comprovativo {hasComprovativo ? '✓' : 'pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <h4 className="font-semibold text-purple-800 mb-2">💳 Fluxo de Aprovação</h4>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="bg-slate-100 text-slate-700">Pendente</Badge>
              <span>→</span>
              <Badge className="bg-blue-100 text-blue-700">Aprovado</Badge>
              <span>→</span>
              <Badge className="bg-amber-100 text-amber-700">Aguardar Recibo</Badge>
              <span>→</span>
              <Badge className="bg-purple-100 text-purple-700">A Pagamento ← Está aqui</Badge>
              <span>→</span>
              <Badge className="bg-green-100 text-green-700">Liquidado</Badge>
            </div>
            <p className="text-xs text-purple-700 mt-2">
              Após efetuar o pagamento, envie o comprovativo e marque como "Liquidado" para arquivar.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Upload Comprovativo */}
      <Dialog open={showUploadModal !== null} onOpenChange={() => { setShowUploadModal(null); setSelectedFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Enviar Comprovativo de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">Motorista:</p>
              <p className="font-semibold">{showUploadModal?.motorista_nome}</p>
              <p className="text-sm text-slate-500 mt-1">Semana {semana}/{ano}</p>
            </div>
            
            <div>
              <Label>Selecionar Ficheiro *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
                data-testid="upload-comprovativo-input"
              />
              {selectedFile && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {selectedFile.name}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Formatos aceites: PDF, JPG, PNG (transferência bancária, recibo de pagamento, etc.)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadModal(null); setSelectedFile(null); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleUploadComprovativo(showUploadModal?.motorista_id)}
              disabled={uploadingFile || !selectedFile}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="confirm-comprovativo-btn"
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

      {/* Modal Confirmar Liquidação */}
      <Dialog open={showConfirmLiquidar !== null} onOpenChange={() => setShowConfirmLiquidar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Marcar como Liquidado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Confirma que o pagamento a <strong>{showConfirmLiquidar?.motorista_nome}</strong> foi efetuado?
            </p>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                ✓ Ao marcar como liquidado, este relatório será movido para o <strong>Arquivo de Recibos</strong>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmLiquidar(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleMarcarLiquidado(showConfirmLiquidar?.motorista_id)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-liquidar-btn"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar Liquidação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PagamentosParceiro;
