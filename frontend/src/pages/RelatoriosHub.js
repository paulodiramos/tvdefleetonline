import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  FileText, Plus, Edit, Check, X, Download, ArrowLeft,
  Calendar, User, DollarSign, TrendingUp, Eye, CheckCircle, Upload,
  FileSpreadsheet, Loader2, Trash2, CheckSquare, RefreshCw, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RelatoriosHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('todos');
  const [relatorios, setRelatorios] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de criação rápida
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [novoRelatorio, setNovoRelatorio] = useState({
    motorista_id: '',
    semana: '',
    ano: new Date().getFullYear(),
    ganhos_uber: 0,
    ganhos_bolt: 0,
    combustivel_total: 0,
    via_verde_total: 0,
    caucao_semanal: 0,
    outros: 0,
    divida_anterior: 0
  });

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  // Modal de edição rápida
  const [showEditModal, setShowEditModal] = useState(false);
  const [relatorioEditando, setRelatorioEditando] = useState(null);
  
  // Modal de confirmação de pagamento
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [relatorioPagando, setRelatorioPagando] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState('transferencia');
  const [observacoesPagamento, setObservacoesPagamento] = useState('');
  
  // Modal de geração em massa
  const [showGerarMassaModal, setShowGerarMassaModal] = useState(false);
  const [gerandoMassa, setGerandoMassa] = useState(false);
  const [geracaoMassaData, setGeracaoMassaData] = useState({
    data_inicio: '',
    data_fim: '',
    incluir_uber: true,
    incluir_bolt: true,
    incluir_viaverde: true,
    incluir_combustivel: true
  });
  const [resultadoGeracaoMassa, setResultadoGeracaoMassa] = useState(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [processingBulk, setProcessingBulk] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-fetch Via Verde when motorista, semana and ano are set (novo relatório)
  useEffect(() => {
    const fetchViaVerdeAuto = async () => {
      if (novoRelatorio.motorista_id && novoRelatorio.semana && novoRelatorio.ano) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${API_URL}/api/relatorios/motorista/${novoRelatorio.motorista_id}/via-verde-total?semana=${novoRelatorio.semana}&ano=${novoRelatorio.ano}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.data.total_via_verde > 0) {
            setNovoRelatorio(prev => ({ ...prev, via_verde_total: response.data.total_via_verde }));
          }
        } catch (error) {
          console.log('Via Verde auto-fetch:', error.message);
        }
      }
    };
    fetchViaVerdeAuto();
  }, [novoRelatorio.motorista_id, novoRelatorio.semana, novoRelatorio.ano]);

  const handleDownloadRecibo = async (reciboUrl) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}${reciboUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', reciboUrl.split('/').pop());
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download do recibo:', error);
      toast.error('Erro ao fazer download do recibo');
    }
  };

  const handleDownloadComprovativo = async (comprovantivoUrl) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}${comprovantivoUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', comprovantivoUrl.split('/').pop());
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download do comprovativo:', error);
      toast.error('Erro ao fazer download do comprovativo');
    }
  };

  // Função de importar CSV removida

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [relRes, motRes] = await Promise.all([
        axios.get(`${API_URL}/api/relatorios/semanais-todos`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setRelatorios(relRes.data || []);
      setMotoristas(motRes.data || []);
      setSelectedIds([]); // Clear selection on refresh
      console.log('Motoristas carregados:', motRes.data?.length || 0);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
      setRelatorios([]);
      setMotoristas([]);
    } finally {
      setLoading(false);
    }
  };

  // Selection handlers
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filteredIds = relatoriosFiltrados.map(r => r.id);
    if (selectedIds.length === filteredIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIds);
    }
  };

  const isSelected = (id) => selectedIds.includes(id);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setProcessingBulk(true);
    try {
      const token = localStorage.getItem('token');
      
      // Delete each selected report
      const deletePromises = selectedIds.map(id => 
        axios.delete(
          `${API_URL}/api/relatorios/semanal/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(deletePromises);
      
      toast.success(`${selectedIds.length} relatório(s) eliminado(s) com sucesso!`);
      setShowDeleteConfirm(false);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error('Erro ao eliminar relatórios:', error);
      toast.error('Erro ao eliminar alguns relatórios');
    } finally {
      setProcessingBulk(false);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0 || !newStatus) return;
    
    setProcessingBulk(true);
    try {
      const token = localStorage.getItem('token');
      
      // Update status for each selected report
      const updatePromises = selectedIds.map(id => 
        axios.put(
          `${API_URL}/api/relatorios/semanal/${id}/status`,
          { status: newStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(updatePromises);
      
      const statusLabels = {
        'rascunho': 'Rascunho',
        'pendente_aprovacao': 'Pendente',
        'aguarda_recibo': 'Aguarda Recibo',
        'em_analise': 'Em Análise',
        'verificado': 'Verificado',
        'pago': 'Pago',
        'rejeitado': 'Rejeitado'
      };
      
      toast.success(`Estado de ${selectedIds.length} relatório(s) atualizado para "${statusLabels[newStatus] || newStatus}"!`);
      setShowStatusChangeModal(false);
      setSelectedIds([]);
      setNewStatus('');
      fetchData();
    } catch (error) {
      console.error('Erro ao alterar estado:', error);
      toast.error('Erro ao alterar estado de alguns relatórios');
    } finally {
      setProcessingBulk(false);
    }
  };

  const calcularTotais = (dados) => {
    const ganhos = parseFloat(dados.ganhos_uber || 0) + parseFloat(dados.ganhos_bolt || 0);
    const despesas = 
      parseFloat(dados.combustivel_total || 0) +
      parseFloat(dados.via_verde_total || 0) +
      parseFloat(dados.caucao_semanal || 0) +

      parseFloat(dados.outros || 0);
    const dividaAnterior = parseFloat(dados.divida_anterior || 0);
    const total = ganhos - despesas - dividaAnterior;
    
    return { 
      ganhos, 
      despesas, 
      dividaAnterior,
      total,
      proximaDivida: total < 0 ? Math.abs(total) : 0
    };
  };

  const handleGerarEmMassa = async () => {
    if (!geracaoMassaData.data_inicio || !geracaoMassaData.data_fim) {
      toast.error('Por favor, preencha as datas de início e fim');
      return;
    }

    setGerandoMassa(true);
    setResultadoGeracaoMassa(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/relatorios/gerar-em-massa`,
        geracaoMassaData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResultadoGeracaoMassa(response.data);
      toast.success(response.data.mensagem || 'Relatórios gerados com sucesso!');
      
      // Recarregar relatórios
      await fetchData();
    } catch (error) {
      console.error('Erro ao gerar relatórios em massa:', error);
      toast.error(error.response?.data?.detail || 'Erro ao gerar relatórios');
    } finally {
      setGerandoMassa(false);
    }
  };


  const handleCriarRapido = async () => {
    console.log('=== Iniciando criação de relatório ===');
    console.log('Dados do formulário:', novoRelatorio);
    console.log('Total de motoristas disponíveis:', motoristas.length);
    
    if (!novoRelatorio.motorista_id) {
      toast.error('Selecione um motorista');
      return;
    }
    
    if (!novoRelatorio.semana) {
      toast.error('Preencha a semana');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais(novoRelatorio);
      const motorista = motoristas.find(m => m.id === novoRelatorio.motorista_id);
      
      console.log('Motorista encontrado:', motorista);
      console.log('Totais calculados:', totais);

      const payload = {
        motorista_id: novoRelatorio.motorista_id,
        semana: parseInt(novoRelatorio.semana),
        ano: parseInt(novoRelatorio.ano),
        ganhos_uber: parseFloat(novoRelatorio.ganhos_uber) || 0,
        ganhos_bolt: parseFloat(novoRelatorio.ganhos_bolt) || 0,
        combustivel_total: parseFloat(novoRelatorio.combustivel_total) || 0,
        via_verde_total: parseFloat(novoRelatorio.via_verde_total) || 0,
        caucao_semanal: parseFloat(novoRelatorio.caucao_semanal) || 0,
        outros: parseFloat(novoRelatorio.outros) || 0,
        divida_anterior: parseFloat(novoRelatorio.divida_anterior) || 0,
        ganhos_totais: totais.ganhos,
        total_despesas: totais.despesas,
        total_recibo: totais.total,
        proxima_divida: totais.proximaDivida,
        motorista_nome: motorista?.name || motorista?.nome || motorista?.email || '',
        veiculo_matricula: motorista?.veiculo_matricula || motorista?.matricula || '',
        status: 'pendente_aprovacao',
        estado: 'pendente_aprovacao',
        parceiro_id: user.id
      };

      console.log('Payload a enviar:', novoRelatorio);

      // Criar relatório no backend
      const response = await axios.post(`${API_URL}/api/relatorios/criar-manual`, novoRelatorio, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Resposta do servidor:', response.data);

      toast.success('Relatório criado com sucesso!');
      setShowCriarModal(false);
      setNovoRelatorio({
        motorista_id: '',
        semana: '',
        ano: new Date().getFullYear(),
        ganhos_uber: 0,
        ganhos_bolt: 0,
        combustivel_total: 0,
        via_verde_total: 0,
        caucao_semanal: 0,
        outros: 0,
        divida_anterior: 0
      });
      fetchData();
    } catch (error) {
      console.error('=== ERRO COMPLETO ===');
      console.error('Error object:', error);
      console.error('Response:', error.response);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      const errorMsg = error.response?.data?.detail || error.message || 'Erro ao criar relatório';
      toast.error(errorMsg);
    }
  };


  const handleExcluirRelatorio = async (relatorioId) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_URL}/api/relatorios/${relatorioId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Relatório excluído com sucesso!');
      
      // Recarregar relatórios
      await fetchData();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast.error(error.response?.data?.detail || 'Erro ao excluir relatório');
    }
  };

  const handleEditar = async (relatorio) => {
    // Se via_verde_total é 0, buscar automaticamente
    let updatedRelatorio = { ...relatorio };
    
    if (!relatorio.via_verde_total || relatorio.via_verde_total === 0) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API_URL}/api/relatorios/motorista/${relatorio.motorista_id}/via-verde-total?semana=${relatorio.semana}&ano=${relatorio.ano}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.total_via_verde > 0) {
          updatedRelatorio.via_verde_total = response.data.total_via_verde;
          toast.info(`Via Verde calculado automaticamente: €${response.data.total_via_verde}`);
        }
      } catch (error) {
        console.log('Via Verde auto-fetch on edit:', error.message);
      }
    }
    
    setRelatorioEditando(updatedRelatorio);
    setShowEditModal(true);
  };

  const handleSalvarEdicao = async () => {
    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais(relatorioEditando);

      // Se há ficheiro de recibo para fazer upload
      if (relatorioEditando.recibo_file) {
        const formData = new FormData();
        formData.append('file', relatorioEditando.recibo_file);
        formData.append('relatorio_id', relatorioEditando.id);

        // Upload do recibo
        const uploadResponse = await axios.post(
          `${API_URL}/api/relatorios/semanal/${relatorioEditando.id}/upload-recibo`,
          formData,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        // Atualizar URL do recibo e estado para "em_analise"
        relatorioEditando.recibo_url = uploadResponse.data.recibo_url;
        relatorioEditando.status = 'em_analise';
        relatorioEditando.estado = 'em_analise';
        
        toast.success('Recibo anexado! Relatório em análise.');
      }

      // Atualizar dados do relatório
      await axios.put(`${API_URL}/api/relatorios/semanal/${relatorioEditando.id}`, {
        ...relatorioEditando,
        ganhos_totais: totais.ganhos,
        total_despesas: totais.despesas,
        divida_anterior: totais.dividaAnterior,
        total_recibo: totais.total,
        proxima_divida: totais.proximaDivida,
        status: relatorioEditando.status,
        estado: relatorioEditando.estado,
        recibo_url: relatorioEditando.recibo_url
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Relatório atualizado com sucesso!');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleAprovar = async (relatorioId) => {
    if (!window.confirm('Aprovar este relatório?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioId}/aprovar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Relatório aprovado!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao aprovar');
    }
  };

  const handleRejeitar = async (relatorioId) => {
    if (!window.confirm('Rejeitar este relatório?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioId}/rejeitar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Relatório rejeitado');
      fetchData();
    } catch (error) {
      toast.error('Erro ao rejeitar');
    }
  };

  const handleMarcarPago = (relatorio) => {
    setRelatorioPagando(relatorio);
    setShowPagarModal(true);
  };

  const confirmarPagamento = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Se há comprovativo para fazer upload
      if (relatorioPagando.comprovativo_file) {
        const formData = new FormData();
        formData.append('file', relatorioPagando.comprovativo_file);

        await axios.post(
          `${API_URL}/api/relatorios/semanal/${relatorioPagando.id}/upload-comprovativo`,
          formData,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        
        toast.success('Comprovativo anexado!');
      }
      
      // Registar pagamento
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioPagando.id}/marcar-pago`, {
        data_pagamento: dataPagamento,
        metodo_pagamento: metodoPagamento,
        observacoes: observacoesPagamento
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Pagamento registado com sucesso!');
      setShowPagarModal(false);
      setRelatorioPagando(null);
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setMetodoPagamento('transferencia');
      setObservacoesPagamento('');
      fetchData();
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      toast.error(error.response?.data?.detail || 'Erro ao registar pagamento');
    }
  };

  const handleDownloadPDF = async (relatorioId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/semanal/${relatorioId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${relatorioId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF baixado!');
    } catch (error) {
      toast.error('Erro ao baixar PDF');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      'rascunho': { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
      'pendente_aprovacao': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
      'aguarda_recibo': { label: 'Aguarda Recibo', color: 'bg-orange-100 text-orange-700' },
      'em_analise': { label: 'Em Análise', color: 'bg-blue-100 text-blue-700' },
      'verificado': { label: 'Verificado', color: 'bg-green-100 text-green-700' },
      'pago': { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
      'rejeitado': { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  const handleAprovarAnalise = async (relatorioId) => {
    if (!window.confirm('Aprovar recibo e liberar para pagamento?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioId}/aprovar-analise`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Recibo aprovado! Pronto para pagamento.');
      fetchData();
    } catch (error) {
      toast.error('Erro ao aprovar análise');
    }
  };

  const filtrarRelatorios = (status) => {
    let filtrados = relatorios;
    
    // Filtro por status (tab)
    if (status === 'pendentes') filtrados = filtrados.filter(r => r.status === 'pendente' || r.status === 'pendente_aprovacao' || r.status === 'rascunho');
    else if (status === 'aguarda') filtrados = filtrados.filter(r => r.status === 'aguarda_recibo');
    else if (status === 'em_analise') filtrados = filtrados.filter(r => r.status === 'em_analise');
    else if (status === 'aguarda_pagamento') filtrados = filtrados.filter(r => r.status === 'aguarda_pagamento' || r.status === 'verificado');
    else if (status === 'pago') filtrados = filtrados.filter(r => r.status === 'pago');
    else if (status === 'pagamentos') filtrados = filtrados.filter(r => r.status === 'verificado' || r.status === 'aguarda_pagamento' || r.status === 'pago');
    
    // Filtro por data
    if (filtroDataInicio) {
      filtrados = filtrados.filter(r => {
        const dataRel = new Date(r.data_inicio || r.data_emissao);
        return dataRel >= new Date(filtroDataInicio);
      });
    }
    if (filtroDataFim) {
      filtrados = filtrados.filter(r => {
        const dataRel = new Date(r.data_fim || r.data_emissao);
        return dataRel <= new Date(filtroDataFim);
      });
    }
    
    // Filtro por semana/ano
    if (filtroSemana) {
      filtrados = filtrados.filter(r => r.semana?.toString() === filtroSemana);
    }
    if (filtroAno) {
      filtrados = filtrados.filter(r => r.ano?.toString() === filtroAno);
    }
    
    return filtrados;
  };

  const relatoriosFiltrados = filtrarRelatorios(activeTab);

  const stats = {
    total: relatorios.length,
    pendentes: relatorios.filter(r => r.status === 'pendente' || r.status === 'pendente_aprovacao' || r.status === 'rascunho').length,
    aguardaRecibo: relatorios.filter(r => r.status === 'aguarda_recibo').length,
    emAnalise: relatorios.filter(r => r.status === 'em_analise').length,
    aguardaPagamento: relatorios.filter(r => r.status === 'aguarda_pagamento' || r.status === 'verificado').length,
    pago: relatorios.filter(r => r.status === 'pago').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Relatórios Semanais
              </h1>
              <p className="text-slate-600">
                Gerir todos os relatórios num único lugar
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => setShowGerarMassaModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Gerar Relatórios Semanais
            </Button>
            <Button onClick={() => setShowCriarModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Individual
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/importar-plataformas')}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Plataformas
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Aguarda Recibo</p>
              <p className="text-2xl font-bold text-orange-600">{stats.aguardaRecibo}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Para Pagar</p>
              <p className="text-2xl font-bold text-green-600">{stats.paraPagar}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
              <div>
                <Label>Semana</Label>
                <Input
                  type="number"
                  placeholder="1-52"
                  min="1"
                  max="52"
                  value={filtroSemana}
                  onChange={(e) => setFiltroSemana(e.target.value)}
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setFiltroDataInicio('');
                    setFiltroDataFim('');
                    setFiltroSemana('');
                    setFiltroAno('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">
                {selectedIds.length} relatório(s) selecionado(s)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStatusChangeModal(true)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Alterar Estado
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar Selecionados
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar Seleção
              </Button>
            </div>
          </div>
        )}

        {/* Select All Checkbox */}
        <div className="flex items-center gap-4 mb-4">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleSelectAll}
          >
            <Checkbox 
              checked={relatoriosFiltrados.length > 0 && selectedIds.length === relatoriosFiltrados.length} 
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-slate-600">Selecionar Todos ({relatoriosFiltrados.length})</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 gap-1">
            <TabsTrigger value="todos" className="text-xs sm:text-sm px-2 py-1">Todos ({stats.total})</TabsTrigger>
            <TabsTrigger value="pendentes" className="text-xs sm:text-sm px-2 py-1">Pendentes ({stats.pendentes})</TabsTrigger>
            <TabsTrigger value="aguarda" className="text-xs sm:text-sm px-2 py-1">Aguarda Recibo ({stats.aguardaRecibo})</TabsTrigger>
            <TabsTrigger value="em_analise" className="text-xs sm:text-sm px-2 py-1">Em Análise ({stats.emAnalise})</TabsTrigger>
            <TabsTrigger value="aguarda_pagamento" className="text-xs sm:text-sm px-2 py-1">Aguarda Pag. ({stats.aguardaPagamento})</TabsTrigger>
            <TabsTrigger value="pago" className="text-xs sm:text-sm px-2 py-1">Pago ({stats.pago})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {relatoriosFiltrados.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum relatório</h3>
                  <p className="text-slate-600 mb-4">
                    Crie o primeiro relatório para começar
                  </p>
                  <Button onClick={() => setShowCriarModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Relatório
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {relatoriosFiltrados.map((rel) => (
                  <Card 
                    key={rel.id} 
                    className={`hover:shadow-md transition-shadow ${isSelected(rel.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="pt-1">
                          <Checkbox
                            checked={isSelected(rel.id)}
                            onCheckedChange={() => toggleSelect(rel.id)}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold">{rel.motorista_nome}</h3>
                            {getStatusBadge(rel.status)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-600">Período</p>
                              <p className="font-semibold">S{rel.semana}/{rel.ano}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Ganhos</p>
                              <p className="font-semibold text-green-600">
                                €{(rel.total_ganhos || rel.ganhos_totais || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">Despesas</p>
                              <p className="font-semibold text-red-600">
                                €{(rel.total_despesas || (
                                  (rel.total_combustivel || 0) + 
                                  (rel.total_via_verde || 0) + 
                                  (rel.total_eletrico || 0) + 
                                  (rel.valor_aluguer || 0)
                                )).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">Total</p>
                              <p className="text-lg font-bold text-blue-600">
                                €{(rel.valor_liquido || rel.total_recibo || (
                                  (rel.total_ganhos || rel.ganhos_totais || 0) - 
                                  ((rel.total_combustivel || 0) + (rel.total_via_verde || 0) + (rel.total_eletrico || 0) + (rel.valor_aluguer || 0))
                                )).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditar(rel)}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          {rel.status === 'pendente_aprovacao' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAprovar(rel.id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Aprovar
                            </Button>
                          )}
                          {rel.status === 'em_analise' && (
                            <>
                              {rel.recibo_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadRecibo(rel.recibo_url)}
                                  className="bg-orange-50 hover:bg-orange-100"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Ver Recibo
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPDF(rel.id)}
                                className="bg-blue-50 hover:bg-blue-100"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Ver Relatório
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleAprovarAnalise(rel.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>
                            </>
                          )}
                          {(rel.status === 'verificado' || rel.status === 'aguarda_pagamento') && (
                            <>
                              {rel.recibo_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadRecibo(rel.recibo_url)}
                                  className="bg-orange-50 hover:bg-orange-100"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Ver Recibo
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPDF(rel.id)}
                                className="bg-blue-50 hover:bg-blue-100"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Ver Relatório
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleMarcarPago(rel)}
                              >
                                <DollarSign className="w-3 h-3 mr-1" />
                                Pagar
                              </Button>
                            </>
                          )}
                          {(rel.status === 'rascunho' || rel.status === 'pendente') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExcluirRelatorio(rel.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
                          )}
                          {rel.status === 'pago' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPDF(rel.id)}
                                className="bg-blue-50 hover:bg-blue-100"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Relatório
                              </Button>
                              {rel.recibo_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadRecibo(rel.recibo_url)}
                                  className="bg-orange-50 hover:bg-orange-100"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Recibo
                                </Button>
                              )}
                              {rel.comprovativo_pagamento_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadComprovativo(rel.comprovativo_pagamento_url)}
                                  className="bg-green-50 hover:bg-green-100"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Comprovativo
                                </Button>
                              )}
                            </>
                          )}
                          {rel.status !== 'verificado' && rel.status !== 'aguarda_pagamento' && rel.status !== 'pago' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(rel.id)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal Criar */}
        <Dialog open={showCriarModal} onOpenChange={setShowCriarModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Relatório Rápido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <Label>Motorista *</Label>
                  <select
                    value={novoRelatorio.motorista_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedMotorista = motoristas.find(m => m.id === selectedId);
                      console.log('Motorista selecionado:', selectedMotorista);
                      setNovoRelatorio({ ...novoRelatorio, motorista_id: selectedId });
                    }}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="">Selecione um motorista</option>
                    {motoristas && motoristas.length > 0 ? (
                      motoristas.map(m => {
                        const nome = m.name || m.nome || m.email || 'Sem nome';
                        const matricula = m.veiculo_matricula || m.matricula || 'S/M';
                        return (
                          <option key={m.id} value={m.id}>
                            {nome} {matricula !== 'S/M' ? `- ${matricula}` : ''}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>Nenhum motorista disponível</option>
                    )}
                  </select>
                  {motoristas.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Nenhum motorista encontrado. Verifique se existem motoristas cadastrados.
                    </p>
                  )}
                  {motoristas.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Total: {motoristas.length} motorista(s) disponível(is)
                    </p>
                  )}
                </div>
                <div>
                  <Label>Semana *</Label>
                  <Input
                    type="number"
                    value={novoRelatorio.semana}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, semana: e.target.value })}
                    placeholder="1-52"
                  />
                </div>
                <div>
                  <Label>Ano *</Label>
                  <Input
                    type="number"
                    value={novoRelatorio.ano}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ano: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ganhos Uber (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.ganhos_uber}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ganhos_uber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ganhos Bolt (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.ganhos_bolt}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ganhos_bolt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Combustível (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.combustivel_total}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, combustivel_total: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="flex items-center justify-between">
                    <span>Via Verde (€)</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                      onClick={async () => {
                        if (!novoRelatorio.motorista_id || !novoRelatorio.semana || !novoRelatorio.ano) {
                          toast.error('Selecione o motorista, semana e ano primeiro');
                          return;
                        }
                        try {
                          const token = localStorage.getItem('token');
                          const response = await axios.get(
                            `${API_URL}/api/relatorios/motorista/${novoRelatorio.motorista_id}/via-verde-total?semana=${novoRelatorio.semana}&ano=${novoRelatorio.ano}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          setNovoRelatorio({ ...novoRelatorio, via_verde_total: response.data.total_via_verde });
                          toast.success(`Via Verde calculado: €${response.data.total_via_verde} (${response.data.registos_portagens} registos)`);
                        } catch (error) {
                          console.error('Erro ao calcular Via Verde:', error);
                          toast.error('Erro ao calcular Via Verde');
                        }
                      }}
                    >
                      Calcular
                    </Button>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.via_verde_total}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, via_verde_total: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Caução (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.caucao_semanal}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, caucao_semanal: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Outros (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.outros}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, outros: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dívida Anterior (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.divida_anterior}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, divida_anterior: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Dívida da semana anterior (se existir)
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Ganhos:</span>
                  <span className="font-bold text-green-600">
                    €{calcularTotais(novoRelatorio).ganhos.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Despesas:</span>
                  <span className="font-bold text-red-600">
                    €{calcularTotais(novoRelatorio).despesas.toFixed(2)}
                  </span>
                </div>
                {calcularTotais(novoRelatorio).dividaAnterior > 0 && (
                  <div className="flex justify-between text-sm mb-2">
                    <span>Dívida Anterior:</span>
                    <span className="font-bold text-orange-600">
                      €{calcularTotais(novoRelatorio).dividaAnterior.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className={`text-lg font-bold ${calcularTotais(novoRelatorio).total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    €{calcularTotais(novoRelatorio).total.toFixed(2)}
                  </span>
                </div>
                {calcularTotais(novoRelatorio).total < 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      ⚠️ Valor negativo! Próxima dívida: €{calcularTotais(novoRelatorio).proximaDivida.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCriarModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarRapido}>
                Criar Relatório
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmar Pagamento */}
        <Dialog open={showPagarModal} onOpenChange={setShowPagarModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar Pagamento do Relatório</DialogTitle>
            </DialogHeader>
            {relatorioPagando && (
              <div className="space-y-6">
                {/* Dados do Relatório */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Dados do Relatório</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Motorista:</p>
                      <p className="font-semibold">{relatorioPagando.motorista_nome}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Período:</p>
                      <p className="font-semibold">Semana {relatorioPagando.semana}/{relatorioPagando.ano}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Número:</p>
                      <p className="font-semibold">{relatorioPagando.numero_relatorio}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Veículo:</p>
                      <p className="font-semibold">{relatorioPagando.veiculo_matricula || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Valores Detalhados */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Resumo Financeiro</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Ganhos Uber:</span>
                      <span className="font-semibold">€{(relatorioPagando.ganhos_uber || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">Ganhos Bolt:</span>
                      <span className="font-semibold">€{(relatorioPagando.ganhos_bolt || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-green-700 border-t pt-2">
                      <span>Total Ganhos:</span>
                      <span>€{(relatorioPagando.ganhos_totais || 0).toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t mt-3 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Combustível:</span>
                        <span className="font-semibold">€{(relatorioPagando.combustivel_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Via Verde:</span>
                        <span className="font-semibold">€{(relatorioPagando.via_verde_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Caução:</span>
                        <span className="font-semibold">€{(relatorioPagando.caucao_semanal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Outros:</span>
                        <span className="font-semibold">€{(relatorioPagando.outros || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm font-semibold text-red-700 border-t pt-2">
                      <span>Total Despesas:</span>
                      <span>€{(relatorioPagando.total_despesas || 0).toFixed(2)}</span>
                    </div>

                    {relatorioPagando.divida_anterior > 0 && (
                      <div className="flex justify-between text-sm font-semibold text-orange-700 border-t pt-2">
                        <span>Dívida Anterior:</span>
                        <span>€{(relatorioPagando.divida_anterior || 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-lg font-bold text-blue-700 border-t-2 pt-3 mt-3">
                      <span>Valor a Pagar:</span>
                      <span>€{(relatorioPagando.total_recibo || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Documentos */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Documentos</h3>
                  <div className="flex gap-3">
                    {relatorioPagando.recibo_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadRecibo(relatorioPagando.recibo_url)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Recibo
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(relatorioPagando.id)}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Relatório PDF
                    </Button>
                  </div>
                </div>

                {/* Dados do Pagamento */}
                <div className="p-4 border-2 border-green-200 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Dados do Pagamento</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Data de Pagamento *</Label>
                      <Input
                        type="date"
                        value={dataPagamento}
                        onChange={(e) => setDataPagamento(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Método de Pagamento *</Label>
                      <select
                        value={metodoPagamento}
                        onChange={(e) => setMetodoPagamento(e.target.value)}
                        className="w-full border rounded-md p-2"
                      >
                        <option value="transferencia">Transferência Bancária</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="mbway">MB Way</option>
                        <option value="multibanco">Multibanco</option>
                        <option value="cheque">Cheque</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <Label>Comprovativo de Pagamento (opcional)</Label>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setRelatorioPagando({ 
                              ...relatorioPagando, 
                              comprovativo_file: e.target.files[0] 
                            });
                          }
                        }}
                      />
                      <p className="text-xs text-slate-600 mt-1">
                        Anexe comprovativo de transferência, recibo, etc. (PDF, JPG, PNG - máx. 10MB)
                      </p>
                      {relatorioPagando.comprovativo_file && (
                        <div className="mt-2 p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium">
                            📎 {relatorioPagando.comprovativo_file.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {(relatorioPagando.comprovativo_file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Input
                        placeholder="Observações sobre o pagamento (opcional)"
                        value={observacoesPagamento}
                        onChange={(e) => setObservacoesPagamento(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Atenção:</strong> Ao confirmar, o relatório será marcado como pago e não poderá ser alterado. 
                    Verifique todos os dados antes de confirmar.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPagarModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={confirmarPagamento}
                className="bg-green-600 hover:bg-green-700"
                disabled={!dataPagamento}
              >
                <Check className="w-4 h-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Editar */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Relatório</DialogTitle>
            </DialogHeader>
            {relatorioEditando && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded">
                  <p className="font-semibold">{relatorioEditando.motorista_nome}</p>
                  <p className="text-sm text-slate-600">
                    Semana {relatorioEditando.semana}/{relatorioEditando.ano}
                  </p>
                </div>

                <div>
                  <Label>Estado do Relatório</Label>
                  <select
                    value={relatorioEditando.status || relatorioEditando.estado}
                    onChange={(e) => setRelatorioEditando({ 
                      ...relatorioEditando, 
                      status: e.target.value,
                      estado: e.target.value
                    })}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="pendente_aprovacao">Pendente Aprovação</option>
                    <option value="aguarda_recibo">Aguarda Recibo</option>
                    <option value="em_analise">Em Análise</option>
                    <option value="verificado">Verificado</option>
                    <option value="pago">Pago</option>
                    <option value="rejeitado">Rejeitado</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ganhos Uber (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_uber || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, ganhos_uber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Ganhos Bolt (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_bolt || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, ganhos_bolt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Combustível (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.combustivel_total || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, combustivel_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center justify-between">
                      <span>Via Verde (€)</span>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                        onClick={async () => {
                          if (!relatorioEditando.motorista_id || !relatorioEditando.semana || !relatorioEditando.ano) {
                            toast.error('Dados do relatório incompletos');
                            return;
                          }
                          try {
                            const token = localStorage.getItem('token');
                            const response = await axios.get(
                              `${API_URL}/api/relatorios/motorista/${relatorioEditando.motorista_id}/via-verde-total?semana=${relatorioEditando.semana}&ano=${relatorioEditando.ano}`,
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            setRelatorioEditando({ ...relatorioEditando, via_verde_total: response.data.total_via_verde });
                            toast.success(`Via Verde calculado: €${response.data.total_via_verde} (${response.data.registos_portagens} registos)`);
                          } catch (error) {
                            console.error('Erro ao calcular Via Verde:', error);
                            toast.error('Erro ao calcular Via Verde');
                          }
                        }}
                      >
                        Calcular
                      </Button>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.via_verde_total || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, via_verde_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Caução (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.caucao_semanal || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, caucao_semanal: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Outros (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.outros || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, outros: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Aluguer/Comissão Veículo (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.aluguer_veiculo || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, aluguer_veiculo: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Valor semanal fixo de aluguer ou comissão
                    </p>
                  </div>
                  <div>
                    <Label>KM Efetuados</Label>
                    <Input
                      type="number"
                      step="1"
                      value={relatorioEditando.km_percorridos || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, km_percorridos: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Quilómetros percorridos na semana
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label>Dívida Anterior (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.divida_anterior || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, divida_anterior: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Ajustar dívida da semana anterior manualmente
                    </p>
                  </div>
                </div>

                {/* Upload de Recibo */}
                {(relatorioEditando.status === 'aguarda_recibo' || relatorioEditando.status === 'verificado') && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-600" />
                      Anexar Recibo do Motorista
                    </h4>
                    
                    {relatorioEditando.recibo_url ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Recibo já anexado
                        </p>
                        <a 
                          href={relatorioEditando.recibo_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          Ver recibo atual
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setRelatorioEditando({ ...relatorioEditando, recibo_url: '' })}
                        >
                          Substituir recibo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setRelatorioEditando({ 
                                ...relatorioEditando, 
                                recibo_file: e.target.files[0] 
                              });
                            }
                          }}
                        />
                        <p className="text-xs text-slate-600">
                          Aceita: PDF, JPG, PNG (máx. 5MB)
                        </p>
                        {relatorioEditando.recibo_file && (
                          <div className="p-3 bg-blue-50 rounded">
                            <p className="text-sm font-medium">
                              Ficheiro selecionado: {relatorioEditando.recibo_file.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              Tamanho: {(relatorioEditando.recibo_file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-800">


      {/* Modal Gerar Relatórios em Massa */}
      <Dialog open={showGerarMassaModal} onOpenChange={setShowGerarMassaModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Relatórios Semanais Automaticamente</DialogTitle>
          </DialogHeader>
          
          {!resultadoGeracaoMassa ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Esta função irá criar relatórios semanais em <span className="font-semibold text-slate-800">rascunho</span> para todos os motoristas ativos, 
                  sincronizando automaticamente os dados importados da Uber, Bolt, Via Verde e Combustível.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900 font-semibold">📝 Fluxo Recomendado:</p>
                  <ol className="text-sm text-blue-800 list-decimal list-inside mt-2 space-y-1">
                    <li>Importar dados das plataformas (Uber, Bolt, Via Verde, etc.)</li>
                    <li>Gerar relatórios semanais (cria rascunhos automaticamente)</li>
                    <li>Revisar e ajustar valores na aba &quot;Rascunho&quot;</li>
                    <li>Aprovar para enviar aos motoristas e parceiros</li>
                  </ol>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Seleção de Semana */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Semana do Ano</Label>
                    <Input
                      type="number"
                      min="1"
                      max="53"
                      placeholder="Ex: 49"
                      onChange={(e) => {
                        const semana = parseInt(e.target.value);
                        if (semana >= 1 && semana <= 53) {
                          // Calcular datas da semana (segunda a domingo)
                          const ano = new Date().getFullYear();
                          const primeiraSegunda = new Date(ano, 0, 1 + (semana - 1) * 7);
                          const diaSemana = primeiraSegunda.getDay();
                          const diasAteSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
                          primeiraSegunda.setDate(primeiraSegunda.getDate() + diasAteSegunda);
                          
                          const ultimoDomingo = new Date(primeiraSegunda);
                          ultimoDomingo.setDate(primeiraSegunda.getDate() + 6);
                          
                          setGeracaoMassaData({
                            ...geracaoMassaData,
                            data_inicio: primeiraSegunda.toISOString().split('T')[0],
                            data_fim: ultimoDomingo.toISOString().split('T')[0]
                          });
                        }
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Preencha para calcular datas automaticamente
                    </p>
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={new Date().getFullYear()}
                      readOnly
                      className="bg-slate-50"
                    />
                  </div>
                </div>

                {/* Datas Manuais */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Início *</Label>
                    <Input
                      type="date"
                      value={geracaoMassaData.data_inicio}
                      onChange={(e) => setGeracaoMassaData({...geracaoMassaData, data_inicio: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Data Fim *</Label>
                    <Input
                      type="date"
                      value={geracaoMassaData.data_fim}
                      onChange={(e) => setGeracaoMassaData({...geracaoMassaData, data_fim: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="font-semibold">Incluir Dados de:</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="incluir_uber"
                    checked={geracaoMassaData.incluir_uber}
                    onChange={(e) => setGeracaoMassaData({...geracaoMassaData, incluir_uber: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="incluir_uber" className="text-sm">Uber</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="incluir_bolt"
                    checked={geracaoMassaData.incluir_bolt}
                    onChange={(e) => setGeracaoMassaData({...geracaoMassaData, incluir_bolt: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="incluir_bolt" className="text-sm">Bolt</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="incluir_viaverde"
                    checked={geracaoMassaData.incluir_viaverde}
                    onChange={(e) => setGeracaoMassaData({...geracaoMassaData, incluir_viaverde: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="incluir_viaverde" className="text-sm">Via Verde</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="incluir_combustivel"
                    checked={geracaoMassaData.incluir_combustivel}
                    onChange={(e) => setGeracaoMassaData({...geracaoMassaData, incluir_combustivel: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="incluir_combustivel" className="text-sm">Combustível/Carregamentos</label>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como Funciona:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Sistema busca todos os motoristas ativos</li>
                  <li>Agrega ganhos e despesas do período selecionado</li>
                  <li>Calcula aluguer e caução automaticamente</li>
                  <li>Cria relatórios em status &quot;Rascunho&quot;</li>
                  <li>Você pode revisar e ajustar antes de enviar ao motorista</li>
                </ul>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-900">
                  ✅ <strong>Via Verde Automático:</strong> O sistema busca automaticamente Via Verde da semana anterior. 
                  Para relatório da semana 45, importa Via Verde da semana 44 - será incluído automaticamente!
                </p>
                <p className="text-xs text-green-800 mt-1">
                  Exemplo: Relatório Sem 45 (04-10 Nov) → Uber/Bolt Sem 45 + Via Verde Sem 44 (28 Out-03 Nov)
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGerarMassaModal(false)}
                  disabled={gerandoMassa}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGerarEmMassa}
                  disabled={gerandoMassa}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {gerandoMassa ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Gerar Relatórios
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 text-lg mb-2">
                  ✅ Relatórios Gerados com Sucesso!
                </h3>
                <p className="text-green-800">
                  {resultadoGeracaoMassa.sucesso} relatório(s) criado(s) em status &quot;Rascunho&quot;
                </p>
                {resultadoGeracaoMassa.erros > 0 && (
                  <p className="text-amber-700 mt-2">
                    ⚠️ {resultadoGeracaoMassa.erros} erro(s) encontrado(s)
                  </p>
                )}
              </div>
              
              {resultadoGeracaoMassa.relatorios_criados && resultadoGeracaoMassa.relatorios_criados.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Relatórios Criados:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {resultadoGeracaoMassa.relatorios_criados.map((rel, idx) => (
                      <div key={idx} className="bg-white border rounded p-3 text-sm">
                        <p className="font-medium">{rel.motorista}</p>
                        <p className="text-slate-600">
                          Semana {rel.semana}/{rel.ano} - Ganhos: €{rel.ganhos_totais.toFixed(2)} - A Pagar: €{rel.total_a_pagar.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {resultadoGeracaoMassa.erros_detalhes && resultadoGeracaoMassa.erros_detalhes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Erros:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {resultadoGeracaoMassa.erros_detalhes.map((erro, idx) => (
                      <div key={idx} className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800">
                        <p className="font-medium">{erro.motorista}</p>
                        <p>{erro.erro}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowGerarMassaModal(false);
                    setResultadoGeracaoMassa(null);
                    setGeracaoMassaData({
                      data_inicio: '',
                      data_fim: '',
                      incluir_uber: true,
                      incluir_bolt: true,
                      incluir_viaverde: true,
                      incluir_combustivel: true
                    });
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

                        💡 Após anexar o recibo, o relatório ficará disponível para pagamento
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Ganhos:</span>
                    <span className="font-bold text-green-600">
                      €{calcularTotais(relatorioEditando).ganhos.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Despesas:</span>
                    <span className="font-bold text-red-600">
                      €{calcularTotais(relatorioEditando).despesas.toFixed(2)}
                    </span>
                  </div>
                  {calcularTotais(relatorioEditando).dividaAnterior > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span>Dívida Anterior:</span>
                      <span className="font-bold text-orange-600">
                        €{calcularTotais(relatorioEditando).dividaAnterior.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total:</span>
                    <span className={`text-lg font-bold ${calcularTotais(relatorioEditando).total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      €{calcularTotais(relatorioEditando).total.toFixed(2)}
                    </span>
                  </div>
                  {calcularTotais(relatorioEditando).total < 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-700">
                        ⚠️ Valor negativo! Próxima dívida: €{calcularTotais(relatorioEditando).proximaDivida.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarEdicao}>
                Guardar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Eliminação */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Confirmar Eliminação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-700">
                Tem certeza que deseja eliminar <strong>{selectedIds.length}</strong> relatório(s)?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Esta ação é irreversível. Todos os dados dos relatórios selecionados serão permanentemente eliminados.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={processingBulk}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkDelete} 
                className="bg-red-600 hover:bg-red-700"
                disabled={processingBulk}
              >
                {processingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A eliminar...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar {selectedIds.length} Relatório(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Alteração de Estado em Lote */}
        <Dialog open={showStatusChangeModal} onOpenChange={setShowStatusChangeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Estado dos Relatórios</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-700">
                Selecione o novo estado para os <strong>{selectedIds.length}</strong> relatório(s) selecionado(s):
              </p>
              <div>
                <Label>Novo Estado</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="pendente_aprovacao">Pendente</SelectItem>
                    <SelectItem value="aguarda_recibo">Aguarda Recibo</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="verificado">Verificado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusChangeModal(false)} disabled={processingBulk}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkStatusChange} 
                disabled={!newStatus || processingBulk}
              >
                {processingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A processar...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Aplicar a {selectedIds.length} Relatório(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Importar CSV - Removido */}
      </div>
    </div>
  );
};

export default RelatoriosHub;