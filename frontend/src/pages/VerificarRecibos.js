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
  Filter, ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle,
  FileCheck, Eye, Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const VerificarRecibos = ({ user, onLogout }) => {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [semana, setSemana] = useState(null);
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreview, setShowPreview] = useState(null);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(currentWeek);
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchRelatorios();
    }
  }, [semana, ano]);

  const fetchRelatorios = async () => {
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
      
      // Combinar dados e filtrar apenas status "aguardar_recibo"
      const relatoriosData = motoristas
        .map(m => ({
          ...m,
          status_info: statusData[m.motorista_id] || { status_aprovacao: 'pendente' }
        }))
        .filter(m => m.status_info.status_aprovacao === 'aguardar_recibo');
      
      setRelatorios(relatoriosData);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRecibo = async (motoristaId) => {
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
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/upload-recibo?semana=${semana}&ano=${ano}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setShowUploadModal(null);
      setSelectedFile(null);
      fetchRelatorios();
      toast.success('Recibo enviado com sucesso! Status alterado para "A Pagamento"');
    } catch (error) {
      console.error('Erro ao enviar recibo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar recibo');
    } finally {
      setUploadingFile(false);
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
  const totalPendente = relatorios.reduce((sum, r) => {
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
            <h1 className="text-2xl font-bold text-slate-800">Verificar Recibos</h1>
            <p className="text-slate-600">Motoristas aguardando envio de recibo verde / autofaturação</p>
          </div>
          <Badge className="bg-amber-100 text-amber-700 text-lg px-4 py-2">
            {relatorios.length} pendente(s)
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
              <Button onClick={fetchRelatorios} variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-slate-600">Aguardando Recibo</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{relatorios.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-slate-600">Total a Pagar</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalPendente)}</p>
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

        {/* Lista de Relatórios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Relatórios Aguardando Recibo - Semana {semana}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : relatorios.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
                <p className="text-slate-600">
                  Não há relatórios aguardando recibo nesta semana.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {relatorios.map((relatorio) => {
                  const liquido = (relatorio.ganhos_uber || 0) + (relatorio.uber_portagens || 0) + (relatorio.ganhos_bolt || 0) 
                    - (relatorio.via_verde || 0) - (relatorio.combustivel || 0) - (relatorio.carregamento_eletrico || 0) 
                    - (relatorio.aluguer_veiculo || 0) - (relatorio.extras || 0);
                  
                  return (
                    <div 
                      key={relatorio.motorista_id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                      data-testid={`relatorio-${relatorio.motorista_id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{relatorio.motorista_nome}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1">
                              <span className="flex items-center gap-1">
                                <Euro className="w-3 h-3" />
                                Líquido: <strong className={liquido >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(liquido)}</strong>
                              </span>
                              <span className="text-slate-300">|</span>
                              <span>Uber: {formatCurrency(relatorio.ganhos_uber)}</span>
                              <span>Bolt: {formatCurrency(relatorio.ganhos_bolt)}</span>
                            </div>
                            {relatorio.status_info.data_envio_relatorio && (
                              <p className="text-xs text-slate-500 mt-1">
                                Relatório enviado em: {new Date(relatorio.status_info.data_envio_relatorio).toLocaleString('pt-PT')}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className="bg-amber-100 text-amber-700">Aguardar Recibo</Badge>
                          
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadRelatorio(relatorio.motorista_id, relatorio.motorista_nome)}
                              data-testid={`download-relatorio-${relatorio.motorista_id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Relatório
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setShowUploadModal(relatorio)}
                              className="bg-amber-600 hover:bg-amber-700"
                              data-testid={`upload-recibo-${relatorio.motorista_id}`}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Enviar Recibo
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detalhes financeiros */}
                      <div className="mt-4 pt-4 border-t grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Uber</span>
                          <p className="font-semibold text-green-600">{formatCurrency(relatorio.ganhos_uber)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Uber Port.</span>
                          <p className="font-semibold text-green-600">{formatCurrency(relatorio.uber_portagens)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Bolt</span>
                          <p className="font-semibold text-green-600">{formatCurrency(relatorio.ganhos_bolt)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Via Verde</span>
                          <p className="font-semibold text-red-600">-{formatCurrency(relatorio.via_verde)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Combustível</span>
                          <p className="font-semibold text-red-600">-{formatCurrency(relatorio.combustivel)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Elétrico</span>
                          <p className="font-semibold text-red-600">-{formatCurrency(relatorio.carregamento_eletrico)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Aluguer</span>
                          <p className="font-semibold text-blue-600">{formatCurrency(relatorio.aluguer_veiculo)}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Extras</span>
                          <p className="font-semibold text-orange-600">{formatCurrency(relatorio.extras)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h4 className="font-semibold text-blue-800 mb-2">📝 Fluxo de Aprovação</h4>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="bg-slate-100 text-slate-700">Pendente</Badge>
              <span>→</span>
              <Badge className="bg-blue-100 text-blue-700">Aprovado</Badge>
              <span>→</span>
              <Badge className="bg-amber-100 text-amber-700">Aguardar Recibo ← Está aqui</Badge>
              <span>→</span>
              <Badge className="bg-purple-100 text-purple-700">A Pagamento</Badge>
              <span>→</span>
              <Badge className="bg-green-100 text-green-700">Liquidado</Badge>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Após enviar o recibo verde ou autofaturação, o status passa automaticamente para "A Pagamento".
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Upload Recibo */}
      <Dialog open={showUploadModal !== null} onOpenChange={() => { setShowUploadModal(null); setSelectedFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Enviar Recibo Verde / Autofaturação
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
                data-testid="upload-file-input"
              />
              {selectedFile && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {selectedFile.name}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Formatos aceites: PDF, JPG, PNG
              </p>
            </div>

            <div className="bg-amber-50 p-3 rounded border border-amber-200">
              <p className="text-xs text-amber-800">
                ⚠️ Após enviar o recibo, o status será alterado automaticamente para <strong>"A Pagamento"</strong>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadModal(null); setSelectedFile(null); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleUploadRecibo(showUploadModal?.motorista_id)}
              disabled={uploadingFile || !selectedFile}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="confirm-upload-btn"
            >
              {uploadingFile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Recibo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VerificarRecibos;
