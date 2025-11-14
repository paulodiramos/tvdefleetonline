import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Building, Mail, Phone, Car, Edit, FileText, Users, CheckCircle, Clock, Download, Eye, Award, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Parceiros = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [motoristas, setMotoristas] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileParceiro, setProfileParceiro] = useState(null);
  const [profileMotoristas, setProfileMotoristas] = useState([]);
  const [profileVeiculos, setProfileVeiculos] = useState([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState(null);
  const [showPlanosDialog, setShowPlanosDialog] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [selectedParceiroForPlano, setSelectedParceiroForPlano] = useState(null);
  const [showMinutasDialog, setShowMinutasDialog] = useState(false);
  const [minutas, setMinutas] = useState([]);
  const [selectedMinuta, setSelectedMinuta] = useState(null);
  const [showEditMinutaDialog, setShowEditMinutaDialog] = useState(false);
  const [editingMinuta, setEditingMinuta] = useState(null);
  const [newParceiro, setNewParceiro] = useState({
    name: '',
    email: '',
    phone: '',
    empresa: '',
    nif: '',
    morada: ''
  });
  const [contractForm, setContractForm] = useState({
    tipo_contrato: 'aluguer',
    texto_contrato: ''
  });
  const [horarioTemp, setHorarioTemp] = useState({ inicio: '', fim: '' });

  useEffect(() => {
    fetchParceiros();
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
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParceiro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/parceiros`, newParceiro, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Parceiro adicionado com sucesso! Password padrão: parceiro123');
      setShowAddDialog(false);
      fetchParceiros();
      setNewParceiro({
        name: '',
        email: '',
        phone: '',
        empresa: '',
        nif: '',
        morada: ''
      });
    } catch (error) {
      console.error('Error adding parceiro:', error);
      toast.error('Erro ao adicionar parceiro');
    }
  };

  const handleSelectParceiro = async (parceiro) => {
    setSelectedParceiro(parceiro);
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch motoristas do parceiro
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_atribuido === parceiro.id);
      setMotoristas(parceiroMotoristas);

      // Fetch vehicles do parceiro
      const vehiclesRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroVehicles = vehiclesRes.data.filter(v => v.parceiro_id === parceiro.id);
      setVehicles(parceiroVehicles);

      // Fetch contratos do parceiro
      const contratosRes = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroContratos = contratosRes.data.filter(c => c.parceiro_id === parceiro.id);
      setContratos(parceiroContratos);
      
    } catch (error) {
      console.error('Error fetching parceiro data:', error);
      toast.error('Erro ao carregar dados do parceiro');
    }
  };

  const handleViewProfile = async (parceiro) => {
    try {
      setProfileParceiro(parceiro);
      setShowProfileDialog(true);
      
      const token = localStorage.getItem('token');
      
      // Fetch motoristas and vehicles for this parceiro
      const [motoristasRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/vehicles`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Filter by parceiro_id
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_id === parceiro.id);
      const parceiroVeiculos = vehiclesRes.data.filter(v => v.parceiro_id === parceiro.id);
      
      setProfileMotoristas(parceiroMotoristas);
      setProfileVeiculos(parceiroVeiculos);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar perfil do parceiro');
    }
  };

  const handleEditParceiro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/parceiros/${editingParceiro.id}`, editingParceiro, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Parceiro atualizado com sucesso!');
      setShowEditDialog(false);
      setEditingParceiro(null);
      fetchParceiros();
    } catch (error) {
      console.error('Error updating parceiro:', error);
      toast.error('Erro ao atualizar parceiro');
    }
  };

  const fetchPlanos = async () => {
    try {
      const response = await axios.get(`${API}/planos/public?tipo_usuario=parceiro`);
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching planos:', error);
      toast.error('Erro ao carregar planos');
    }
  };

  const handleSolicitarPlano = async (parceiroId, planoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/parceiros/${parceiroId}/solicitar-plano`,
        { plano_id: planoId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Plano solicitado! Aguardando aprovação do admin.');
      setShowPlanosDialog(false);
      fetchParceiros();
    } catch (error) {
      console.error('Error requesting plan:', error);
      toast.error('Erro ao solicitar plano');
    }
  };

  const handleAprovarPlano = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/admin/parceiros/${parceiroId}/aprovar-plano`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Plano aprovado com sucesso!');
      fetchParceiros();
      if (profileParceiro && profileParceiro.id === parceiroId) {
        setProfileParceiro({...profileParceiro, plano_status: 'ativo'});
      }
    } catch (error) {
      console.error('Error approving plan:', error);
      toast.error('Erro ao aprovar plano');
    }
  };

  const fetchMinutas = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${parceiroId}/minutas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMinutas(response.data);
    } catch (error) {
      console.error('Error fetching minutas:', error);
      toast.error('Erro ao carregar minutas');
    }
  };

  const handleCreateMinuta = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/parceiros/${profileParceiro.id}/minutas`,
        editingMinuta,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Minuta criada com sucesso!');
      setShowEditMinutaDialog(false);
      setEditingMinuta(null);
      fetchMinutas(profileParceiro.id);
    } catch (error) {
      console.error('Error creating minuta:', error);
      toast.error('Erro ao criar minuta');
    }
  };

  const handleUpdateMinuta = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/minutas/${editingMinuta.id}`,
        editingMinuta,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Minuta atualizada com sucesso!');
      setShowEditMinutaDialog(false);
      setEditingMinuta(null);
      fetchMinutas(profileParceiro.id);
    } catch (error) {
      console.error('Error updating minuta:', error);
      toast.error('Erro ao atualizar minuta');
    }
  };

  const handleDeleteMinuta = async (minutaId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta minuta?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/minutas/${minutaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Minuta excluída com sucesso!');
      fetchMinutas(profileParceiro.id);
    } catch (error) {
      console.error('Error deleting minuta:', error);
      toast.error('Erro ao excluir minuta');
    }
  };


  const handleCreateContract = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        parceiro_id: selectedParceiro.id,
        motorista_id: contractForm.motorista_id,
        vehicle_id: contractForm.tipo_contrato === 'carro_proprio' ? null : contractForm.vehicle_id,
        tipo_contrato: contractForm.tipo_contrato,
        valor_semanal: contractForm.valor_semanal ? parseFloat(contractForm.valor_semanal) : null,
        valor_slot: contractForm.valor_slot ? parseFloat(contractForm.valor_slot) : null,
        percentagem_comissao: contractForm.percentagem_comissao ? parseFloat(contractForm.percentagem_comissao) : null,
        horarios_disponibilidade: contractForm.horarios
      };
      
      await axios.post(`${API}/contratos/gerar`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Contrato gerado com sucesso!');
      setShowContractDialog(false);
      setContractForm({ 
        motorista_id: '', 
        vehicle_id: '', 
        tipo_contrato: 'aluguer',
        valor_semanal: '',
        valor_slot: '',
        percentagem_comissao: '',
        horarios: []
      });
      
      // Refresh contratos
      handleSelectParceiro(selectedParceiro);
    } catch (error) {
      console.error('Error creating contract:', error);
      toast.error('Erro ao gerar contrato');
    }
  };

  const handleAddHorario = () => {
    if (horarioTemp.inicio && horarioTemp.fim) {
      const horarioStr = `${horarioTemp.inicio}-${horarioTemp.fim}`;
      setContractForm({
        ...contractForm,
        horarios: [...contractForm.horarios, horarioStr]
      });
      setHorarioTemp({ inicio: '', fim: '' });
    }
  };

  const handleRemoveHorario = (index) => {
    const newHorarios = contractForm.horarios.filter((_, i) => i !== index);
    setContractForm({ ...contractForm, horarios: newHorarios });
  };

  const handleDownloadContract = async (contratoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contratos/${contratoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contratoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract', error);
      toast.error('Erro ao baixar contrato');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendente' },
      'parceiro_assinado': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Parceiro Assinou' },
      'motorista_assinado': { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Motorista Assinou' },
      'completo': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completo' }
    };

    const config = statusConfig[status] || statusConfig['pendente'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  // Vista Detalhada do Parceiro
  if (selectedParceiro) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="outline" onClick={() => setSelectedParceiro(null)} className="mb-2">
                ← Voltar aos Parceiros
              </Button>
              <h1 className="text-3xl font-bold">{selectedParceiro.nome_empresa || selectedParceiro.name || selectedParceiro.email}</h1>
              <p className="text-slate-600">Gerir contratos e motoristas</p>
            </div>
            <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Contrato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Contrato</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateContract} className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                    <select
                      id="tipo_contrato"
                      value={contractForm.tipo_contrato}
                      onChange={(e) => setContractForm({...contractForm, tipo_contrato: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="aluguer_sem_caucao">Aluguer Sem Caução</option>
                      <option value="aluguer_epocas_sem_caucao">Aluguer com Épocas Sem Caução</option>
                      <option value="aluguer_com_caucao">Aluguer Com Caução (com opção parcelamento)</option>
                      <option value="aluguer_caucao_epocas">Aluguer Com Caução e Épocas (com opção parcelamento)</option>
                      <option value="compra_veiculo">Compra de Veículo</option>
                      <option value="carro_proprio">Carro Próprio (Slot)</option>
                      <option value="comissao_part_time">Comissão Part-Time</option>
                      <option value="comissao_full_time">Comissão Full-Time</option>
                      <option value="motorista_privado">Motorista Privado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="texto_contrato">Texto do Contrato *</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      <strong>Variáveis Disponíveis:</strong>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2 p-3 bg-slate-50 rounded max-h-32 overflow-y-auto">
                      <div><code>{'{'}PARCEIRO_NOME{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_NIF{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_MORADA{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_CP{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_LOCALIDADE{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_EMAIL{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_NOME{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_CC{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_CC_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_EMAIL{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_NOME{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CC{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CC_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_NIF{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_MORADA{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CP{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LOCALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LICENCA_TVDE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LICENCA_TVDE_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_SS{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_EMAIL{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MARCA{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MODELO{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MATRICULA{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO{'}'}</code></div>
                      <div><code>{'{'}DATA_EMISSAO{'}'}</code></div>
                      <div><code>{'{'}TIPO_CONTRATO{'}'}</code></div>
                      <div><code>{'{'}VALOR_SEMANAL{'}'}</code></div>
                      <div><code>{'{'}COMISSAO{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_TOTAL{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_PARCELAS{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_TEXTO{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}DATA_FIM_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}EPOCA_ALTA_VALOR{'}'}</code></div>
                      <div><code>{'{'}TEXTO_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}DATA_FIM_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}EPOCA_BAIXA_VALOR{'}'}</code></div>
                      <div><code>{'{'}TEXTO_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}CONDICOES_VEICULO{'}'}</code></div>
                    </div>
                    <textarea
                      id="texto_contrato"
                      value={contractForm.texto_contrato || ''}
                      onChange={(e) => setContractForm({...contractForm, texto_contrato: e.target.value})}
                      className="w-full p-3 border rounded-md min-h-[200px] text-sm font-mono"
                      placeholder="Cole ou escreva o texto do contrato aqui. Use as variáveis acima para preenchimento automático."
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Gerar Contrato
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Motoristas</p>
                    <p className="text-2xl font-bold text-emerald-600">{motoristas.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Veículos</p>
                    <p className="text-2xl font-bold text-blue-600">{vehicles.length}</p>
                  </div>
                  <Car className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Contratos</p>
                    <p className="text-2xl font-bold text-purple-600">{contratos.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Contratos */}
          <Card>
            <CardHeader>
              <CardTitle>Contratos</CardTitle>
            </CardHeader>
            <CardContent>
              {contratos.length > 0 ? (
                <div className="space-y-4">
                  {contratos.map((contrato) => (
                    <div key={contrato.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{contrato.motorista_nome}</p>
                          <p className="text-sm text-slate-600">{contrato.vehicle_matricula}</p>
                        </div>
                        {getStatusBadge(contrato.status)}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadContract(contrato.id)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        
                        <p className="text-xs text-slate-500">
                          Criado em: {new Date(contrato.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">Nenhum contrato criado ainda</p>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Lista de Parceiros
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="parceiros-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Parceiros</h1>
            <p className="text-slate-600">Gerir parceiros e contratos</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestor_associado') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-parceiro-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parceiro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="add-parceiro-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Parceiro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddParceiro} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={newParceiro.name} onChange={(e) => setNewParceiro({...newParceiro, name: e.target.value})} required data-testid="parceiro-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input id="empresa" value={newParceiro.empresa} onChange={(e) => setNewParceiro({...newParceiro, empresa: e.target.value})} data-testid="parceiro-empresa-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={newParceiro.email} onChange={(e) => setNewParceiro({...newParceiro, email: e.target.value})} required data-testid="parceiro-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={newParceiro.phone} onChange={(e) => setNewParceiro({...newParceiro, phone: e.target.value})} required data-testid="parceiro-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">NIF</Label>
                      <Input id="nif" value={newParceiro.nif} onChange={(e) => setNewParceiro({...newParceiro, nif: e.target.value})} data-testid="parceiro-nif-input" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="morada">Morada</Label>
                      <Input id="morada" value={newParceiro.morada} onChange={(e) => setNewParceiro({...newParceiro, morada: e.target.value})} data-testid="parceiro-morada-input" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-parceiro-button">
                    Adicionar Parceiro
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {parceiros.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum parceiro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parceiros.map((parceiro) => (
              <Card 
                key={parceiro.id} 
                className="card-hover cursor-pointer" 
                data-testid={`parceiro-card-${parceiro.id}`}
                onClick={() => handleSelectParceiro(parceiro)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{parceiro.nome_empresa || parceiro.name || parceiro.email}</CardTitle>
                      {parceiro.empresa && (
                        <p className="text-sm text-slate-500 mt-1">{parceiro.empresa}</p>
                      )}
                    </div>
                    <Building className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {/* Plano Badge */}
                    {parceiro.plano_id && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Award className={`w-4 h-4 ${
                          parceiro.plano_status === 'ativo' ? 'text-green-600' :
                          parceiro.plano_status === 'pendente' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`} />
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          parceiro.plano_status === 'ativo' ? 'bg-green-100 text-green-700' :
                          parceiro.plano_status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Plano {parceiro.plano_status === 'ativo' ? 'Ativo' :
                                 parceiro.plano_status === 'pendente' ? 'Pendente' :
                                 parceiro.plano_status}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{parceiro.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{parceiro.phone || parceiro.telefone || 'N/A'}</span>
                    </div>
                    {(parceiro.nif || parceiro.contribuinte_empresa) && (
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-600">NIF:</span>
                        <span className="font-medium">{parceiro.nif || parceiro.contribuinte_empresa}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Veículos:</span>
                        <div className="flex items-center space-x-1">
                          <Car className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-emerald-600">{parceiro.total_vehicles || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Motoristas:</span>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-blue-600">{parceiro.total_motoristas || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProfile(parceiro);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Perfil
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectParceiro(parceiro);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Contratos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Planos Dialog */}
      <Dialog open={showPlanosDialog} onOpenChange={setShowPlanosDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Award className="w-5 h-5" />
              <span>Escolher Plano de Assinatura</span>
            </DialogTitle>
          </DialogHeader>
          {selectedParceiroForPlano && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-slate-700">
                  <strong>Parceiro:</strong> {selectedParceiroForPlano.nome_empresa || selectedParceiroForPlano.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Escolha um plano abaixo. Após a solicitação, o admin precisará aprovar.
                </p>
              </div>

              <div className="grid gap-6">
                {planos.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum plano disponível no momento</p>
                ) : (
                  planos.map((plano) => (
                    <Card key={plano.id} className="hover:shadow-lg transition border-2 hover:border-blue-300">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <Award className="w-6 h-6 text-blue-600" />
                              <h3 className="text-xl font-bold text-slate-800">{plano.nome}</h3>
                            </div>
                            <p className="text-slate-600 mb-4">{plano.descricao}</p>
                            
                            <div className="mb-4">
                              <span className="text-3xl font-bold text-blue-600">
                                €{plano.preco_por_unidade.toFixed(2)}
                              </span>
                              <span className="text-slate-500 ml-2">/ veículo / mês</span>
                            </div>

                            <div className="space-y-2">
                              <p className="font-semibold text-sm text-slate-700">Funcionalidades incluídas:</p>
                              <ul className="space-y-1">
                                {plano.features.map((feature, index) => (
                                  <li key={index} className="flex items-center space-x-2 text-sm text-slate-600">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          <Button
                            className="ml-4 bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleSolicitarPlano(selectedParceiroForPlano.id, plano.id)}
                          >
                            Solicitar este Plano
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlanosDialog(false);
                    setSelectedParceiroForPlano(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Parceiro Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="w-5 h-5" />
              <span>Editar Perfil do Parceiro</span>
            </DialogTitle>
          </DialogHeader>
          {editingParceiro && (
            <form onSubmit={handleEditParceiro} className="space-y-6">
              {/* Dados da Empresa */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados da Empresa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_empresa">Nome da Empresa *</Label>
                    <Input
                      id="edit_nome_empresa"
                      value={editingParceiro.nome_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_empresa: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_nif">NIF *</Label>
                    <Input
                      id="edit_nif"
                      value={editingParceiro.contribuinte_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, contribuinte_empresa: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_empresa">Email da Empresa</Label>
                    <Input
                      id="edit_email_empresa"
                      type="email"
                      value={editingParceiro.email_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_empresa: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telefone">Telefone da Empresa</Label>
                    <Input
                      id="edit_telefone"
                      value={editingParceiro.telefone || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telefone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Gestor */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados do Gestor</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_manager">Nome do Gestor *</Label>
                    <Input
                      id="edit_nome_manager"
                      value={editingParceiro.nome_manager || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_manager: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_manager">Email do Gestor</Label>
                    <Input
                      id="edit_email_manager"
                      type="email"
                      value={editingParceiro.email_manager || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_manager: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telemovel">Telemóvel do Gestor</Label>
                    <Input
                      id="edit_telemovel"
                      value={editingParceiro.telemovel || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telemovel: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Gerente (Responsável Adicional) */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados do Gerente / Responsável</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_gerente">Nome do Gerente</Label>
                    <Input
                      id="edit_nome_gerente"
                      value={editingParceiro.nome_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_gerente: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_gerente">Email do Gerente</Label>
                    <Input
                      id="edit_email_gerente"
                      type="email"
                      value={editingParceiro.email_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_gerente: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telemovel_gerente">Telemóvel do Gerente</Label>
                    <Input
                      id="edit_telemovel_gerente"
                      value={editingParceiro.telemovel_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telemovel_gerente: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Email de Conta */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Email de Acesso ao Sistema</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="edit_email">Email de Conta (Login) *</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editingParceiro.email || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email: e.target.value})}
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Este é o email usado para login no sistema</p>
                  </div>
                </div>
              </div>

              {/* Morada */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Morada</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit_morada">Morada Completa</Label>
                    <Input
                      id="edit_morada"
                      value={editingParceiro.morada_completa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, morada_completa: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_codigo_postal">Código Postal</Label>
                    <Input
                      id="edit_codigo_postal"
                      value={editingParceiro.codigo_postal || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, codigo_postal: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_localidade">Localidade</Label>
                    <Input
                      id="edit_localidade"
                      value={editingParceiro.localidade || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, localidade: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Minuta de Contrato Padrão */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Minuta de Contrato Padrão</span>
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Esta minuta será usada automaticamente ao criar novos contratos para este parceiro.
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  <strong>Variáveis Disponíveis:</strong>
                </p>
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 mb-3 p-3 bg-slate-50 rounded max-h-32 overflow-y-auto">
                  <div><code>{'{'}PARCEIRO_NOME{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_NIF{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_MORADA{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_CP{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_TELEFONE{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_EMAIL{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_NOME{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_CC{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_NOME{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CC{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_NIF{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_MORADA{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_LICENCA_TVDE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_SS{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MARCA{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MODELO{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MATRICULA{'}'}</code></div>
                  <div><code>{'{'}DATA_INICIO{'}'}</code></div>
                  <div><code>{'{'}TIPO_CONTRATO{'}'}</code></div>
                  <div><code>{'{'}VALOR_SEMANAL{'}'}</code></div>
                  <div><code>{'{'}COMISSAO{'}'}</code></div>
                  <div><code>{'{'}CAUCAO_TOTAL{'}'}</code></div>
                  <div><code>{'{'}CAUCAO_PARCELAS{'}'}</code></div>
                  <div><code>{'{'}CONDICOES_VEICULO{'}'}</code></div>
                </div>
                <textarea
                  className="w-full p-3 border rounded-md min-h-[250px] text-sm font-mono"
                  placeholder="Cole ou escreva a minuta do contrato aqui. Esta será usada como padrão para todos os contratos deste parceiro. Use as variáveis acima para preenchimento automático."
                  value={editingParceiro.template_contrato_padrao || ''}
                  onChange={(e) => setEditingParceiro({...editingParceiro, template_contrato_padrao: e.target.value})}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingParceiro(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Guardar Alterações
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5" />
              <span>Perfil Completo do Parceiro</span>
            </DialogTitle>
          </DialogHeader>
          {profileParceiro && (
            <div className="space-y-6">
              {/* Plano Section */}
              {profileParceiro.plano_id && (
                <Card className="border-2 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <Award className="w-5 h-5 text-blue-600" />
                        <span>Plano de Assinatura</span>
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        profileParceiro.plano_status === 'ativo' ? 'bg-green-100 text-green-700' :
                        profileParceiro.plano_status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {profileParceiro.plano_status === 'ativo' ? 'Ativo' :
                         profileParceiro.plano_status === 'pendente' ? 'Pendente Aprovação' :
                         profileParceiro.plano_status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Plano ID</p>
                        <p className="font-medium font-mono">{profileParceiro.plano_id}</p>
                      </div>
                      {user.role === 'admin' && profileParceiro.plano_status === 'pendente' && (
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleAprovarPlano(profileParceiro.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aprovar Plano
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Parceiro Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informação do Parceiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-500">Nome da Empresa</label>
                      <p className="font-medium">{profileParceiro.nome_empresa || profileParceiro.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Nome do Gestor</label>
                      <p className="font-medium">{profileParceiro.nome_manager || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500 flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>Email</span>
                      </label>
                      <p className="font-medium">{profileParceiro.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500 flex items-center space-x-1">
                        <Phone className="w-3 h-3" />
                        <span>Telefone</span>
                      </label>
                      <p className="font-medium">{profileParceiro.telefone || profileParceiro.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">NIF</label>
                      <p className="font-medium">{profileParceiro.contribuinte_empresa || profileParceiro.nif || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Telemóvel</label>
                      <p className="font-medium">{profileParceiro.telemovel || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-slate-500">Morada Completa</label>
                      <p className="font-medium">{profileParceiro.morada_completa || profileParceiro.morada || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Código Postal</label>
                      <p className="font-medium">{profileParceiro.codigo_postal || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Localidade</label>
                      <p className="font-medium">{profileParceiro.localidade || 'N/A'}</p>
                    </div>
                    {profileParceiro.codigo_certidao_comercial && (
                      <div className="col-span-2">
                        <label className="text-sm text-slate-500">Código Certidão Comercial</label>
                        <p className="font-medium font-mono">{profileParceiro.codigo_certidao_comercial}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Motoristas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Motoristas Associados ({profileMotoristas.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profileMotoristas.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Nenhum motorista associado</p>
                  ) : (
                    <div className="space-y-3">
                      {profileMotoristas.map((motorista) => (
                        <div key={motorista.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{motorista.name}</p>
                              <p className="text-sm text-slate-500">{motorista.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">{motorista.phone || 'N/A'}</p>
                            <p className="text-xs text-slate-500">NIF: {motorista.nif || 'N/A'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Veículos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Car className="w-5 h-5" />
                    <span>Veículos Associados ({profileVeiculos.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profileVeiculos.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Nenhum veículo associado</p>
                  ) : (
                    <div className="space-y-3">
                      {profileVeiculos.map((veiculo) => (
                        <div key={veiculo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Car className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{veiculo.marca} {veiculo.modelo}</p>
                              <p className="text-sm text-slate-500">Matrícula: {veiculo.matricula}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">{veiculo.ano || 'N/A'}</p>
                            <p className="text-xs text-slate-500">
                              {veiculo.status === 'disponivel' ? '✓ Disponível' : 
                               veiculo.status === 'em_uso' ? '● Em Uso' : 
                               veiculo.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Button */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowProfileDialog(false)}
                >
                  Fechar
                </Button>
                {!profileParceiro.plano_id && (
                  <Button
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setSelectedParceiroForPlano(profileParceiro);
                      setShowProfileDialog(false);
                      fetchPlanos();
                      setShowPlanosDialog(true);
                    }}
                  >
                    <Award className="w-4 h-4 mr-2" />
                    Escolher Plano
                  </Button>
                )}
                {(user.role === 'admin' || user.role === 'gestao') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingParceiro({...profileParceiro});
                      setShowProfileDialog(false);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Perfil
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setShowProfileDialog(false);
                    handleSelectParceiro(profileParceiro);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Ver Contratos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Parceiros;
