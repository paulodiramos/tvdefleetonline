import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Car, User, Shield, ClipboardCheck, Wrench, Calendar, 
  TrendingUp, History, Edit, Save, X, Plus, FileText 
} from 'lucide-react';

const FichaVeiculo = ({ user, onLogout }) => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  // Estados dos formulários
  const [seguroForm, setSeguroForm] = useState({
    seguradora: '',
    numero_apolice: '',
    agente_seguros: '',
    data_inicio: '',
    data_validade: '',
    valor: '',
    periodicidade: 'anual'
  });

  const [inspecaoForm, setInspecaoForm] = useState({
    data_inspecao: '',
    validade: '',
    centro_inspecao: '',
    custo: '',
    observacoes: ''
  });

  const [revisaoForm, setRevisaoForm] = useState({
    proxima_revisao_km: '',
    proxima_revisao_data: ''
  });

  const [agendaForm, setAgendaForm] = useState({
    tipo: 'manutencao',
    titulo: '',
    data: '',
    hora: '',
    descricao: ''
  });

  const [historico, setHistorico] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [relatorioGanhos, setRelatorioGanhos] = useState({
    ganhos_total: 0,
    despesas_total: 0,
    lucro: 0,
    detalhes: []
  });

  const canEdit = user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional';

  useEffect(() => {
    fetchVehicleData();
  }, [vehicleId]);

  const fetchVehicleData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Get vehicle
      const vehicleRes = await axios.get(`${API}/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicle(vehicleRes.data);

      // Get motorista if assigned
      if (vehicleRes.data.motorista_atribuido) {
        const motoristaRes = await axios.get(`${API}/motoristas/${vehicleRes.data.motorista_atribuido}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMotorista(motoristaRes.data);
      }

      // Load existing data into forms
      if (vehicleRes.data.insurance) {
        setSeguroForm({
          seguradora: vehicleRes.data.insurance.seguradora || '',
          numero_apolice: vehicleRes.data.insurance.numero_apolice || '',
          agente_seguros: vehicleRes.data.insurance.agente_seguros || '',
          data_inicio: vehicleRes.data.insurance.data_inicio || '',
          data_validade: vehicleRes.data.insurance.data_validade || '',
          valor: vehicleRes.data.insurance.valor || '',
          periodicidade: vehicleRes.data.insurance.periodicidade || 'anual'
        });
      }

      if (vehicleRes.data.inspection) {
        setInspecaoForm({
          data_inspecao: vehicleRes.data.inspection.ultima_inspecao || '',
          validade: vehicleRes.data.inspection.proxima_inspecao || '',
          centro_inspecao: vehicleRes.data.inspection.centro_inspecao || '',
          custo: vehicleRes.data.inspection.valor || '',
          observacoes: vehicleRes.data.inspection.observacoes || ''
        });
      }

      // Fetch historico
      const historicoRes = await axios.get(`${API}/vehicles/${vehicleId}/historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(historicoRes.data);

      // Fetch agenda
      const agendaRes = await axios.get(`${API}/vehicles/${vehicleId}/agenda`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgenda(agendaRes.data);

      // Fetch relatorio ganhos
      const relatorioRes = await axios.get(`${API}/vehicles/${vehicleId}/relatorio-ganhos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRelatorioGanhos(relatorioRes.data);

    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      toast.error('Erro ao carregar dados do veículo');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeguro = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        insurance: {
          seguradora: seguroForm.seguradora,
          numero_apolice: seguroForm.numero_apolice,
          agente_seguros: seguroForm.agente_seguros,
          data_inicio: seguroForm.data_inicio,
          data_validade: seguroForm.data_validade,
          valor: parseFloat(seguroForm.valor),
          periodicidade: seguroForm.periodicidade
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Seguro atualizado com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error saving insurance:', error);
      toast.error('Erro ao salvar seguro');
    }
  };

  const handleSaveInspecao = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        inspection: {
          ultima_inspecao: inspecaoForm.data_inspecao,
          proxima_inspecao: inspecaoForm.validade,
          centro_inspecao: inspecaoForm.centro_inspecao,
          valor: parseFloat(inspecaoForm.custo),
          observacoes: inspecaoForm.observacoes
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Inspeção atualizada com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error saving inspection:', error);
      toast.error('Erro ao salvar inspeção');
    }
  };

  const handleSaveRevisao = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        proxima_revisao_km: revisaoForm.proxima_revisao_km ? parseInt(revisaoForm.proxima_revisao_km) : null,
        proxima_revisao_data: revisaoForm.proxima_revisao_data || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Próxima revisão atualizada!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error saving revision:', error);
      toast.error('Erro ao salvar próxima revisão');
    }
  };

  const handleAddAgenda = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vehicles/${vehicleId}/agenda`, agendaForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Evento adicionado à agenda!');
      setAgendaForm({
        tipo: 'manutencao',
        titulo: '',
        data: '',
        hora: '',
        descricao: ''
      });
      fetchVehicleData();
    } catch (error) {
      console.error('Error adding agenda:', error);
      toast.error('Erro ao adicionar evento');
    }
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

  if (!vehicle) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <p className="text-slate-500">Veículo não encontrado</p>
          <Button onClick={() => navigate('/vehicles')} className="mt-4">
            Voltar aos Veículos
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" onClick={() => navigate('/vehicles')} className="mb-2">
              ← Voltar
            </Button>
            <h1 className="text-3xl font-bold">Ficha do Veículo</h1>
            <p className="text-slate-600">{vehicle.marca} {vehicle.modelo} - {vehicle.matricula}</p>
          </div>
          {canEdit && (
            <Button onClick={() => setEditMode(!editMode)} variant={editMode ? 'destructive' : 'default'}>
              {editMode ? <><X className="w-4 h-4 mr-2" />Cancelar</> : <><Edit className="w-4 h-4 mr-2" />Editar</>}
            </Button>
          )}
        </div>

        {/* Motorista Atribuído */}
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span>Motorista Atribuído</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {motorista ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold">{motorista.name}</p>
                <p className="text-sm text-slate-600">{motorista.email}</p>
                <p className="text-sm text-slate-600">Telefone: {motorista.personal?.phone || 'N/A'}</p>
                {motorista.professional?.licenca_tvde && (
                  <p className="text-sm text-slate-600">Licença TVDE: {motorista.professional.licenca_tvde}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Nenhum motorista atribuído</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="seguro">Seguro</TabsTrigger>
            <TabsTrigger value="inspecao">Inspeção</TabsTrigger>
            <TabsTrigger value="revisao">Revisão</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          {/* Informações Básicas */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Informações do Veículo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Marca</Label>
                  <p className="font-medium">{vehicle.marca}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Modelo</Label>
                  <p className="font-medium">{vehicle.modelo}</p>
                </div>
                {vehicle.versao && (
                  <div>
                    <Label className="text-slate-600">Versão</Label>
                    <p className="font-medium">{vehicle.versao}</p>
                  </div>
                )}
                {vehicle.ano && (
                  <div>
                    <Label className="text-slate-600">Ano</Label>
                    <p className="font-medium">{vehicle.ano}</p>
                  </div>
                )}
                <div>
                  <Label className="text-slate-600">Matrícula</Label>
                  <p className="font-medium">{vehicle.matricula}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Cor</Label>
                  <p className="font-medium">{vehicle.cor}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Combustível</Label>
                  <p className="font-medium">{vehicle.combustivel}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Caixa</Label>
                  <p className="font-medium">{vehicle.caixa}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Lugares</Label>
                  <p className="font-medium">{vehicle.lugares}</p>
                </div>
                <div>
                  <Label className="text-slate-600">KM Atual</Label>
                  <p className="font-medium">{vehicle.km_atual || 0} km</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seguro */}
          <TabsContent value="seguro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Dados do Seguro</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="seguradora">Seguradora *</Label>
                    <Input
                      id="seguradora"
                      value={seguroForm.seguradora}
                      onChange={(e) => setSeguroForm({...seguroForm, seguradora: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_apolice">Número Apólice *</Label>
                    <Input
                      id="numero_apolice"
                      value={seguroForm.numero_apolice}
                      onChange={(e) => setSeguroForm({...seguroForm, numero_apolice: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="agente_seguros">Agente de Seguros</Label>
                    <Input
                      id="agente_seguros"
                      value={seguroForm.agente_seguros}
                      onChange={(e) => setSeguroForm({...seguroForm, agente_seguros: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_inicio">Data Início *</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      value={seguroForm.data_inicio}
                      onChange={(e) => setSeguroForm({...seguroForm, data_inicio: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_validade">Data Fim *</Label>
                    <Input
                      id="data_validade"
                      type="date"
                      value={seguroForm.data_validade}
                      onChange={(e) => setSeguroForm({...seguroForm, data_validade: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="valor">Valor (€) *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={seguroForm.valor}
                      onChange={(e) => setSeguroForm({...seguroForm, valor: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="periodicidade">Periodicidade *</Label>
                    <select
                      id="periodicidade"
                      value={seguroForm.periodicidade}
                      onChange={(e) => setSeguroForm({...seguroForm, periodicidade: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      disabled={!canEdit || !editMode}
                    >
                      <option value="anual">Anual</option>
                      <option value="semestral">Semestral</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>
                {canEdit && editMode && (
                  <Button onClick={handleSaveSeguro}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Seguro
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspeção */}
          <TabsContent value="inspecao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5" />
                  <span>Dados da Inspeção</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data_inspecao">Data da Inspeção *</Label>
                    <Input
                      id="data_inspecao"
                      type="date"
                      value={inspecaoForm.data_inspecao}
                      onChange={(e) => setInspecaoForm({...inspecaoForm, data_inspecao: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="validade">Validade *</Label>
                    <Input
                      id="validade"
                      type="date"
                      value={inspecaoForm.validade}
                      onChange={(e) => setInspecaoForm({...inspecaoForm, validade: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="centro_inspecao">Centro de Inspeção *</Label>
                    <Input
                      id="centro_inspecao"
                      value={inspecaoForm.centro_inspecao}
                      onChange={(e) => setInspecaoForm({...inspecaoForm, centro_inspecao: e.target.value})}
                      disabled={!canEdit || !editMode}
                      placeholder="Ex: Centro de Inspeção ABC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custo">Custo (€) *</Label>
                    <Input
                      id="custo"
                      type="number"
                      step="0.01"
                      value={inspecaoForm.custo}
                      onChange={(e) => setInspecaoForm({...inspecaoForm, custo: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <textarea
                      id="observacoes"
                      value={inspecaoForm.observacoes}
                      onChange={(e) => setInspecaoForm({...inspecaoForm, observacoes: e.target.value})}
                      disabled={!canEdit || !editMode}
                      className="w-full p-2 border rounded-md"
                      rows="3"
                      placeholder="Notas sobre a inspeção..."
                    />
                  </div>
                </div>
                {canEdit && editMode && (
                  <Button onClick={handleSaveInspecao}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Inspeção
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Próxima Revisão */}
          <TabsContent value="revisao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5" />
                  <span>Próxima Revisão</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proxima_revisao_km">Próxima Revisão (KM)</Label>
                    <Input
                      id="proxima_revisao_km"
                      type="number"
                      value={revisaoForm.proxima_revisao_km}
                      onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_km: e.target.value})}
                      disabled={!canEdit || !editMode}
                      placeholder="Ex: 150000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="proxima_revisao_data">Próxima Revisão (Data)</Label>
                    <Input
                      id="proxima_revisao_data"
                      type="date"
                      value={revisaoForm.proxima_revisao_data}
                      onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_data: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  Defina a próxima revisão por KM ou Data (ou ambos)
                </p>
                {canEdit && editMode && (
                  <Button onClick={handleSaveRevisao}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Revisão
                  </Button>
                )}

                {/* Histórico de Manutenções */}
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Histórico de Manutenções</h3>
                  {vehicle.manutencoes && vehicle.manutencoes.length > 0 ? (
                    <div className="space-y-2">
                      {vehicle.manutencoes.map((man, index) => (
                        <div key={index} className="border rounded p-3 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{man.tipo_manutencao}</p>
                              <p className="text-sm text-slate-600">{man.descricao}</p>
                              <p className="text-xs text-slate-500">Data: {man.data} | KM: {man.km_realizada}</p>
                            </div>
                            <p className="font-semibold text-emerald-600">€{man.valor}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nenhuma manutenção registrada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agenda */}
          <TabsContent value="agenda">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Agenda do Veículo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEdit && (
                  <form onSubmit={handleAddAgenda} className="space-y-4 border-b pb-4">
                    <h3 className="font-semibold">Adicionar Evento</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tipo">Tipo *</Label>
                        <select
                          id="tipo"
                          value={agendaForm.tipo}
                          onChange={(e) => setAgendaForm({...agendaForm, tipo: e.target.value})}
                          className="w-full p-2 border rounded-md"
                          required
                        >
                          <option value="manutencao">Manutenção</option>
                          <option value="inspecao">Inspeção</option>
                          <option value="revisao">Revisão</option>
                          <option value="seguro">Seguro</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="titulo">Título *</Label>
                        <Input
                          id="titulo"
                          value={agendaForm.titulo}
                          onChange={(e) => setAgendaForm({...agendaForm, titulo: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="data">Data *</Label>
                        <Input
                          id="data"
                          type="date"
                          value={agendaForm.data}
                          onChange={(e) => setAgendaForm({...agendaForm, data: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="hora">Hora</Label>
                        <Input
                          id="hora"
                          type="time"
                          value={agendaForm.hora}
                          onChange={(e) => setAgendaForm({...agendaForm, hora: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <textarea
                          id="descricao"
                          value={agendaForm.descricao}
                          onChange={(e) => setAgendaForm({...agendaForm, descricao: e.target.value})}
                          className="w-full p-2 border rounded-md"
                          rows="2"
                        />
                      </div>
                    </div>
                    <Button type="submit">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar à Agenda
                    </Button>
                  </form>
                )}

                {/* Lista de Agenda */}
                <div>
                  <h3 className="font-semibold mb-3">Próximos Eventos</h3>
                  {agenda.length > 0 ? (
                    <div className="space-y-2">
                      {agenda.map((evento) => (
                        <div key={evento.id} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{evento.titulo}</p>
                              <p className="text-sm text-slate-600">{evento.descricao}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(evento.data).toLocaleDateString('pt-BR')}
                                {evento.hora && ` às ${evento.hora}`}
                              </p>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {evento.tipo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nenhum evento agendado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Relatório Ganhos/Perdas */}
          <TabsContent value="relatorio">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Relatório Financeiro</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cards de Resumo */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-green-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Ganhos Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        €{relatorioGanhos.ganhos_total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Despesas Total</p>
                      <p className="text-2xl font-bold text-red-600">
                        €{relatorioGanhos.despesas_total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Lucro</p>
                      <p className="text-2xl font-bold text-blue-600">
                        €{relatorioGanhos.lucro.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detalhes */}
                {relatorioGanhos.detalhes && relatorioGanhos.detalhes.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Detalhes</h3>
                    <div className="space-y-2">
                      {relatorioGanhos.detalhes.map((item, index) => (
                        <div key={index} className="flex justify-between items-center border-b py-2">
                          <div>
                            <p className="font-medium">{item.descricao}</p>
                            <p className="text-xs text-slate-500">{item.data}</p>
                          </div>
                          <p className={`font-semibold ${item.tipo === 'ganho' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.tipo === 'ganho' ? '+' : '-'}€{item.valor.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FichaVeiculo;
