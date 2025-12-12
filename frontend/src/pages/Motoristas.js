import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import FilterBar from '@/components/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, CheckCircle, Clock, FileText, Plus, Mail, Phone, MapPin, CreditCard, Edit, X, Save, Trash2, Download, Package, Upload, AlertTriangle, XCircle, Ban, CheckCircle2 } from 'lucide-react';

const Motoristas = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false);
  const [showEscolherPlanoDialog, setShowEscolherPlanoDialog] = useState(false);
  const [planosDisponiveis, setPlanosDisponiveis] = useState([]);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [atribuicaoData, setAtribuicaoData] = useState({
    motorista_id: '',
    parceiro_id: '',
    veiculo_id: '',
    tipo_motorista: 'independente'
  });
  const [parceiros, setParceiros] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [showContractConfirmDialog, setShowContractConfirmDialog] = useState(false);
  const [assignedDriverData, setAssignedDriverData] = useState(null);
  const [filters, setFilters] = useState({
    parceiro: 'all',
    status: 'all',
    search: ''
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [newMotorista, setNewMotorista] = useState({
    email: '',
    name: '',
    phone: '',
    morada_completa: '',
    codigo_postal: '',
    data_nascimento: '',
    nacionalidade: 'Portuguesa',
    tipo_documento: 'CC',
    numero_documento: '',
    validade_documento: '',
    nif: '',
    carta_conducao_numero: '',
    carta_conducao_validade: '',
    licenca_tvde_numero: '',
    licenca_tvde_validade: '',
    regime: 'aluguer',
    iban: '',
    whatsapp: '',
    tipo_pagamento: 'recibo_verde',
    senha_provisoria: true
  });

  useEffect(() => {
    fetchMotoristas();
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    }
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchVeiculosByParceiro = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles?parceiro_id=${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculos(response.data.filter(v => v.status === 'disponivel' || v.status === 'atribuido'));
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVeiculos([]);
    }
  };

  const fetchMotoristas = async () => {
    try {
      const response = await axios.get(`${API}/motoristas`);
      setMotoristas(response.data);
    } catch (error) {
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (motoristaId) => {
    try {
      await axios.put(`${API}/motoristas/${motoristaId}/approve`);
      toast.success('Motorista aprovado com sucesso!');
      fetchMotoristas();
    } catch (error) {
      toast.error('Erro ao aprovar motorista');
    }
  };
  const fetchPlanosDisponiveis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos-motorista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanosDisponiveis(response.data.filter(p => p.ativo));
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    }
  };

  const handleAtribuirPlano = async () => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${selectedMotorista.id}`,
        {
          plano_id: planoSelecionado.id,
          plano_nome: planoSelecionado.nome,
          plano_features: {
            features: planoSelecionado.features,
            preco_mensal: planoSelecionado.preco_mensal
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Plano atribuído com sucesso!');
      setShowEscolherPlanoDialog(false);
      setPlanoSelecionado(null);
      
      // Refresh list first
      await fetchMotoristas();
      
      // Then get fresh motorista details to update the modal
      const response = await axios.get(`${API}/motoristas/${selectedMotorista.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMotorista(response.data);
    } catch (error) {
      console.error('Error assigning plan:', error);
      toast.error('Erro ao atribuir plano');
    }
  };

  const handleAddMotorista = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let response;
      
      // Parceiro e Gestor usam endpoint específico que cria com senha provisória
      if (user.role === 'parceiro' || user.role === 'gestao') {
        response = await axios.post(
          `${API}/parceiros/${user.id}/motoristas`,
          newMotorista,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Mostrar a senha provisória gerada
        if (response.data.senha_provisoria) {
          toast.success(
            `Motorista criado! Senha provisória: ${response.data.senha_provisoria}`,
            { duration: 10000 }
          );
        }
      } else {
        // Admin usa endpoint público de registro
        response = await axios.post(`${API}/motoristas/register`, newMotorista);
        toast.success('Motorista adicionado! Senha provisória: últimos 9 dígitos do telefone');
      }
      
      setShowAddDialog(false);
      fetchMotoristas();
      setNewMotorista({
        email: '',
        name: '',
        phone: '',
        morada_completa: '',
        codigo_postal: '',
        data_nascimento: '',
        nacionalidade: 'Portuguesa',
        tipo_documento: 'CC',
        numero_documento: '',
        validade_documento: '',
        nif: '',
        carta_conducao_numero: '',
        carta_conducao_validade: '',
        licenca_tvde_numero: '',
        licenca_tvde_validade: ''
      });
    } catch (error) {
      console.error('Error adding motorista:', error);
      toast.error('Erro ao adicionar motorista');
    }
  };

  const handleDownloadCSVExample = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/csv-examples/motoristas`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'exemplo_motoristas.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Exemplo de motoristas descarregado');
    } catch (error) {
      console.error('Erro ao descarregar exemplo:', error);
      toast.error('Erro ao descarregar exemplo CSV');
    }
  };

  const handleImportCSV = async (file) => {
    console.log('handleImportCSV chamado com file:', file);
    
    if (!file) {
      console.log('Nenhum ficheiro selecionado');
      toast.error('Por favor selecione um ficheiro');
      return;
    }
    
    console.log('Ficheiro selecionado:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Verificar permissões e obter parceiro_id
    let parceiro_id;
    
    if (user.role === 'parceiro') {
      // Para parceiros, o user.id É o parceiro_id
      parceiro_id = user.id;
      console.log('Parceiro logado - usando user.id como parceiro_id:', parceiro_id);
    } else if (user.role === 'admin' || user.role === 'gestao') {
      // Para admin/gestão, precisa ir à página do parceiro específico
      toast.error('Por favor, vá à página do parceiro específico para importar motoristas');
      return;
    } else {
      toast.error('Sem permissão para importar motoristas');
      return;
    }
    
    setImportLoading(true);
    toast.info('A processar ficheiro...');
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const endpoint = `${API}/parceiros/${parceiro_id}/importar-motoristas`;
      
      console.log('A enviar para endpoint:', endpoint);
      
      const response = await axios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Resposta recebida:', response.data);
      
      const { motoristas_criados, erros, total_linhas } = response.data;
      
      if (erros && erros.length > 0) {
        toast.warning(
          `${motoristas_criados} de ${total_linhas} importados com sucesso. ${erros.length} erros encontrados.`,
          { duration: 5000 }
        );
        console.error('Erros na importação:', erros);
      } else {
        toast.success(`${motoristas_criados} motoristas importados com sucesso!`);
      }
      
      // Refresh list
      fetchMotoristas();
      setShowImportDialog(false);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Erro ao importar CSV: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImportLoading(false);
    }
  };

  const handleEditMotorista = () => {
    setEditForm({
      ...selectedMotorista,
      // Inicializar emails Uber/Bolt com email do motorista se vazios
      email_uber: selectedMotorista.email_uber || selectedMotorista.email,
      email_bolt: selectedMotorista.email_bolt || selectedMotorista.email
    });
    setIsEditing(true);
    
    // Load vehicles if parceiro is already assigned
    if (selectedMotorista.parceiro_atribuido) {
      fetchVeiculosByParceiro(selectedMotorista.parceiro_atribuido);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveMotorista = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/motoristas/${selectedMotorista.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Motorista atualizado com sucesso!');
      setIsEditing(false);
      setShowDetailDialog(false);
      fetchMotoristas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar motorista');
    }
  };

  const handleUploadDocument = async (tipoDocumento, file, file2 = null) => {
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('tipo_documento', tipoDocumento);
    formData.append('file', file);
    if (file2) formData.append('file2', file2);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/motoristas/${selectedMotorista.id}/upload-documento`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
          // Don't set Content-Type - let axios set it with boundary
        }
      });
      
      toast.success('Documento enviado com sucesso!');
      fetchMotoristas();
      // Refresh selected motorista
      const response = await axios.get(`${API}/motoristas/${selectedMotorista.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMotorista(response.data);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Erro ao enviar documento';
      toast.error(errorMessage);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async (documentPath) => {
    try {
      // Extract path after "uploads/motoristas/"
      // e.g., "uploads/motoristas/motorista-001/file.pdf" -> "motorista-001/file.pdf"
      const pathParts = documentPath.split('motoristas/');
      const relativePath = pathParts.length > 1 ? pathParts[1] : documentPath.split('/').pop();
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/files/motoristas/${relativePath}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Extract just the filename for download
      const filename = documentPath.split('/').pop();
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      const errorMessage = error.response?.data?.detail || 'Erro ao fazer download do documento';
      toast.error(errorMessage);
    }
  };

  const handleDeleteMotorista = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir o motorista ${selectedMotorista.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/motoristas/${selectedMotorista.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Motorista excluído com sucesso!');
      setShowDetailDialog(false);
      setSelectedMotorista(null);
      
      // Add delay before refreshing to ensure backend completes deletion
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchMotoristas();
    } catch (error) {
      toast.error('Erro ao excluir motorista');
    }
  };

  const handleDesativarMotorista = async (motoristaId, motoristaNome) => {
    if (!window.confirm(`Tem certeza que deseja desativar o motorista ${motoristaNome}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/motoristas/${motoristaId}/desativar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Motorista desativado com sucesso!');
      fetchMotoristas();
      
      // Update selected motorista if in detail dialog
      if (selectedMotorista && selectedMotorista.id === motoristaId) {
        const response = await axios.get(`${API}/motoristas/${motoristaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedMotorista(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao desativar motorista');
    }
  };

  const handleAtivarMotorista = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/motoristas/${motoristaId}/ativar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Motorista ativado com sucesso!');
      fetchMotoristas();
      
      // Update selected motorista if in detail dialog
      if (selectedMotorista && selectedMotorista.id === motoristaId) {
        const response = await axios.get(`${API}/motoristas/${motoristaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedMotorista(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao ativar motorista');
    }
  };

  const handleOpenAtribuirModal = (motorista) => {
    setSelectedMotorista(motorista);
    setAtribuicaoData({
      motorista_id: motorista.id,
      parceiro_id: motorista.parceiro_atribuido || '',
      veiculo_id: motorista.veiculo_atribuido || '',
      tipo_motorista: motorista.tipo_motorista || 'independente'
    });
    setShowAtribuirDialog(true);
    
    // Load vehicles if parceiro is already selected
    if (motorista.parceiro_atribuido) {
      fetchVeiculosByParceiro(motorista.parceiro_atribuido);
    }
  };

  const handleAtribuirParceiro = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        parceiro_atribuido: atribuicaoData.parceiro_id || null,
        veiculo_atribuido: atribuicaoData.veiculo_id || null,
        tipo_motorista: atribuicaoData.tipo_motorista
      };

      await axios.put(`${API}/motoristas/${atribuicaoData.motorista_id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Motorista atribuído com sucesso!');
      setShowAtribuirDialog(false);

      // If a vehicle was assigned, ask if user wants to create a contract
      if (atribuicaoData.veiculo_id) {
        const motorista = motoristas.find(m => m.id === atribuicaoData.motorista_id);
        const parceiro = parceiros.find(p => p.id === atribuicaoData.parceiro_id);
        const veiculo = veiculos.find(v => v.id === atribuicaoData.veiculo_id);
        
        setAssignedDriverData({
          motorista,
          parceiro,
          veiculo,
          motorista_id: atribuicaoData.motorista_id,
          parceiro_id: atribuicaoData.parceiro_id,
          veiculo_id: atribuicaoData.veiculo_id
        });
        setShowContractConfirmDialog(true);
      }

      setAtribuicaoData({
        motorista_id: '',
        parceiro_id: '',
        veiculo_id: '',
        tipo_motorista: 'independente'
      });
      fetchMotoristas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atribuir motorista');
    }
  };

  const handleCreateContract = () => {
    setShowContractConfirmDialog(false);
    // Navigate to contracts page with pre-filled data
    navigate('/contratos', { 
      state: { 
        prefilledData: {
          motorista_id: assignedDriverData.motorista_id,
          parceiro_id: assignedDriverData.parceiro_id,
          veiculo_id: assignedDriverData.veiculo_id
        }
      } 
    });
  };

  const handleSkipContract = () => {
    setShowContractConfirmDialog(false);
    setAssignedDriverData(null);
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Filter motoristas
  const filteredMotoristas = useMemo(() => {
    return motoristas.filter(motorista => {
      if (filters.parceiro && filters.parceiro !== 'all' && motorista.parceiro_atribuido !== filters.parceiro) return false;
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'aprovado' && !motorista.approved) return false;
        if (filters.status === 'pendente' && motorista.approved) return false;
        if (filters.status === 'nao_atribuido' && motorista.parceiro_atribuido) return false;
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = `${motorista.name} ${motorista.email} ${motorista.phone || ''}`.toLowerCase();
        if (!searchableText.includes(searchLower)) return false;
      }
      return true;
    });
  }, [motoristas, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      parceiro: 'all',
      status: 'all',
      search: ''
    });
  };

  const filterOptions = {
    search: {
      type: 'text',
      label: 'Pesquisar',
      placeholder: 'Nome, email ou telefone...'
    },
    parceiro: {
      type: 'select',
      label: 'Parceiro',
      placeholder: 'Todos os parceiros',
      items: parceiros.map(p => ({ value: p.id, label: p.nome }))
    },
    status: {
      type: 'select',
      label: 'Status',
      placeholder: 'Todos',
      items: [
        { value: 'aprovado', label: 'Aprovado' },
        { value: 'pendente', label: 'Pendente Aprovação' },
        { value: 'nao_atribuido', label: 'Não Atribuído' }
      ]
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="motoristas-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Motoristas</h1>
            <p className="text-slate-600">Gerir motoristas e aprovações</p>
          </div>
          <div className="flex gap-3">
            {user.role === 'parceiro' && (
              <Button 
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Button>
            )}
            {(user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700" data-testid="add-motorista-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Motorista
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="add-motorista-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Motorista</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMotorista} className="space-y-6">
                  <Tabs defaultValue="pessoal" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
                      <TabsTrigger value="documentacao">Documentação</TabsTrigger>
                      <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pessoal" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome Completo *</Label>
                          <Input value={newMotorista.name} onChange={(e) => setNewMotorista({...newMotorista, name: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input type="email" value={newMotorista.email} onChange={(e) => setNewMotorista({...newMotorista, email: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefone *</Label>
                          <Input value={newMotorista.phone} onChange={(e) => setNewMotorista({...newMotorista, phone: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>WhatsApp</Label>
                          <Input value={newMotorista.whatsapp} onChange={(e) => setNewMotorista({...newMotorista, whatsapp: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Data Nascimento</Label>
                          <Input type="date" value={newMotorista.data_nascimento} onChange={(e) => setNewMotorista({...newMotorista, data_nascimento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nacionalidade</Label>
                          <Input value={newMotorista.nacionalidade} onChange={(e) => setNewMotorista({...newMotorista, nacionalidade: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Morada Completa</Label>
                        <Input value={newMotorista.morada_completa} onChange={(e) => setNewMotorista({...newMotorista, morada_completa: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Código Postal</Label>
                        <Input value={newMotorista.codigo_postal} onChange={(e) => setNewMotorista({...newMotorista, codigo_postal: e.target.value})} />
                      </div>
                    </TabsContent>
                    <TabsContent value="documentacao" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo Documento</Label>
                          <Select value={newMotorista.tipo_documento} onValueChange={(value) => setNewMotorista({...newMotorista, tipo_documento: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CC">Cartão Cidadão</SelectItem>
                              <SelectItem value="Passaporte">Passaporte</SelectItem>
                              <SelectItem value="Residencia">Residência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Documento</Label>
                          <Input value={newMotorista.numero_documento} onChange={(e) => setNewMotorista({...newMotorista, numero_documento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade Documento</Label>
                          <Input type="date" value={newMotorista.validade_documento} onChange={(e) => setNewMotorista({...newMotorista, validade_documento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>NIF</Label>
                          <Input value={newMotorista.nif} onChange={(e) => setNewMotorista({...newMotorista, nif: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Carta Condução</Label>
                          <Input value={newMotorista.carta_conducao_numero} onChange={(e) => setNewMotorista({...newMotorista, carta_conducao_numero: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade Carta</Label>
                          <Input type="date" value={newMotorista.carta_conducao_validade} onChange={(e) => setNewMotorista({...newMotorista, carta_conducao_validade: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Licença TVDE</Label>
                          <Input value={newMotorista.licenca_tvde_numero} onChange={(e) => setNewMotorista({...newMotorista, licenca_tvde_numero: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade TVDE</Label>
                          <Input type="date" value={newMotorista.licenca_tvde_validade} onChange={(e) => setNewMotorista({...newMotorista, licenca_tvde_validade: e.target.value})} />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="financeiro" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>IBAN</Label>
                          <Input value={newMotorista.iban} onChange={(e) => setNewMotorista({...newMotorista, iban: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Regime</Label>
                          <Select value={newMotorista.regime} onValueChange={(value) => setNewMotorista({...newMotorista, regime: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aluguer">Aluguer</SelectItem>
                              <SelectItem value="comissao">Comissão</SelectItem>
                              <SelectItem value="carro_proprio">Carro Próprio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo Pagamento</Label>
                          <Select value={newMotorista.tipo_pagamento} onValueChange={(value) => setNewMotorista({...newMotorista, tipo_pagamento: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fatura">Fatura</SelectItem>
                              <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                              <SelectItem value="sem_recibo">Sem Recibo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700"><strong>Nota:</strong> Será criada uma senha provisória com os últimos 9 dígitos do telefone. O motorista deverá alterá-la no primeiro login.</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Adicionar Motorista
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {motoristas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum motorista registado</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
              options={filterOptions}
            />

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">
                Mostrando {filteredMotoristas.length} de {motoristas.length} motoristas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMotoristas.map((motorista) => (
              <Card key={motorista.id} className="card-hover" data-testid={`motorista-card-${motorista.id}`}>
                <CardHeader>
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                        {getInitials(motorista.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{motorista.name}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">{motorista.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {motorista.approved ? (
                          <Badge className="bg-blue-100 text-blue-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aprovado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                        
                        {/* Plano Badge */}
                        {motorista.plano_nome && (
                          <Badge className="bg-purple-100 text-purple-800">
                            <Package className="w-3 h-3 mr-1" />
                            {motorista.plano_nome}
                          </Badge>
                        )}
                        
                        {/* Status Badge */}
                        {motorista.status_motorista === 'ativo' && (
                          <Badge className="bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                            Ativo
                          </Badge>
                        )}
                        {motorista.status_motorista === 'aguarda_carro' && (
                          <Badge className="bg-blue-100 text-blue-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h7M9 12h7M9 16h7"/></svg>
                            Aguarda Carro
                          </Badge>
                        )}
                        {motorista.status_motorista === 'ferias' && (
                          <Badge className="bg-purple-100 text-purple-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
                            Férias
                          </Badge>
                        )}
                        {motorista.status_motorista === 'desativo' && (
                          <Badge className="bg-red-100 text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                            Desativo
                          </Badge>
                        )}
                        {motorista.status_motorista === 'pendente_documentos' && (
                          <Badge className="bg-orange-100 text-orange-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
                            Pendente Docs
                          </Badge>
                        )}
                        {!motorista.status_motorista && motorista.approved && (
                          <Badge className="bg-gray-100 text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                            Sem Status
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{motorista.phone}</span>
                    </div>
                    {motorista.carta_conducao_numero && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Carta:</span>
                        <span className="font-medium">{motorista.carta_conducao_numero}</span>
                      </div>
                    )}
                    {motorista.licenca_tvde_numero && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">TVDE:</span>
                        <span className="font-medium">{motorista.licenca_tvde_numero}</span>
                      </div>
                    )}
                    {motorista.regime && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Regime:</span>
                        <Badge variant="outline" className="capitalize">{motorista.regime}</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 pt-3 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedMotorista(motorista);
                        setShowDetailDialog(true);
                      }}
                    >
                      Ver Detalhes
                    </Button>
                    {!motorista.approved && (user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') && (
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleApprove(motorista.id)}
                        data-testid={`approve-motorista-${motorista.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                    )}
                    {motorista.approved && (user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') && (
                      <>
                        {(motorista.status === 'inativo' || motorista.status_motorista === 'desativo') ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() => handleAtivarMotorista(motorista.id, motorista.name)}
                            title="Ativar motorista"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50"
                            onClick={() => handleDesativarMotorista(motorista.id, motorista.name)}
                            title="Desativar motorista"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Assign Partner Button - Only for Admin and Gestor */}
                  {motorista.approved && (user.role === 'admin' || user.role === 'gestao') && (
                    <div className="pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-blue-200 hover:bg-blue-50 text-blue-700"
                        onClick={() => handleOpenAtribuirModal(motorista)}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Atribuir Parceiro
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              ))}
            </div>
          </>
        )}

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog && selectedMotorista !== null} onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) {
            setIsEditing(false);
            setEditForm({});
            setSelectedMotorista(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex justify-between items-center pr-8">
                <DialogTitle>Detalhes do Motorista</DialogTitle>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <Button onClick={handleEditMotorista} size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      {(user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') && selectedMotorista && (
                        <>
                          {(selectedMotorista.status === 'inativo' || selectedMotorista.status_motorista === 'desativo') ? (
                            <Button 
                              onClick={() => handleAtivarMotorista(selectedMotorista.id, selectedMotorista.name)} 
                              variant="outline"
                              size="sm"
                              className="border-green-600 text-green-600 hover:bg-green-50"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Ativar
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => handleDesativarMotorista(selectedMotorista.id, selectedMotorista.name)} 
                              variant="outline"
                              size="sm"
                              className="border-orange-600 text-orange-600 hover:bg-orange-50"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Desativar
                            </Button>
                          )}
                        </>
                      )}
                      {user.role === 'admin' && (
                        <Button onClick={handleDeleteMotorista} variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button onClick={handleCancelEdit} variant="outline" size="sm">
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveMotorista} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </DialogHeader>
            {selectedMotorista && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl font-bold">
                      {getInitials(isEditing ? editForm.name : selectedMotorista.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          placeholder="Nome"
                          className="text-xl font-bold"
                        />
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          placeholder="Email"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold">{selectedMotorista.name}</h3>
                        <p className="text-slate-600">{selectedMotorista.email}</p>
                      </>
                    )}
                  </div>
                  {/* Status Badge */}
                  <div>
                    <Badge 
                      variant={
                        selectedMotorista.status_motorista === 'ativo' ? 'default' :
                        selectedMotorista.status_motorista === 'aguarda_carro' ? 'secondary' :
                        selectedMotorista.status_motorista === 'ferias' ? 'outline' :
                        'destructive'
                      }
                      className="text-sm"
                    >
                      {selectedMotorista.status_motorista?.replace('_', ' ').toUpperCase() || 'PENDENTE DOCUMENTOS'}
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="pessoal" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                    <TabsTrigger value="docs">Documentação</TabsTrigger>
                    <TabsTrigger value="emergencia">Emergência</TabsTrigger>
                    <TabsTrigger value="uploads">Uploads</TabsTrigger>
                    <TabsTrigger value="atribuicoes">Atribuições</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pessoal" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Telefone</Label>
                        {isEditing ? (
                          <Input value={editForm.phone || ''} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.phone}</p>
                        )}
                      </div>
                      <div>
                        <Label>WhatsApp</Label>
                        {isEditing ? (
                          <Input value={editForm.whatsapp || ''} onChange={(e) => setEditForm({...editForm, whatsapp: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.whatsapp || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Data Nascimento</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.data_nascimento || ''} onChange={(e) => setEditForm({...editForm, data_nascimento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.data_nascimento ? new Date(selectedMotorista.data_nascimento).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nacionalidade</Label>
                        {isEditing ? (
                          <Input value={editForm.nacionalidade || ''} onChange={(e) => setEditForm({...editForm, nacionalidade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.nacionalidade || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Morada Completa</Label>
                      {isEditing ? (
                        <Input value={editForm.morada_completa || ''} onChange={(e) => setEditForm({...editForm, morada_completa: e.target.value})} />
                      ) : (
                        <p className="font-medium">{selectedMotorista.morada_completa || 'N/A'}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Código Postal</Label>
                        {isEditing ? (
                          <Input value={editForm.codigo_postal || ''} onChange={(e) => setEditForm({...editForm, codigo_postal: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.codigo_postal || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Localidade</Label>
                        {isEditing ? (
                          <Input value={editForm.localidade || ''} onChange={(e) => setEditForm({...editForm, localidade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.localidade || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo Documento</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.tipo_documento || ''} onChange={(e) => setEditForm({...editForm, tipo_documento: e.target.value})}>
                            <option value="">Selecione</option>
                            <option value="CC">Cartão de Cidadão</option>
                            <option value="passaporte">Passaporte</option>
                            <option value="outro">Outro</option>
                          </select>
                        ) : (
                          <p className="font-medium">{selectedMotorista.tipo_documento || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Documento</Label>
                        {isEditing ? (
                          <Input value={editForm.numero_documento || ''} onChange={(e) => setEditForm({...editForm, numero_documento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.numero_documento || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade Documento</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.validade_documento || ''} onChange={(e) => setEditForm({...editForm, validade_documento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.validade_documento ? new Date(selectedMotorista.validade_documento).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>NIF</Label>
                        {isEditing ? (
                          <Input value={editForm.nif || ''} onChange={(e) => setEditForm({...editForm, nif: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.nif || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Segurança Social</Label>
                        {isEditing ? (
                          <Input value={editForm.numero_seguranca_social || ''} onChange={(e) => setEditForm({...editForm, numero_seguranca_social: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.numero_seguranca_social || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Cartão de Utente</Label>
                        {isEditing ? (
                          <Input value={editForm.numero_cartao_utente || ''} onChange={(e) => setEditForm({...editForm, numero_cartao_utente: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.numero_cartao_utente || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Carta Condução</Label>
                        {isEditing ? (
                          <Input value={editForm.carta_conducao_numero || ''} onChange={(e) => setEditForm({...editForm, carta_conducao_numero: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.carta_conducao_numero || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Emissão Carta Condução</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.carta_conducao_emissao || ''} onChange={(e) => setEditForm({...editForm, carta_conducao_emissao: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.carta_conducao_emissao ? new Date(selectedMotorista.carta_conducao_emissao).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade Carta</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.carta_conducao_validade || ''} onChange={(e) => setEditForm({...editForm, carta_conducao_validade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.carta_conducao_validade ? new Date(selectedMotorista.carta_conducao_validade).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Licença TVDE</Label>
                        {isEditing ? (
                          <Input value={editForm.licenca_tvde_numero || ''} onChange={(e) => setEditForm({...editForm, licenca_tvde_numero: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.licenca_tvde_numero || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade TVDE</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.licenca_tvde_validade || ''} onChange={(e) => setEditForm({...editForm, licenca_tvde_validade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.licenca_tvde_validade ? new Date(selectedMotorista.licenca_tvde_validade).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Label>Código Registo Criminal (xxxx-xxxx-xxxx)</Label>
                        {isEditing ? (
                          <Input 
                            value={editForm.codigo_registo_criminal || ''} 
                            onChange={(e) => setEditForm({...editForm, codigo_registo_criminal: e.target.value})}
                            placeholder="xxxx-xxxx-xxxx"
                          />
                        ) : (
                          <p className="font-medium">{selectedMotorista.codigo_registo_criminal || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="emergencia" className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-red-800 mb-2">Contacto de Emergência</h4>
                      <p className="text-sm text-red-600">Informações para contacto em caso de emergência</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome Completo</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_nome || ''} onChange={(e) => setEditForm({...editForm, emergencia_nome: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_nome || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Parentesco</Label>
                        {isEditing ? (
                          <select 
                            className="w-full p-2 border rounded-md" 
                            value={editForm.emergencia_parentesco || ''} 
                            onChange={(e) => setEditForm({...editForm, emergencia_parentesco: e.target.value})}
                          >
                            <option value="">Selecione</option>
                            <option value="pai">Pai</option>
                            <option value="mae">Mãe</option>
                            <option value="conjuge">Cônjuge</option>
                            <option value="irmao">Irmão/Irmã</option>
                            <option value="filho">Filho/Filha</option>
                            <option value="amigo">Amigo/Amiga</option>
                            <option value="outro">Outro</option>
                          </select>
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_parentesco || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_telefone || ''} onChange={(e) => setEditForm({...editForm, emergencia_telefone: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_telefone || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Email (opcional)</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_email || ''} onChange={(e) => setEditForm({...editForm, emergencia_email: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_email || 'N/A'}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Label>Morada</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_morada || ''} onChange={(e) => setEditForm({...editForm, emergencia_morada: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_morada || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Código Postal</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_codigo_postal || ''} onChange={(e) => setEditForm({...editForm, emergencia_codigo_postal: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_codigo_postal || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Localidade</Label>
                        {isEditing ? (
                          <Input value={editForm.emergencia_localidade || ''} onChange={(e) => setEditForm({...editForm, emergencia_localidade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.emergencia_localidade || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab de Uploads de Documentos */}
                  <TabsContent value="uploads" className="space-y-4">
                    <div className="space-y-4">
                      {/* Comprovativo de Morada */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">Comprovativo de Morada</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista?.documents?.comprovativo_morada_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.comprovativo_morada_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => e.target.files[0] && handleUploadDocument('comprovativo_morada', e.target.files[0])}
                            disabled={uploadingDoc}
                            className="mt-2"
                          />
                        )}
                      </div>

                      {/* CC Frente e Verso */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">CC Frente e Verso</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista.documents?.cc_frente_verso_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.cc_frente_verso_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download PDF
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-2 space-y-3">
                            {/* Opção 1: Upload PDF completo */}
                            <div className="border-b pb-3">
                              <Label className="text-sm font-medium mb-2 block">Opção 1: PDF Completo</Label>
                              <Input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => e.target.files[0] && handleUploadDocument('cc_frente_verso', e.target.files[0])}
                                disabled={uploadingDoc}
                              />
                              <p className="text-xs text-slate-500 mt-1">Envie um PDF com frente e verso</p>
                            </div>
                            
                            {/* Opção 2: Upload 2 fotos (frente/verso) */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Opção 2: Fotos Frente e Verso</Label>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs">Frente:</Label>
                                  <Input
                                    type="file"
                                    accept=".jpg,.jpeg,.png"
                                    id="cc_frente"
                                    disabled={uploadingDoc}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Verso:</Label>
                                  <Input
                                    type="file"
                                    accept=".jpg,.jpeg,.png"
                                    id="cc_verso"
                                    disabled={uploadingDoc}
                                  />
                                </div>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    const frente = document.getElementById('cc_frente').files[0];
                                    const verso = document.getElementById('cc_verso').files[0];
                                    if (frente && verso) handleUploadDocument('cc_frente_verso', frente, verso);
                                    else toast.error('Selecione frente e verso');
                                  }}
                                  disabled={uploadingDoc}
                                >
                                  Enviar CC (Fotos)
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Carta Frente e Verso */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">Carta de Condução Frente e Verso</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista.documents?.carta_frente_verso_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.carta_frente_verso_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download PDF
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-2 space-y-3">
                            {/* Opção 1: Upload PDF completo */}
                            <div className="border-b pb-3">
                              <Label className="text-sm font-medium mb-2 block">Opção 1: PDF Completo</Label>
                              <Input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => e.target.files[0] && handleUploadDocument('carta_frente_verso', e.target.files[0])}
                                disabled={uploadingDoc}
                              />
                              <p className="text-xs text-slate-500 mt-1">Envie um PDF com frente e verso</p>
                            </div>
                            
                            {/* Opção 2: Upload 2 fotos (frente/verso) */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Opção 2: Fotos Frente e Verso</Label>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs">Frente:</Label>
                                  <Input type="file" accept=".jpg,.jpeg,.png" id="carta_frente" disabled={uploadingDoc} />
                                </div>
                                <div>
                                  <Label className="text-xs">Verso:</Label>
                                  <Input type="file" accept=".jpg,.jpeg,.png" id="carta_verso" disabled={uploadingDoc} />
                                </div>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    const frente = document.getElementById('carta_frente').files[0];
                                    const verso = document.getElementById('carta_verso').files[0];
                                    if (frente && verso) handleUploadDocument('carta_frente_verso', frente, verso);
                                    else toast.error('Selecione frente e verso');
                                  }}
                                  disabled={uploadingDoc}
                                >
                                  Enviar Carta (Fotos)
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Licença TVDE */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">Licença TVDE</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista.documents?.licenca_tvde_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.licenca_tvde_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => e.target.files[0] && handleUploadDocument('licenca_tvde', e.target.files[0])}
                            disabled={uploadingDoc}
                            className="mt-2"
                          />
                        )}
                      </div>

                      {/* Registo Criminal */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">Registo Criminal</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista.documents?.registo_criminal_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.registo_criminal_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => e.target.files[0] && handleUploadDocument('registo_criminal', e.target.files[0])}
                            disabled={uploadingDoc}
                            className="mt-2"
                          />
                        )}
                      </div>

                      {/* Comprovativo IBAN */}
                      <div className="border rounded-lg p-4">
                        <Label className="font-semibold">Comprovativo de IBAN</Label>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedMotorista.documents?.iban_comprovativo_pdf ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedMotorista.documents.iban_comprovativo_pdf)}>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <span className="text-xs text-green-600">✓ Documento enviado</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Nenhum documento</span>
                          )}
                        </div>
                        {isEditing && (
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => e.target.files[0] && handleUploadDocument('iban_comprovativo', e.target.files[0])}
                            disabled={uploadingDoc}
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab de Atribuições */}
                  <TabsContent value="atribuicoes" className="space-y-4">
                    <div className="space-y-4">
                      {/* Status do Motorista */}
                      <div>
                        <Label>Status do Motorista</Label>
                        {isEditing ? (
                          <select 
                            className="w-full p-2 border rounded-md" 
                            value={editForm.status_motorista || 'pendente_documentos'} 
                            onChange={(e) => setEditForm({...editForm, status_motorista: e.target.value})}
                          >
                            <option value="pendente_documentos">Pendente de Documentos</option>
                            <option value="aguarda_carro">Aguarda Carro</option>
                            <option value="ativo">Ativo</option>
                            <option value="ferias">Férias</option>
                            <option value="desativo">Desativo</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{selectedMotorista.status_motorista?.replace('_', ' ') || 'Pendente de Documentos'}</p>
                        )}
                      </div>

                      {/* Atribuição de Parceiro (Admin e Gestor) */}
                      {(user.role === 'admin' || user.role === 'gestao') && (
                        <div>
                          <Label>Parceiro Atribuído</Label>
                          {isEditing ? (
                            <select 
                              className="w-full p-2 border rounded-md" 
                              value={editForm.parceiro_atribuido || ''} 
                              onChange={(e) => {
                                setEditForm({...editForm, parceiro_atribuido: e.target.value, veiculo_atribuido: ''});
                                if (e.target.value) fetchVeiculosByParceiro(e.target.value);
                                else setVeiculos([]);
                              }}
                            >
                              <option value="">Nenhum</option>
                              {parceiros.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">
                              {selectedMotorista.parceiro_atribuido 
                                ? parceiros.find(p => p.id === selectedMotorista.parceiro_atribuido)?.nome || 'N/A'
                                : 'Nenhum'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Atribuição de Veículo */}
                      {(user.role === 'admin' || user.role === 'gestao') && (
                        <div>
                          <Label>Veículo Atribuído</Label>
                          {isEditing ? (
                            <select 
                              className="w-full p-2 border rounded-md" 
                              value={editForm.veiculo_atribuido || ''} 
                              onChange={(e) => setEditForm({...editForm, veiculo_atribuido: e.target.value})}
                              disabled={!editForm.parceiro_atribuido}
                            >
                              <option value="">Nenhum</option>
                              {veiculos.map(v => (
                                <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">
                              {selectedMotorista.veiculo_atribuido 
                                ? veiculos.find(v => v.id === selectedMotorista.veiculo_atribuido)?.matricula || 'N/A'
                                : 'Nenhum'}
                            </p>
                          )}
                          {isEditing && !editForm.parceiro_atribuido && (
                            <p className="text-xs text-slate-500 mt-1">Selecione um parceiro primeiro</p>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>IBAN</Label>
                        {isEditing ? (
                          <Input value={editForm.iban || ''} onChange={(e) => setEditForm({...editForm, iban: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.iban || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Regime</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.regime || ''} onChange={(e) => setEditForm({...editForm, regime: e.target.value})}>
                            <option value="aluguer">Aluguer</option>
                            <option value="comissao">Comissão</option>
                            <option value="carro_proprio">Carro Próprio</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{selectedMotorista.regime || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Tipo Pagamento</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.tipo_pagamento || ''} onChange={(e) => setEditForm({...editForm, tipo_pagamento: e.target.value})}>
                            <option value="fatura">Fatura</option>
                            <option value="recibo_verde">Recibo Verde</option>
                            <option value="sem_recibo">Sem Recibo</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{selectedMotorista.tipo_pagamento ? selectedMotorista.tipo_pagamento.replace('_', ' ') : 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <Label className="mb-3 block">Plataformas</Label>
                      <div className="space-y-4">
                        {/* Uber */}
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-sm font-semibold mb-2">🚗 Uber</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Email Uber</Label>
                              {isEditing ? (
                                <Input 
                                  value={editForm.email_uber || ''} 
                                  onChange={(e) => setEditForm({...editForm, email_uber: e.target.value})} 
                                  placeholder={selectedMotorista.email}
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.email_uber || selectedMotorista.email}</p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Telefone Uber</Label>
                              {isEditing ? (
                                <Input 
                                  value={editForm.telefone_uber || ''} 
                                  onChange={(e) => setEditForm({...editForm, telefone_uber: e.target.value})}
                                  placeholder={selectedMotorista.phone}
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.telefone_uber || selectedMotorista.phone}</p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">UUID do Motorista na Uber</Label>
                              <p className="text-xs text-slate-500 mb-1">Identificador único para rastrear ganhos na Uber</p>
                              {isEditing ? (
                                <Input 
                                  value={editForm.uuid_motorista_uber || ''} 
                                  onChange={(e) => setEditForm({...editForm, uuid_motorista_uber: e.target.value})}
                                  placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.uuid_motorista_uber || 'Não definido'}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bolt */}
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-sm font-semibold mb-2">⚡ Bolt</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Email Bolt</Label>
                              {isEditing ? (
                                <Input 
                                  value={editForm.email_bolt || ''} 
                                  onChange={(e) => setEditForm({...editForm, email_bolt: e.target.value})}
                                  placeholder={selectedMotorista.email}
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.email_bolt || selectedMotorista.email}</p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">Telefone Bolt</Label>
                              {isEditing ? (
                                <Input 
                                  value={editForm.telefone_bolt || ''} 
                                  onChange={(e) => setEditForm({...editForm, telefone_bolt: e.target.value})}
                                  placeholder={selectedMotorista.phone}
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.telefone_bolt || selectedMotorista.phone}</p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Identificador do Motorista na Bolt</Label>
                              <p className="text-xs text-slate-500 mb-1">Identificador individual para rastrear ganhos na Bolt</p>
                              {isEditing ? (
                                <Input 
                                  value={editForm.identificador_motorista_bolt || ''} 
                                  onChange={(e) => setEditForm({...editForm, identificador_motorista_bolt: e.target.value})}
                                  placeholder="Ex: BOLT123456"
                                />
                              ) : (
                                <p className="font-medium text-sm">{selectedMotorista.identificador_motorista_bolt || 'Não definido'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Planos removidos temporariamente para período experimental */}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Assignment Dialog */}
        <Dialog open={showAtribuirDialog} onOpenChange={setShowAtribuirDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Atribuir Motorista a Parceiro</DialogTitle>
            </DialogHeader>
            
            {selectedMotorista && (
              <div className="space-y-4">
                {/* Motorista Info */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">{selectedMotorista.name}</p>
                  <p className="text-xs text-blue-700">{selectedMotorista.email}</p>
                </div>

                {/* Tipo Motorista */}
                <div className="space-y-2">
                  <Label>Tipo de Motorista</Label>
                  <Select 
                    value={atribuicaoData.tipo_motorista} 
                    onValueChange={(value) => setAtribuicaoData({...atribuicaoData, tipo_motorista: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="independente">Independente</SelectItem>
                      <SelectItem value="tempo_integral">Tempo Integral</SelectItem>
                      <SelectItem value="meio_periodo">Meio Período</SelectItem>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Parceiro Selection */}
                <div className="space-y-2">
                  <Label>Parceiro (Opcional)</Label>
                  <Select 
                    value={atribuicaoData.parceiro_id || 'none'} 
                    onValueChange={(value) => {
                      const parceiroId = value === 'none' ? '' : value;
                      setAtribuicaoData(prev => ({...prev, parceiro_id: parceiroId, veiculo_id: ''}));
                      
                      // Use setTimeout to avoid rapid re-renders
                      setTimeout(() => {
                        if (parceiroId) {
                          fetchVeiculosByParceiro(parceiroId);
                        } else {
                          setVeiculos([]);
                        }
                      }, 0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {parceiros.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_empresa || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vehicle Selection - Only if partner selected */}
                {atribuicaoData.parceiro_id && (
                  <div className="space-y-2">
                    <Label>Veículo (Opcional)</Label>
                    <Select 
                      value={atribuicaoData.veiculo_id || 'none'} 
                      onValueChange={(value) => {
                        const veiculoId = value === 'none' ? '' : value;
                        setAtribuicaoData(prev => ({...prev, veiculo_id: veiculoId}));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {veiculos.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.marca} {v.modelo} - {v.matricula}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {veiculos.length === 0 && atribuicaoData.parceiro_id && (
                      <p className="text-xs text-amber-600">Nenhum veículo disponível para este parceiro</p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setShowAtribuirDialog(false);
                      setAtribuicaoData({
                        motorista_id: '',
                        parceiro_id: '',
                        veiculo_id: '',
                        tipo_motorista: 'independente'
                      });
                      setVeiculos([]);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleAtribuirParceiro}
                  >
                    Atribuir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Planos removido temporariamente para período experimental */}


        {/* Contract Creation Confirmation Dialog */}
        <Dialog open={showContractConfirmDialog} onOpenChange={setShowContractConfirmDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span>Criar Contrato?</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700 mb-4">
                O motorista <strong>{assignedDriverData?.motorista?.name}</strong> foi atribuído com sucesso ao veículo <strong>{assignedDriverData?.veiculo?.matricula}</strong>.
              </p>
              <p className="text-slate-600">
                Deseja criar um contrato para este motorista agora?
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSkipContract}
              >
                Não, mais tarde
              </Button>
              <Button
                type="button"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleCreateContract}
              >
                Sim, criar contrato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {/* Import CSV Modal */}
      {showImportDialog && (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        onClick={() => setShowImportDialog(false)}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b p-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar Motoristas em Massa
              </h2>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Antes de importar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Descarregue o ficheiro de exemplo</li>
                    <li>Preencha com os dados dos seus motoristas</li>
                    <li>Não altere os cabeçalhos das colunas</li>
                    <li>Guarde como CSV (separado por vírgulas)</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleDownloadCSVExample}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Descarregar Exemplo CSV
              </Button>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleImportCSV(file);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                  id="csv-upload-motoristas"
                />
                <label
                  htmlFor="csv-upload-motoristas"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">
                    Clique para selecionar o ficheiro CSV
                  </span>
                  <span className="text-xs text-slate-500">
                    Apenas ficheiros .csv são aceites
                  </span>
                </label>
              </div>

              {importLoading && (
                <div className="flex items-center justify-center gap-2 p-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-slate-600">A importar...</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
                className="flex-1"
                disabled={importLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

    </Layout>
  );
};

export default Motoristas;