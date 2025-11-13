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
import { Plus, Building, Mail, Phone, Car, Edit, FileText, Users, CheckCircle, Clock, Download, Eye } from 'lucide-react';
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
  const [newParceiro, setNewParceiro] = useState({
    name: '',
    email: '',
    phone: '',
    empresa: '',
    nif: '',
    morada: ''
  });
  const [contractForm, setContractForm] = useState({
    motorista_id: '',
    vehicle_id: '',
    tipo_contrato: 'aluguer',
    valor_semanal: '',
    valor_slot: '',
    percentagem_comissao: '',
    horarios: []
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
                    <Label htmlFor="motorista">Motorista *</Label>
                    <select
                      id="motorista"
                      value={contractForm.motorista_id}
                      onChange={(e) => setContractForm({...contractForm, motorista_id: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="">Selecione um motorista</option>
                      {motoristas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                    <select
                      id="tipo_contrato"
                      value={contractForm.tipo_contrato}
                      onChange={(e) => setContractForm({...contractForm, tipo_contrato: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="aluguer">Aluguer (Renting)</option>
                      <option value="compra_veiculo">Compra de Veículo</option>
                      <option value="carro_proprio">Carro Próprio (Slot)</option>
                      <option value="comissao_part_time">Comissão Part-Time</option>
                      <option value="comissao_full_time">Comissão Full-Time</option>
                    </select>
                  </div>

                  {contractForm.tipo_contrato !== 'carro_proprio' && (
                    <div>
                      <Label htmlFor="vehicle">Veículo {contractForm.tipo_contrato === 'carro_proprio' ? '' : '*'}</Label>
                      <select
                        id="vehicle"
                        value={contractForm.vehicle_id}
                        onChange={(e) => setContractForm({...contractForm, vehicle_id: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        required={contractForm.tipo_contrato !== 'carro_proprio'}
                      >
                        <option value="">Selecione um veículo</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.matricula} - {v.marca} {v.modelo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(contractForm.tipo_contrato === 'aluguer' || contractForm.tipo_contrato === 'compra_veiculo') && (
                    <div>
                      <Label htmlFor="valor_semanal">
                        {contractForm.tipo_contrato === 'aluguer' ? 'Valor Aluguer Semanal (€) *' : 'Valor Semanal Compra (€) *'}
                      </Label>
                      <Input
                        id="valor_semanal"
                        type="number"
                        step="0.01"
                        value={contractForm.valor_semanal}
                        onChange={(e) => setContractForm({...contractForm, valor_semanal: e.target.value})}
                        placeholder="Ex: 150.00"
                        required
                      />
                    </div>
                  )}

                  {contractForm.tipo_contrato === 'carro_proprio' && (
                    <div>
                      <Label htmlFor="valor_slot">Valor Slot Semanal (€) *</Label>
                      <Input
                        id="valor_slot"
                        type="number"
                        step="0.01"
                        value={contractForm.valor_slot}
                        onChange={(e) => setContractForm({...contractForm, valor_slot: e.target.value})}
                        placeholder="Ex: 50.00"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">Valor que o motorista paga para ter acesso ao slot na plataforma</p>
                    </div>
                  )}

                  {(contractForm.tipo_contrato === 'comissao_part_time' || contractForm.tipo_contrato === 'comissao_full_time') && (
                    <div>
                      <Label htmlFor="percentagem_comissao">Percentagem Comissão (%) *</Label>
                      <Input
                        id="percentagem_comissao"
                        type="number"
                        step="0.01"
                        max="100"
                        value={contractForm.percentagem_comissao}
                        onChange={(e) => setContractForm({...contractForm, percentagem_comissao: e.target.value})}
                        placeholder="Ex: 20.00"
                        required
                      />
                    </div>
                  )}

                  {contractForm.tipo_contrato === 'comissao_part_time' && (
                    <div className="space-y-2">
                      <Label>Horários de Disponibilidade</Label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={horarioTemp.inicio}
                          onChange={(e) => setHorarioTemp({...horarioTemp, inicio: e.target.value})}
                          placeholder="Início"
                          className="flex-1"
                        />
                        <span className="self-center">-</span>
                        <Input
                          type="time"
                          value={horarioTemp.fim}
                          onChange={(e) => setHorarioTemp({...horarioTemp, fim: e.target.value})}
                          placeholder="Fim"
                          className="flex-1"
                        />
                        <Button type="button" size="sm" onClick={handleAddHorario}>
                          +
                        </Button>
                      </div>
                      {contractForm.horarios.length > 0 && (
                        <div className="space-y-1">
                          {contractForm.horarios.map((horario, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                              <span className="text-sm">{horario}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveHorario(index)}
                              >
                                ✕
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
