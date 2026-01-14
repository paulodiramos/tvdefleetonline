import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  BarChart3,
  Download,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  FileText,
  MessageCircle,
  Mail,
  FileDown,
  Upload,
  Settings,
  Wallet,
  MinusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const API = process.env.REACT_APP_BACKEND_URL;

const ResumoSemanalParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    mostrar_matricula: true,
    mostrar_via_verde: false,
    mostrar_abastecimentos: false,
    mostrar_carregamentos: false
  });
  const [showPdfOptions, setShowPdfOptions] = useState(null); // motorista_id ou null
  const [showAbaterViaVerde, setShowAbaterViaVerde] = useState(null); // motorista data ou null
  const [valorAbater, setValorAbater] = useState(0);
  const [statusAprovacao, setStatusAprovacao] = useState({}); // status de aprovação por motorista_id
  const [showUploadRecibo, setShowUploadRecibo] = useState(null); // motorista_id para upload de recibo
  const [selectedMotoristas, setSelectedMotoristas] = useState([]); // IDs dos motoristas selecionados
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const STATUS_LABELS = {
    pendente: { label: 'Pendente', color: 'bg-slate-100 text-slate-700' },
    aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700' },
    aguardar_recibo: { label: 'Aguardar Recibo', color: 'bg-amber-100 text-amber-700' },
    a_pagamento: { label: 'A Pagamento', color: 'bg-purple-100 text-purple-700' },
    liquidado: { label: 'Liquidado', color: 'bg-green-100 text-green-700' }
  };

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(currentWeek);
    setAno(now.getFullYear());
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchResumo();
      fetchHistorico();
      fetchStatusAprovacao();
    }
  }, [semana, ano]);

  const fetchResumo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResumo(response.data);
    } catch (error) {
      console.error('Erro ao carregar resumo semanal:', error);
      toast.error('Erro ao carregar resumo semanal');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusAprovacao = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/status?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusAprovacao(response.data);
    } catch (error) {
      console.error('Erro ao carregar status de aprovação:', error);
    }
  };

  const handleStatusChange = async (motoristaId, novoStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/status`,
        { status: novoStatus, semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Atualizar estado local
      setStatusAprovacao(prev => ({
        ...prev,
        [motoristaId]: { ...prev[motoristaId], status_aprovacao: novoStatus }
      }));
      
      toast.success(`Status atualizado para ${STATUS_LABELS[novoStatus]?.label || novoStatus}`);
      
      // Se mudou para aguardar_recibo, abrir dialog de upload
      if (novoStatus === 'aguardar_recibo') {
        setShowUploadRecibo(motoristaId);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleUploadRecibo = async (motoristaId, file) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      await axios.post(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/upload-recibo?semana=${semana}&ano=${ano}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      // Atualizar estado local
      setStatusAprovacao(prev => ({
        ...prev,
        [motoristaId]: { ...prev[motoristaId], status_aprovacao: 'a_pagamento' }
      }));
      
      setShowUploadRecibo(null);
      toast.success('Recibo enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar recibo:', error);
      toast.error('Erro ao enviar recibo');
    }
  };

  const handleSelectMotorista = (motoristaId, isSelected) => {
    if (isSelected) {
      setSelectedMotoristas(prev => [...prev, motoristaId]);
    } else {
      setSelectedMotoristas(prev => prev.filter(id => id !== motoristaId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedMotoristas(motoristas.map(m => m.motorista_id));
    } else {
      setSelectedMotoristas([]);
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedMotoristas.length === 0) {
      toast.error('Selecione motoristas e um status');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Atualizar status de todos os motoristas selecionados
      const promises = selectedMotoristas.map(motoristaId =>
        axios.put(
          `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/status`,
          { status: bulkStatus, semana, ano },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(promises);
      
      // Atualizar estado local
      const newStatusAprovacao = { ...statusAprovacao };
      selectedMotoristas.forEach(id => {
        newStatusAprovacao[id] = { ...newStatusAprovacao[id], status_aprovacao: bulkStatus };
      });
      setStatusAprovacao(newStatusAprovacao);
      
      setSelectedMotoristas([]);
      setShowBulkStatusModal(false);
      setBulkStatus('');
      toast.success(`Status de ${selectedMotoristas.length} motorista(s) atualizado para ${STATUS_LABELS[bulkStatus]?.label}`);
    } catch (error) {
      console.error('Erro ao atualizar status em lote:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/historico-semanal?semanas=6&semana_atual=${semana}&ano_atual=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorico(response.data.historico || []);
    } catch (error) {
      setHistorico([]);
    }
  };

  const handlePreviousWeek = () => {
    if (semana > 1) setSemana(semana - 1);
    else { setSemana(52); setAno(ano - 1); }
  };

  const handleNextWeek = () => {
    if (semana < 52) setSemana(semana + 1);
    else { setSemana(1); setAno(ano + 1); }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const formatShort = (value) => {
    const num = value || 0;
    if (num >= 1000) return `${(num/1000).toFixed(1)}k`;
    return num.toFixed(0);
  };

  const handleEditMotorista = (motorista) => {
    setEditingMotorista(motorista.motorista_id);
    setEditForm({
      ganhos_uber: motorista.ganhos_uber || 0,
      uber_portagens: motorista.uber_portagens || 0,
      ganhos_bolt: motorista.ganhos_bolt || 0,
      via_verde: motorista.via_verde || 0,
      combustivel: motorista.combustivel || 0,
      eletrico: motorista.carregamento_eletrico || 0,
      aluguer: motorista.aluguer_veiculo || 0,
      extras: motorista.extras || 0
    });
  };

  const handleSaveEdit = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}`,
        { semana, ano, ...editForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Valores atualizados!');
      setEditingMotorista(null);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao atualizar valores');
    }
  };

  const handleDeleteMotoristaData = async (motoristaId, motoristaName) => {
    if (!window.confirm(`Eliminar todos os dados da semana ${semana}/${ano} para ${motoristaName}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Dados de ${motoristaName} eliminados!`);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao eliminar dados');
    }
  };

  // Abrir modal para abater Via Verde acumulado
  const openAbaterViaVerde = (motorista) => {
    setShowAbaterViaVerde(motorista);
    setValorAbater(motorista.viaverde_acumulado || 0);
  };

  // Confirmar abate do Via Verde acumulado
  const handleAbaterViaVerde = async () => {
    if (!showAbaterViaVerde) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/motoristas/${showAbaterViaVerde.motorista_id}/viaverde-abater`,
        { valor: valorAbater, semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Via Verde abatido: €${valorAbater.toFixed(2)}`);
      setShowAbaterViaVerde(null);
      setValorAbater(0);
      fetchResumo();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao abater Via Verde');
    }
  };

  const handleDeleteAllWeekData = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/relatorios/parceiro/resumo-semanal/all?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Dados da semana ${semana}/${ano} eliminados!`);
      setShowDeleteAllConfirm(false);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao eliminar dados');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/pdf?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resumo_semanal_S${semana}_${ano}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF descarregado!');
    } catch (error) {
      toast.error('Erro ao descarregar PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadMotoristaPdf = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        semana,
        ano,
        mostrar_matricula: pdfOptions.mostrar_matricula,
        mostrar_via_verde: pdfOptions.mostrar_via_verde,
        mostrar_abastecimentos: pdfOptions.mostrar_abastecimentos,
        mostrar_carregamentos: pdfOptions.mostrar_carregamentos
      });
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/pdf?${params}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${motoristaNome.replace(/\s+/g, '_')}_S${semana}_${ano}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`PDF de ${motoristaNome} descarregado!`);
      setShowPdfOptions(null);
    } catch (error) {
      toast.error('Erro ao descarregar PDF');
    }
  };

  const openPdfOptions = (motoristaId) => {
    setShowPdfOptions(motoristaId);
  };

  const handleWhatsApp = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/whatsapp?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.open(response.data.whatsapp_link, '_blank');
    } catch (error) {
      toast.error('Erro ao gerar link WhatsApp');
    }
  };

  const handleEmail = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/email`,
        { semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(`Email enviado para ${motoristaNome}!`);
      } else {
        toast.error(response.data.message || 'Erro ao enviar email');
      }
    } catch (error) {
      toast.error('Erro ao enviar email');
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="p-4">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const totais = resumo?.totais || {};
  const motoristas = resumo?.motoristas || [];
  const totalAluguer = totais.total_aluguer || 0;
  const totalExtras = totais.total_extras || 0;
  const totalVendas = totais.total_vendas || 0;
  const totalReceitas = totais.total_receitas_parceiro || (totalAluguer + totalExtras + totalVendas);
  const totalDespesas = totais.total_despesas_operacionais || 0;
  // CORRIGIDO: Usar a soma dos líquidos dos motoristas em vez do cálculo do parceiro
  const liquidoParceiro = totais.total_liquido_motoristas || totais.total_liquido_parceiro || (totalReceitas - totalDespesas);
  const isPositive = liquidoParceiro >= 0;
  const maxValue = Math.max(...historico.map(h => Math.max(h.ganhos || 0, h.despesas || 0, Math.abs(h.liquido || 0))), 1);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Resumo Semanal</h1>
            <p className="text-xs text-slate-500">Ganhos e despesas semanais</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek} className="h-6 w-6 p-0">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium min-w-[80px] text-center">S{semana}/{ano}</span>
              <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-6 w-6 p-0">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/importar-ficheiros')} className="h-7 text-xs">
            <Upload className="w-3 h-3 mr-1" />
            Importar
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-7 text-xs">
            {downloadingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            PDF
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteAllConfirm(true)} className="h-7 text-xs">
            <Trash2 className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Modal de confirmação */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Confirmar Eliminação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Eliminar <strong>TODOS</strong> os dados da semana {semana}/{ano}?</p>
              <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>Cancelar</Button>
                <Button size="sm" variant="destructive" onClick={handleDeleteAllWeekData}>Eliminar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de opções de PDF */}
      {showPdfOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileDown className="w-4 h-4" />
                Opções do PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">Selecione o que incluir no relatório:</p>
              
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pdfOptions.mostrar_matricula}
                  onChange={(e) => setPdfOptions({...pdfOptions, mostrar_matricula: e.target.checked})}
                  className="rounded"
                />
                <span>Mostrar matrícula do veículo</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pdfOptions.mostrar_via_verde}
                  onChange={(e) => setPdfOptions({...pdfOptions, mostrar_via_verde: e.target.checked})}
                  className="rounded"
                />
                <span>Lista de transações Via Verde</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pdfOptions.mostrar_abastecimentos}
                  onChange={(e) => setPdfOptions({...pdfOptions, mostrar_abastecimentos: e.target.checked})}
                  className="rounded"
                />
                <span>Lista de abastecimentos</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={pdfOptions.mostrar_carregamentos}
                  onChange={(e) => setPdfOptions({...pdfOptions, mostrar_carregamentos: e.target.checked})}
                  className="rounded"
                />
                <span>Lista de carregamentos elétricos</span>
              </label>
              
              <div className="flex gap-2 justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setShowPdfOptions(null)}>Cancelar</Button>
                <Button 
                  size="sm" 
                  onClick={() => {
                    const m = motoristas.find(x => x.motorista_id === showPdfOptions);
                    if (m) handleDownloadMotoristaPdf(showPdfOptions, m.motorista_nome);
                  }}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Gerar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-2 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-medium">Receitas</span>
            </div>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
            <div className="text-xs text-green-600 mt-1 space-y-0.5">
              <div className="flex justify-between"><span>Aluguer:</span><span>{formatCurrency(totalAluguer)}</span></div>
              <div className="flex justify-between"><span>Extras:</span><span>{formatCurrency(totalExtras)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-2 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-red-600 mb-1">
              <TrendingDown className="w-3 h-3" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
            <div className="text-xs text-red-600 mt-1 space-y-0.5">
              <div className="flex justify-between"><span>Combustível:</span><span>{formatCurrency(totais.total_combustivel)}</span></div>
              <div className="flex justify-between"><span>Via Verde:</span><span>{formatCurrency(totais.total_via_verde)}</span></div>
              <div className="flex justify-between"><span>Elétrico:</span><span>{formatCurrency(totais.total_eletrico)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-2 ${isPositive ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardContent className="p-3">
            <div className={`flex items-center gap-1 mb-1 ${isPositive ? 'text-blue-600' : 'text-orange-600'}`}>
              <DollarSign className="w-3 h-3" />
              <span className="text-xs font-medium">Líquido</span>
            </div>
            <p className={`text-lg font-bold ${isPositive ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(liquidoParceiro)}</p>
            <div className="flex items-center gap-1 mt-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{motoristas.length} motoristas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Motoristas */}
      <div className="bg-slate-50 rounded p-2 text-center text-xs text-slate-600">
        <span>Ganhos Motoristas: {formatCurrency(totais.total_ganhos)}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Uber: {formatCurrency(totais.total_ganhos_uber)}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Bolt: {formatCurrency(totais.total_ganhos_bolt)}</span>
      </div>

      {/* Tabela de Motoristas */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-1 text-sm">
            <FileText className="w-4 h-4" />
            Detalhes por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-2">Motorista</th>
                  <th className="text-right p-2">Uber</th>
                  <th className="text-right p-2 text-[10px]">Uber Port.</th>
                  <th className="text-right p-2">Bolt</th>
                  <th className="text-right p-2">Via Verde</th>
                  <th className="text-right p-2">Comb.</th>
                  <th className="text-right p-2">Elétr.</th>
                  <th className="text-right p-2">Aluguer</th>
                  <th className="text-right p-2">Extras</th>
                  <th className="text-right p-2">Líquido</th>
                  <th className="text-center p-2 w-32">Status</th>
                  <th className="text-center p-2 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {motoristas.map((m) => {
                  const isEditing = editingMotorista === m.motorista_id;
                  // Se estiver em modo de edição, usar valores do formulário para cálculo em tempo real
                  // Líquido = (Rendimentos Uber + Uber Portagens) + Bolt - Via Verde - Combustível - Elétrico - Aluguer - Extras
                  const liquido = isEditing 
                    ? (editForm.ganhos_uber || 0) + (editForm.uber_portagens || 0) + (editForm.ganhos_bolt || 0) - (editForm.via_verde || 0) - (editForm.combustivel || 0) - (editForm.eletrico || 0) - (editForm.aluguer || 0) - (editForm.extras || 0)
                    : (m.ganhos_uber || 0) + (m.uber_portagens || 0) + (m.ganhos_bolt || 0) - (m.via_verde || 0) - (m.combustivel || 0) - (m.carregamento_eletrico || 0) - (m.aluguer_veiculo || 0) - (m.extras || 0);
                  
                  return (
                    <tr key={m.motorista_id} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-medium">{m.motorista_nome}</td>
                      {isEditing ? (
                        <>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.ganhos_uber} onChange={(e) => setEditForm({...editForm, ganhos_uber: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.uber_portagens || 0} onChange={(e) => setEditForm({...editForm, uber_portagens: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.ganhos_bolt} onChange={(e) => setEditForm({...editForm, ganhos_bolt: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.via_verde} onChange={(e) => setEditForm({...editForm, via_verde: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.combustivel} onChange={(e) => setEditForm({...editForm, combustivel: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.eletrico} onChange={(e) => setEditForm({...editForm, eletrico: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.aluguer} onChange={(e) => setEditForm({...editForm, aluguer: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.extras} onChange={(e) => setEditForm({...editForm, extras: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 text-right text-green-600">{formatCurrency(m.ganhos_uber)}</td>
                          <td className="p-2 text-right text-emerald-500 text-[10px]">{formatCurrency(m.uber_portagens || 0)}</td>
                          <td className="p-2 text-right text-green-600">{formatCurrency(m.ganhos_bolt)}</td>
                          <td className="p-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className={m.acumular_viaverde ? "text-slate-400 line-through" : "text-red-600"}>
                                {formatCurrency(m.via_verde_total_importado || m.via_verde || 0)}
                              </span>
                              {m.acumular_viaverde && m.viaverde_acumulado > 0 && (
                                <button 
                                  onClick={() => openAbaterViaVerde(m)}
                                  className="text-[10px] text-amber-600 hover:text-amber-800 flex items-center gap-0.5"
                                  title="Clique para abater do acumulado"
                                >
                                  <Wallet className="w-3 h-3" />
                                  €{(m.viaverde_acumulado || 0).toFixed(0)}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.combustivel)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.carregamento_eletrico)}</td>
                          <td className="p-2 text-right text-blue-600">{formatCurrency(m.aluguer_veiculo)}</td>
                          <td className="p-2 text-right text-orange-600">{formatCurrency(m.extras)}</td>
                        </>
                      )}
                      <td className={`p-2 text-right font-bold ${liquido >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(liquido)}</td>
                      <td className="p-2 text-center">
                        <select
                          value={statusAprovacao[m.motorista_id]?.status_aprovacao || 'pendente'}
                          onChange={(e) => handleStatusChange(m.motorista_id, e.target.value)}
                          className={`text-[10px] px-1 py-0.5 rounded border ${STATUS_LABELS[statusAprovacao[m.motorista_id]?.status_aprovacao || 'pendente']?.color || 'bg-slate-100'}`}
                          data-testid={`status-select-${m.motorista_id}`}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="aguardar_recibo">Aguardar Recibo</option>
                          <option value="a_pagamento">A Pagamento</option>
                          <option value="liquidado">Liquidado</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="default" onClick={() => handleSaveEdit(m.motorista_id)} className="h-5 w-5 p-0"><Save className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingMotorista(null)} className="h-5 w-5 p-0"><X className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex gap-0.5 justify-center">
                            <Button size="sm" variant="outline" onClick={() => openPdfOptions(m.motorista_id)} className="h-5 w-5 p-0" title="Download PDF">
                              <FileDown className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleWhatsApp(m.motorista_id)} className="h-5 w-5 p-0 text-green-600 hover:text-green-700" title="WhatsApp">
                              <MessageCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEmail(m.motorista_id, m.motorista_nome)} className="h-5 w-5 p-0 text-blue-600 hover:text-blue-700" title="Email">
                              <Mail className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditMotorista(m)} className="h-5 w-5 p-0" title="Editar">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteMotoristaData(m.motorista_id, m.motorista_nome)} className="h-5 w-5 p-0" title="Eliminar">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {motoristas.length === 0 && (
                  <tr><td colSpan="10" className="text-center py-6 text-slate-500">Nenhum dado encontrado</td></tr>
                )}
              </tbody>
              {motoristas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-xs">
                    <td className="p-2">TOTAIS</td>
                    <td className="p-2 text-right text-green-700">{formatCurrency(totais.total_ganhos_uber)}</td>
                    <td className="p-2 text-right text-emerald-600 text-[10px]">{formatCurrency(totais.total_uber_portagens || 0)}</td>
                    <td className="p-2 text-right text-green-700">{formatCurrency(totais.total_ganhos_bolt)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_via_verde)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_combustivel)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_eletrico)}</td>
                    <td className="p-2 text-right text-blue-700">{formatCurrency(totalAluguer)}</td>
                    <td className="p-2 text-right text-orange-700">{formatCurrency(totalExtras)}</td>
                    <td className={`p-2 text-right ${isPositive ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(liquidoParceiro)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Evolução */}
      {historico.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="flex items-center gap-1 text-sm">
              <BarChart3 className="w-4 h-4" />
              Evolução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex justify-center gap-4 mb-2 text-xs">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-500"></div><span>Receitas</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-500"></div><span>Despesas</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-500"></div><span>Líquido</span></div>
            </div>
            <div className="flex items-end justify-between gap-1 h-24 px-2">
              {historico.map((item, index) => {
                const receitaHeight = ((item.receitas || item.ganhos || 0) / maxValue) * 100;
                const despesaHeight = ((item.despesas || 0) / maxValue) * 100;
                const liquidoHeight = (Math.abs(item.liquido || 0) / maxValue) * 100;
                const isLiquidoPositivo = (item.liquido || 0) >= 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs p-1 rounded shadow z-10 whitespace-nowrap">
                      <div className="font-semibold">S{item.semana}/{item.ano}</div>
                      <div className="text-green-300">R: {formatCurrency(item.receitas || item.ganhos)}</div>
                      <div className="text-red-300">D: {formatCurrency(item.despesas)}</div>
                      <div className={isLiquidoPositivo ? 'text-blue-300' : 'text-orange-300'}>L: {formatCurrency(item.liquido)}</div>
                    </div>
                    <div className="flex gap-0.5 items-end h-20">
                      <div className="w-2 bg-green-500 rounded-t" style={{ height: `${Math.max(receitaHeight, 4)}%` }}></div>
                      <div className="w-2 bg-red-500 rounded-t" style={{ height: `${Math.max(despesaHeight, 4)}%` }}></div>
                      <div className={`w-2 rounded-t ${isLiquidoPositivo ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ height: `${Math.max(liquidoHeight, 4)}%` }}></div>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">S{item.semana}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-slate-400">{resumo?.periodo || `Semana ${semana}/${ano}`}</div>
      
      {/* Modal para Abater Via Verde Acumulado */}
      <Dialog open={!!showAbaterViaVerde} onOpenChange={() => setShowAbaterViaVerde(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              Abater Via Verde Acumulado
            </DialogTitle>
          </DialogHeader>
          {showAbaterViaVerde && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">Motorista:</p>
                <p className="font-semibold">{showAbaterViaVerde.motorista_nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-xs text-amber-600">Acumulado Total</p>
                  <p className="text-xl font-bold text-amber-700">€{(showAbaterViaVerde.viaverde_acumulado || 0).toFixed(2)}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-green-600">Via Verde Semana</p>
                  <p className="text-xl font-bold text-green-700">€{(showAbaterViaVerde.via_verde_total_importado || 0).toFixed(2)}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Valor a abater (€):</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={showAbaterViaVerde.viaverde_acumulado || 0}
                  value={valorAbater}
                  onChange={(e) => setValorAbater(Math.min(parseFloat(e.target.value) || 0, showAbaterViaVerde.viaverde_acumulado || 0))}
                  className="mt-1"
                  data-testid="input-valor-abater"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Este valor será descontado do acumulado e adicionado às despesas desta semana
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setValorAbater(showAbaterViaVerde.viaverde_acumulado || 0)}
                  className="flex-1"
                >
                  Abater Tudo
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setValorAbater((showAbaterViaVerde.viaverde_acumulado || 0) / 2)}
                  className="flex-1"
                >
                  Abater 50%
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbaterViaVerde(null)}>Cancelar</Button>
            <Button 
              onClick={handleAbaterViaVerde}
              disabled={valorAbater <= 0}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="btn-confirmar-abater"
            >
              <MinusCircle className="w-4 h-4 mr-2" />
              Abater €{valorAbater.toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Upload de Recibo */}
      <Dialog open={showUploadRecibo !== null} onOpenChange={() => setShowUploadRecibo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Recibo Verde / Autofaturação</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              Envie o recibo verde ou documento de autofaturação para o motorista{' '}
              {motoristas.find(m => m.motorista_id === showUploadRecibo)?.motorista_nome}.
            </p>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && showUploadRecibo) {
                  handleUploadRecibo(showUploadRecibo, file);
                }
              }}
              data-testid="upload-recibo-input"
            />
            <p className="text-xs text-slate-500 mt-2">Formatos aceites: PDF, JPG, PNG</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadRecibo(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
};

export default ResumoSemanalParceiro;
