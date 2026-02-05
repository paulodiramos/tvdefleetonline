import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  MinusCircle,
  Smartphone,
  RefreshCw,
  Car,
  Fuel,
  CreditCard,
  MapPin,
  Play,
  CheckCircle,
  AlertCircle
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  
  // Estados de sincronização
  const [syncLoading, setSyncLoading] = useState({});
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [uploadingViaVerde, setUploadingViaVerde] = useState(false);

  // Estados para totais recebidos da empresa (Uber/Bolt)
  const [totaisEmpresa, setTotaisEmpresa] = useState({
    uber_recebido: 0,
    bolt_recebido: 0
  });
  const [savingTotaisEmpresa, setSavingTotaisEmpresa] = useState(false);

  const STATUS_LABELS = {
    pendente: { label: 'Pendente', color: 'bg-slate-100 text-slate-700' },
    aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-700' },
    aguardar_recibo: { label: 'Aguardar Recibo', color: 'bg-amber-100 text-amber-700' },
    a_pagamento: { label: 'A Pagamento', color: 'bg-purple-100 text-purple-700' },
    liquidado: { label: 'Liquidado', color: 'bg-green-100 text-green-700' }
  };

  // Calcular datas de início (segunda) e fim (domingo) da semana
  const calcularDatasSemana = (semanaNum, anoNum) => {
    // Encontrar primeira segunda-feira do ano (semana ISO)
    const primeiroJan = new Date(anoNum, 0, 1);
    const diaSemana = primeiroJan.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
    
    // Ajustar para encontrar a primeira segunda-feira
    // Se 1 de janeiro é segunda (1), começamos aí
    // Se é terça-sábado (2-6), voltamos para a segunda anterior
    // Se é domingo (0), avançamos para segunda
    let primeiraSegunda;
    if (diaSemana === 1) {
      primeiraSegunda = new Date(anoNum, 0, 1);
    } else if (diaSemana === 0) {
      primeiraSegunda = new Date(anoNum, 0, 2); // Próxima segunda
    } else {
      // Voltar para segunda anterior (pode ser no ano anterior)
      primeiraSegunda = new Date(anoNum, 0, 1 - (diaSemana - 1));
    }
    
    // Calcular início da semana desejada
    const inicioSemana = new Date(primeiraSegunda);
    inicioSemana.setDate(primeiraSegunda.getDate() + (semanaNum - 1) * 7);
    
    // Fim da semana (domingo)
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    
    // Formatar datas
    const formatarData = (data) => {
      return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    };
    
    return {
      inicio: formatarData(inicioSemana),
      fim: formatarData(fimSemana),
      inicioCompleto: inicioSemana.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
      fimCompleto: fimSemana.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
    };
  };

  const datasSemana = semana && ano ? calcularDatasSemana(semana, ano) : null;

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
      fetchTotaisEmpresa();
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

  // Carregar totais recebidos da empresa
  const fetchTotaisEmpresa = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/totais-empresa?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setTotaisEmpresa({
          uber_recebido: response.data.uber_recebido || 0,
          bolt_recebido: response.data.bolt_recebido || 0
        });
      }
    } catch (error) {
      // Não há dados ainda, ignorar
      setTotaisEmpresa({ uber_recebido: 0, bolt_recebido: 0 });
    }
  };

  // Guardar totais recebidos da empresa
  const saveTotaisEmpresa = async () => {
    try {
      setSavingTotaisEmpresa(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/relatorios/parceiro/totais-empresa`,
        { semana, ano, ...totaisEmpresa },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Totais da empresa guardados');
    } catch (error) {
      console.error('Erro ao guardar totais:', error);
      toast.error('Erro ao guardar totais');
    } finally {
      setSavingTotaisEmpresa(false);
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

  const handleBulkEmailSend = async () => {
    if (selectedMotoristas.length === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    setSendingEmails(true);
    try {
      const token = localStorage.getItem('token');
      let successCount = 0;
      let errorCount = 0;

      // Enviar email para cada motorista selecionado
      for (const motoristaId of selectedMotoristas) {
        try {
          const response = await axios.post(
            `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/email`,
            { semana, ano },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.data.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      setShowBulkEmailModal(false);
      setSelectedMotoristas([]);
      
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} relatório(s) enviado(s) por email com sucesso!`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} enviado(s), ${errorCount} falharam`);
      } else {
        toast.error('Erro ao enviar emails');
      }
    } catch (error) {
      console.error('Erro ao enviar emails em massa:', error);
      toast.error('Erro ao enviar emails');
    } finally {
      setSendingEmails(false);
    }
  };

  const handleBulkWhatsAppSend = async () => {
    if (selectedMotoristas.length === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    setSendingEmails(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/api/whatsapp/send-bulk`,
        { 
          motorista_ids: selectedMotoristas, 
          message_type: 'relatorio',
          semana,
          ano
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setShowBulkEmailModal(false);
        setSelectedMotoristas([]);
        toast.success(`Envio de ${selectedMotoristas.length} mensagens WhatsApp iniciado!`);
      } else {
        toast.error(response.data.message || 'Erro ao enviar');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp em massa:', error);
      const errorMsg = error.response?.data?.detail || 'Erro ao enviar WhatsApp';
      if (errorMsg.includes('não configurado')) {
        toast.error('WhatsApp Business não configurado. Aceda a Configurações → Integrações.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSendingEmails(false);
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
      ganhos_campanha_bolt: motorista.ganhos_campanha_bolt || 0,
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
      
      // Enviar via sistema WhatsApp Web interno
      const response = await axios.post(
        `${API}/api/whatsapp/send-relatorio/${motoristaId}?semana=${semana}&ano=${ano}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(`Relatório enviado via WhatsApp para ${response.data.motorista}!`);
      } else {
        toast.error(response.data.message || 'Erro ao enviar WhatsApp');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Erro ao enviar WhatsApp';
      if (errorMsg.includes('não está conectado')) {
        toast.error('WhatsApp não conectado. Aceda a Configurações → Integrações e escaneie o QR Code.');
      } else {
        toast.error(errorMsg);
      }
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

  // Função de sincronização
  const handleSync = async (fonte) => {
    setSyncLoading(prev => ({ ...prev, [fonte]: true }));
    
    try {
      const token = localStorage.getItem('token');
      
      // Via Verde usa endpoint específico de RPA
      if (fonte === 'viaverde') {
        const response = await axios.post(
          `${API}/api/viaverde/executar-rpa`,
          { 
            tipo_periodo: 'semana_especifica',
            semana: semana,
            ano: ano
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          toast.success(`Via Verde: RPA agendado para Semana ${semana}/${ano}`);
          // O RPA executa em background, recarregar dados após alguns segundos
          setTimeout(() => fetchResumo(), 5000);
        } else {
          toast.error(response.data.error || 'Erro ao agendar Via Verde');
        }
      } else {
        // Outras fontes usam o endpoint geral
        const response = await axios.post(
          `${API}/api/sincronizacao-auto/executar`,
          { fontes: [fonte], semana, ano },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.sucesso) {
          const resultado = response.data.resultados?.[fonte];
          if (resultado?.sucesso) {
            toast.success(`${fonte.charAt(0).toUpperCase() + fonte.slice(1)} sincronizado com sucesso!`);
            fetchResumo();
          } else {
            toast.error(resultado?.erro || `Erro ao sincronizar ${fonte}`);
          }
        } else {
          toast.error(response.data.erros?.[0] || 'Erro na sincronização');
        }
      }
    } catch (error) {
      console.error(`Erro ao sincronizar ${fonte}:`, error);
      toast.error(error.response?.data?.detail || `Erro ao sincronizar ${fonte}`);
    } finally {
      setSyncLoading(prev => ({ ...prev, [fonte]: false }));
    }
  };
  
  // Sincronização de todas as fontes
  const handleSyncAll = async () => {
    setSyncLoading(prev => ({ ...prev, all: true }));
    
    try {
      const token = localStorage.getItem('token');
      
      // Executar sincronização geral
      const response = await axios.post(
        `${API}/api/sincronizacao-auto/executar`,
        { semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Também executar Via Verde RPA separadamente
      try {
        await axios.post(
          `${API}/api/viaverde/executar-rpa`,
          { 
            tipo_periodo: 'semana_especifica',
            semana: semana,
            ano: ano
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (vvError) {
        console.warn('Via Verde RPA não executado:', vvError.response?.data?.detail || vvError.message);
      }
      
      if (response.data.sucesso) {
        toast.success(`Sincronização completa executada para Semana ${semana}/${ano}!`);
        // Recarregar dados após alguns segundos para dar tempo ao RPA
        setTimeout(() => fetchResumo(), 5000);
      } else {
        toast.error('Algumas fontes falharam na sincronização');
      }
    } catch (error) {
      toast.error('Erro na sincronização');
    } finally {
      setSyncLoading(prev => ({ ...prev, all: false }));
    }
  };

  // Upload manual de ficheiro Excel Via Verde
  const handleUploadViaVerdeExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar extensão
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Ficheiro deve ser Excel (.xlsx, .xls) ou CSV (.csv)');
      return;
    }
    
    setUploadingViaVerde(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/api/viaverde/importar-excel`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        const { importados, duplicados, total } = response.data.resultado;
        toast.success(`Via Verde importado: ${importados} novos, ${duplicados} duplicados (total: ${total})`);
        fetchResumo();
      } else {
        toast.error(response.data.error || 'Erro ao importar ficheiro');
      }
    } catch (error) {
      console.error('Erro ao importar Via Verde:', error);
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploadingViaVerde(false);
      // Limpar input
      e.target.value = '';
    }
  };

  // Configuração das fontes de sincronização
  const SYNC_SOURCES = [
    { id: 'uber', name: 'Uber', icon: Car, color: 'bg-black text-white' },
    { id: 'bolt', name: 'Bolt', icon: Car, color: 'bg-green-500 text-white' },
    { id: 'viaverde', name: 'Via Verde', icon: CreditCard, color: 'bg-emerald-500 text-white' },
    { id: 'gps', name: 'GPS', icon: MapPin, color: 'bg-blue-500 text-white' },
    { id: 'abastecimentos', name: 'Combustível', icon: Fuel, color: 'bg-orange-500 text-white' },
  ];

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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Navegação de semana */}
            <div className="flex items-center gap-1 bg-white rounded border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek} className="h-6 w-6 p-0">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <div className="text-center min-w-[120px]">
                <span className="text-xs font-medium">S{semana}/{ano}</span>
                {datasSemana && (
                  <div className="text-[10px] text-slate-500">
                    {datasSemana.inicio} - {datasSemana.fim}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-6 w-6 p-0">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          
          {/* Botão de Sincronização com Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="default" className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
                {syncLoading.all ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Sincronizar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold text-slate-500">Sincronizar dados</p>
              </div>
              <DropdownMenuSeparator />
              
              {SYNC_SOURCES.map((source) => {
                const Icon = source.icon;
                return (
                  <DropdownMenuItem 
                    key={source.id}
                    onClick={() => handleSync(source.id)}
                    disabled={syncLoading[source.id]}
                    className="cursor-pointer"
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center mr-2 ${source.color}`}>
                      {syncLoading[source.id] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                    </div>
                    <span>{source.name}</span>
                    {syncLoading[source.id] && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        A sincronizar...
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })}
              
              <DropdownMenuSeparator />
              {/* Upload manual de ficheiro Excel Via Verde */}
              <DropdownMenuItem 
                asChild
                className="cursor-pointer"
              >
                <label className="flex items-center cursor-pointer">
                  <div className="w-6 h-6 rounded bg-teal-500 text-white flex items-center justify-center mr-2">
                    {uploadingViaVerde ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                  </div>
                  <span className="font-medium">Upload Via Verde (Excel)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUploadViaVerdeExcel}
                    className="hidden"
                    disabled={uploadingViaVerde}
                  />
                </label>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSyncAll}
                disabled={syncLoading.all}
                className="cursor-pointer"
              >
                <div className="w-6 h-6 rounded bg-purple-500 text-white flex items-center justify-center mr-2">
                  {syncLoading.all ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </div>
                <span className="font-medium">Sincronizar Tudo</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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

      {/* Dashboard de Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Caixa Receitas */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-green-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Receitas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Uber</span>
              <span className="font-medium text-green-700">{formatCurrency(totais.total_ganhos_uber)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Bolt</span>
              <span className="font-medium text-green-700">{formatCurrency(totais.total_ganhos_bolt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Extras</span>
              <span className="font-medium text-green-700">{formatCurrency(totalExtras)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-xs font-bold">
              <span>Total</span>
              <span className="text-green-800">{formatCurrency(totais.total_ganhos_uber + totais.total_ganhos_bolt + totalExtras)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Caixa Despesas */}
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-red-700 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Combustível</span>
              <span className="font-medium text-red-700">{formatCurrency(totais.total_combustivel)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Carregamentos</span>
              <span className="font-medium text-red-700">{formatCurrency(totais.total_eletrico)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Via Verde</span>
              <span className="font-medium text-red-700">{formatCurrency(totais.total_via_verde)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-xs font-bold">
              <span>Total</span>
              <span className="text-red-800">{formatCurrency(totais.total_combustivel + totais.total_eletrico + totais.total_via_verde)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Caixa Motoristas */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-blue-700 flex items-center gap-1">
              <Users className="w-3 h-3" /> Motoristas ({motoristas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Ganhos Totais</span>
              <span className="font-medium text-green-600">{formatCurrency(totais.total_ganhos_uber + totais.total_ganhos_bolt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Dívidas</span>
              <span className="font-medium text-red-600">{formatCurrency(motoristas.reduce((sum, m) => sum + (m.divida || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Extras</span>
              <span className="font-medium text-orange-600">{formatCurrency(totalExtras)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-xs font-bold">
              <span>Total Pagamentos</span>
              <span className="text-blue-800">{formatCurrency(motoristas.reduce((sum, m) => sum + (m.liquido || 0), 0))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Caixa Lucro */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold text-purple-700 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Lucro Parceiro
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Alugueres</span>
              <span className="font-medium text-purple-700">{formatCurrency(totalAluguer)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Vendas</span>
              <span className="font-medium text-purple-700">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Extras</span>
              <span className="font-medium text-purple-700">{formatCurrency(totalExtras)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-xs font-bold">
              <span>Total</span>
              <span className={liquidoParceiro >= 0 ? "text-green-800" : "text-red-800"}>{formatCurrency(liquidoParceiro)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verificação Totais Empresa vs Motoristas */}
      <Card className="border-blue-300 bg-blue-50/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-semibold text-blue-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Verificação de Totais (Empresa vs Motoristas)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Uber */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-black text-white flex items-center justify-center text-xs font-bold">U</div>
                <span className="text-sm font-medium">Uber</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-500">Recebido da Empresa</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={totaisEmpresa.uber_recebido || ''}
                    onChange={(e) => setTotaisEmpresa({...totaisEmpresa, uber_recebido: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="h-7 text-right"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Total Motoristas</label>
                  <div className="h-7 flex items-center justify-end px-2 bg-slate-100 rounded border text-sm font-medium">
                    {formatCurrency(totais.total_ganhos_uber)}
                  </div>
                </div>
              </div>
              {totaisEmpresa.uber_recebido > 0 && (
                <div className={`text-xs p-2 rounded flex items-center gap-1 ${
                  Math.abs(totaisEmpresa.uber_recebido - totais.total_ganhos_uber) < 0.01 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {Math.abs(totaisEmpresa.uber_recebido - totais.total_ganhos_uber) < 0.01 ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Valores conferem ✓
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      Diferença: {formatCurrency(totaisEmpresa.uber_recebido - totais.total_ganhos_uber)}
                      {totaisEmpresa.uber_recebido > totais.total_ganhos_uber ? ' (a mais)' : ' (a menos)'}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bolt */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center text-xs font-bold">B</div>
                <span className="text-sm font-medium">Bolt</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-500">Recebido da Empresa</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={totaisEmpresa.bolt_recebido || ''}
                    onChange={(e) => setTotaisEmpresa({...totaisEmpresa, bolt_recebido: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="h-7 text-right"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Total Motoristas</label>
                  <div className="h-7 flex items-center justify-end px-2 bg-slate-100 rounded border text-sm font-medium">
                    {formatCurrency(totais.total_ganhos_bolt)}
                  </div>
                </div>
              </div>
              {totaisEmpresa.bolt_recebido > 0 && (
                <div className={`text-xs p-2 rounded flex items-center gap-1 ${
                  Math.abs(totaisEmpresa.bolt_recebido - totais.total_ganhos_bolt) < 0.01 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {Math.abs(totaisEmpresa.bolt_recebido - totais.total_ganhos_bolt) < 0.01 ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Valores conferem ✓
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      Diferença: {formatCurrency(totaisEmpresa.bolt_recebido - totais.total_ganhos_bolt)}
                      {totaisEmpresa.bolt_recebido > totais.total_ganhos_bolt ? ' (a mais)' : ' (a menos)'}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button 
              size="sm" 
              onClick={saveTotaisEmpresa}
              disabled={savingTotaisEmpresa}
              className="h-7 text-xs"
            >
              {savingTotaisEmpresa ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Guardar Totais
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Motoristas */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-1 text-sm">
            <FileText className="w-4 h-4" />
            Detalhes por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Barra de ações em lote */}
          {selectedMotoristas.length > 0 && (
            <div className="bg-blue-50 p-2 flex items-center justify-between border-b">
              <span className="text-sm text-blue-700">
                {selectedMotoristas.length} motorista(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedMotoristas([])}
                >
                  Limpar Seleção
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBulkEmailModal(true)}
                  className="bg-white"
                  data-testid="btn-enviar-email-lote"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Enviar Relatórios por Email
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setShowBulkStatusModal(true)}
                  data-testid="btn-alterar-status-lote"
                >
                  Alterar Status em Lote
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-center p-2 w-8">
                    <input 
                      type="checkbox"
                      checked={selectedMotoristas.length === motoristas.length && motoristas.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="text-left p-2">Motorista</th>
                  <th className="text-right p-2">Uber</th>
                  <th className="text-right p-2 text-[10px]">Uber Port.</th>
                  <th className="text-right p-2">Bolt</th>
                  <th className="text-right p-2 text-[10px]" title="Ganhos Campanha Bolt">Bolt Camp.</th>
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
                  const isSelected = selectedMotoristas.includes(m.motorista_id);
                  // Se estiver em modo de edição, usar valores do formulário para cálculo em tempo real
                  // Líquido = (Rendimentos Uber + Uber Portagens) + Bolt + Bolt Campanha - Via Verde - Combustível - Elétrico - Aluguer - Extras
                  const liquido = isEditing 
                    ? (editForm.ganhos_uber || 0) + (editForm.uber_portagens || 0) + (editForm.ganhos_bolt || 0) + (editForm.ganhos_campanha_bolt || 0) - (editForm.via_verde || 0) - (editForm.combustivel || 0) - (editForm.eletrico || 0) - (editForm.aluguer || 0) - (editForm.extras || 0)
                    : (m.ganhos_uber || 0) + (m.uber_portagens || 0) + (m.ganhos_bolt || 0) + (m.ganhos_campanha_bolt || 0) - (m.via_verde || 0) - (m.combustivel || 0) - (m.carregamento_eletrico || 0) - (m.aluguer_veiculo || 0) - (m.extras || 0);
                  
                  return (
                    <tr key={m.motorista_id} className={`border-b hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="text-center p-2">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectMotorista(m.motorista_id, e.target.checked)}
                          className="w-4 h-4"
                          data-testid={`checkbox-motorista-${m.motorista_id}`}
                        />
                      </td>
                      <td className="p-2 font-medium">{m.motorista_nome}</td>
                      {isEditing ? (
                        <>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.ganhos_uber} onChange={(e) => setEditForm({...editForm, ganhos_uber: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.uber_portagens || 0} onChange={(e) => setEditForm({...editForm, uber_portagens: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.ganhos_bolt} onChange={(e) => setEditForm({...editForm, ganhos_bolt: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={editForm.ganhos_campanha_bolt || 0} onChange={(e) => setEditForm({...editForm, ganhos_campanha_bolt: parseFloat(e.target.value) || 0})} className="w-14 h-5 text-xs text-right px-1" title="Ganhos Campanha Bolt" /></td>
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
                          <td className="p-2 text-right text-green-500 text-[10px]" title="Ganhos Campanha Bolt">{formatCurrency(m.ganhos_campanha_bolt || 0)}</td>
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
                    <td className="p-2"></td>
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
                    <td className="p-2"></td>
                    <td className="p-2"></td>
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

      {/* Dialog de Alteração de Status em Lote */}
      <Dialog open={showBulkStatusModal} onOpenChange={setShowBulkStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status em Lote</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              Alterar o status de <strong>{selectedMotoristas.length}</strong> motorista(s) selecionado(s).
            </p>
            <Label>Novo Status</Label>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="w-full mt-2 p-2 border rounded"
              data-testid="bulk-status-select"
            >
              <option value="">Selecione o status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="aguardar_recibo">Aguardar Recibo</option>
              <option value="a_pagamento">A Pagamento</option>
              <option value="liquidado">Liquidado</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStatusModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkStatusChange} data-testid="btn-confirmar-status-lote">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Envio de Email em Massa */}
      <Dialog open={showBulkEmailModal} onOpenChange={setShowBulkEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Enviar Relatórios
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-600">
              Enviar relatório da semana <strong>{semana}/{ano}</strong> para <strong>{selectedMotoristas.length}</strong> motorista(s) selecionado(s)?
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-sm text-blue-800 font-semibold mb-1">📧 Email</p>
                <p className="text-xs text-blue-700">PDF do relatório anexado</p>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm text-green-800 font-semibold mb-1">📱 WhatsApp</p>
                <p className="text-xs text-green-700">Resumo + valores principais</p>
              </div>
            </div>
            
            <div className="text-xs text-slate-500">
              <p>Motoristas que receberão:</p>
              <ul className="list-disc list-inside mt-1 max-h-32 overflow-y-auto">
                {selectedMotoristas.map(id => {
                  const motorista = motoristas.find(m => m.motorista_id === id);
                  return <li key={id}>{motorista?.motorista_nome || id}</li>;
                })}
              </ul>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowBulkEmailModal(false)} disabled={sendingEmails}>
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkWhatsAppSend} 
              disabled={sendingEmails}
              className="bg-green-600 hover:bg-green-700"
              data-testid="btn-confirmar-enviar-whatsapp-lote"
            >
              {sendingEmails ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  WhatsApp
                </>
              )}
            </Button>
            <Button 
              onClick={handleBulkEmailSend} 
              disabled={sendingEmails}
              data-testid="btn-confirmar-enviar-email-lote"
            >
              {sendingEmails ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
};

export default ResumoSemanalParceiro;
