import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import FilterBar from '@/components/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Car, Trash2, AlertCircle, Calendar, Fuel, FileText, User, Upload, Download, XCircle, AlertTriangle } from 'lucide-react';

const Vehicles = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState({
    parceiro: 'all',
    status: 'all',
    combustivel: 'all',
    search: ''
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    marca: '',
    modelo: '',
    matricula: '',
    data_matricula: '',
    validade_matricula: '',
    cor: '',
    combustivel: 'gasolina',
    caixa: 'manual',
    lugares: 5,
    parceiro_id: '',
    tipo_contrato: {
      tipo: 'aluguer',
      valor_aluguer: 0,
      comissao_parceiro: 0,
      comissao_motorista: 0,
      inclui_combustivel: false,
      inclui_via_verde: false,
      regime: 'full_time',
      horarios_disponiveis: ''
    },
    categorias_uber: {
      uberx: false,
      share: false,
      electric: false,
      black: false,
      comfort: false,
      xl: false,
      xxl: false,
      pet: false,
      package: false
    },
    categorias_bolt: {
      economy: false,
      comfort: false,
      executive: false,
      xl: false,
      green: false,
      xxl: false,
      motorista_privado: false,
      pet: false
    },
    via_verde_disponivel: false,
    cartao_frota_disponivel: false
  });

  useEffect(() => {
    fetchVehicles();
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    }
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`);
      setVehicles(response.data);
    } catch (error) {
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  };

  const fetchParceiros = async () => {
    try {
      const response = await axios.get(`${API}/parceiros`);
      setParceiros(response.data);
    } catch (error) {
      console.error('Erro ao carregar parceiros');
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/vehicles`, newVehicle);
      const vehicleId = response.data.id;
      
      toast.success('Veículo adicionado com sucesso!');
      setShowAddDialog(false);
      resetForm();
      
      // Redirect to vehicle ficha for further editing
      navigate(`/ficha-veiculo/${vehicleId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar veículo');
    }
  };

  const resetForm = () => {
    setNewVehicle({
      marca: '',
      modelo: '',
      matricula: '',
      data_matricula: '',
      validade_matricula: '',
      cor: '',
      combustivel: 'gasolina',
      caixa: 'manual',
      lugares: 5,
      parceiro_id: '',
      tipo_contrato: {
        tipo: 'aluguer',
        valor_aluguer: 0,
        comissao_parceiro: 0,
        comissao_motorista: 0,
        inclui_combustivel: false,
        inclui_via_verde: false,
        regime: 'full_time',
        horarios_disponiveis: ''
      },
      categorias_uber: {
        uberx: false,
        share: false,
        electric: false,
        black: false,
        comfort: false,
        xl: false,
        xxl: false,
        pet: false,
        package: false
      },
      categorias_bolt: {
        economy: false,
        comfort: false,
        executive: false,
        xl: false,
        green: false,
        xxl: false,
        motorista_privado: false,
        pet: false
      },
      via_verde_disponivel: false,
      cartao_frota_disponivel: false
    });
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('Tem certeza que deseja eliminar este veículo?')) {
      try {
        await axios.delete(`${API}/vehicles/${vehicleId}`);
        toast.success('Veículo eliminado');
        fetchVehicles();
      } catch (error) {
        toast.error('Erro ao eliminar veículo');
      }
    }
  };

  const getContratoLabel = (tipo) => {
    const labels = { aluguer: 'Aluguer', comissao: 'Comissão', motorista_privado: 'Privado' };
    return labels[tipo] || tipo;
  };

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      if (filters.parceiro && filters.parceiro !== 'all' && vehicle.parceiro_id !== filters.parceiro) return false;
      if (filters.status && filters.status !== 'all' && vehicle.status !== filters.status) return false;
      if (filters.combustivel && filters.combustivel !== 'all' && vehicle.combustivel !== filters.combustivel) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = `${vehicle.marca} ${vehicle.modelo} ${vehicle.matricula}`.toLowerCase();
        if (!searchableText.includes(searchLower)) return false;
      }
      return true;
    });
  }, [vehicles, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      parceiro: 'all',
      status: 'all',
      combustivel: 'all',
      search: ''
    });
  };

  const filterOptions = {
    search: {
      type: 'text',
      label: 'Pesquisar',
      placeholder: 'Marca, modelo ou matrícula...'
    },
    parceiro: {
      type: 'select',
      label: 'Parceiro/Frota',
      placeholder: 'Todos os parceiros',
      items: parceiros.map(p => ({ value: p.id, label: p.nome }))
    },
    status: {
      type: 'select',
      label: 'Status',
      placeholder: 'Todos os status',
      items: [
        { value: 'disponivel', label: 'Disponível' },
        { value: 'atribuido', label: 'Atribuído' },
        { value: 'manutencao', label: 'Manutenção' },
        { value: 'inativo', label: 'Inativo' }
      ]
    },
    combustivel: {
      type: 'select',
      label: 'Combustível',
      placeholder: 'Todos',
      items: [
        { value: 'gasolina', label: 'Gasolina' },
        { value: 'diesel', label: 'Diesel' },
        { value: 'eletrico', label: 'Elétrico' },
        { value: 'hibrido', label: 'Híbrido' },
        { value: 'gas', label: 'GPL/GNV' }
      ]
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

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="vehicles-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Veículos</h1>
            <p className="text-slate-600">Gerir frota de veículos</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-vehicle-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Veículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="add-vehicle-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Veículo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddVehicle} className="space-y-6">
                  <Tabs defaultValue="basico" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
                      <TabsTrigger value="contrato">Contrato</TabsTrigger>
                      <TabsTrigger value="uber">Uber</TabsTrigger>
                      <TabsTrigger value="bolt">Bolt</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basico" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {(user.role === 'admin' || user.role === 'gestao') && (
                          <div className="space-y-2 col-span-2 md:col-span-3">
                            <Label>Parceiro *</Label>
                            <Select value={newVehicle.parceiro_id} onValueChange={(value) => setNewVehicle({...newVehicle, parceiro_id: value})} required>
                              <SelectTrigger data-testid="vehicle-parceiro-select">
                                <SelectValue placeholder="Selecionar parceiro" />
                              </SelectTrigger>
                              <SelectContent>
                                {parceiros.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} {p.empresa && `- ${p.empresa}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Marca *</Label>
                          <Input value={newVehicle.marca} onChange={(e) => setNewVehicle({...newVehicle, marca: e.target.value})} required data-testid="vehicle-marca-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Modelo *</Label>
                          <Input value={newVehicle.modelo} onChange={(e) => setNewVehicle({...newVehicle, modelo: e.target.value})} required data-testid="vehicle-modelo-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Matrícula *</Label>
                          <Input value={newVehicle.matricula} onChange={(e) => setNewVehicle({...newVehicle, matricula: e.target.value.toUpperCase()})} required placeholder="AB-12-CD" data-testid="vehicle-matricula-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Data Matrícula *</Label>
                          <Input type="date" value={newVehicle.data_matricula} onChange={(e) => setNewVehicle({...newVehicle, data_matricula: e.target.value})} required data-testid="vehicle-data-matricula-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade Matrícula *</Label>
                          <Input type="date" value={newVehicle.validade_matricula} onChange={(e) => setNewVehicle({...newVehicle, validade_matricula: e.target.value})} required data-testid="vehicle-validade-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Cor *</Label>
                          <Input value={newVehicle.cor} onChange={(e) => setNewVehicle({...newVehicle, cor: e.target.value})} required data-testid="vehicle-cor-input" />
                        </div>
                        <div className="space-y-2">
                          <Label>Combustível *</Label>
                          <Select value={newVehicle.combustivel} onValueChange={(value) => setNewVehicle({...newVehicle, combustivel: value})}>
                            <SelectTrigger data-testid="vehicle-combustivel-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gasolina">Gasolina</SelectItem>
                              <SelectItem value="diesel">Diesel</SelectItem>
                              <SelectItem value="eletrico">Elétrico</SelectItem>
                              <SelectItem value="hibrido">Híbrido</SelectItem>
                              <SelectItem value="gnv">GNV</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Caixa *</Label>
                          <Select value={newVehicle.caixa} onValueChange={(value) => setNewVehicle({...newVehicle, caixa: value})}>
                            <SelectTrigger data-testid="vehicle-caixa-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="automatica">Automática</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Lugares *</Label>
                          <Input type="number" min="2" max="9" value={newVehicle.lugares} onChange={(e) => setNewVehicle({...newVehicle, lugares: parseInt(e.target.value)})} required data-testid="vehicle-lugares-input" />
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="via_verde" 
                            checked={newVehicle.via_verde_disponivel}
                            onCheckedChange={(checked) => setNewVehicle({...newVehicle, via_verde_disponivel: checked})}
                            data-testid="vehicle-viaverde-checkbox"
                          />
                          <Label htmlFor="via_verde" className="cursor-pointer">Via Verde Disponível</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="cartao_frota" 
                            checked={newVehicle.cartao_frota_disponivel}
                            onCheckedChange={(checked) => setNewVehicle({...newVehicle, cartao_frota_disponivel: checked})}
                            data-testid="vehicle-cartaofrota-checkbox"
                          />
                          <Label htmlFor="cartao_frota" className="cursor-pointer">Cartão Frota Disponível</Label>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="contrato" className="space-y-4 mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Tipo de Contrato *</Label>
                          <Select value={newVehicle.tipo_contrato.tipo} onValueChange={(value) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, tipo: value}})}>
                            <SelectTrigger data-testid="vehicle-contrato-tipo-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aluguer">Aluguer</SelectItem>
                              <SelectItem value="comissao">Comissão</SelectItem>
                              <SelectItem value="motorista_privado">Motorista Privado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newVehicle.tipo_contrato.tipo === 'aluguer' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Valor Aluguer Semanal (€) *</Label>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="Valor por semana"
                                onChange={(e) => {
                                  const valorSemanal = parseFloat(e.target.value) || 0;
                                  const valorDiario = valorSemanal / 7;
                                  setNewVehicle({
                                    ...newVehicle, 
                                    tipo_contrato: {
                                      ...newVehicle.tipo_contrato, 
                                      valor_aluguer: valorDiario,
                                      valor_aluguer_semanal: valorSemanal
                                    }
                                  });
                                }}
                                value={newVehicle.tipo_contrato.valor_aluguer_semanal || (newVehicle.tipo_contrato.valor_aluguer * 7).toFixed(2)}
                                data-testid="vehicle-valor-aluguer-semanal-input" 
                              />
                              <p className="text-xs text-slate-500">Insira o valor semanal</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Valor Aluguer Diário (€) *</Label>
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={newVehicle.tipo_contrato.valor_aluguer ? newVehicle.tipo_contrato.valor_aluguer.toFixed(2) : '0.00'} 
                                onChange={(e) => {
                                  const valorDiario = parseFloat(e.target.value) || 0;
                                  const valorSemanal = valorDiario * 7;
                                  setNewVehicle({
                                    ...newVehicle, 
                                    tipo_contrato: {
                                      ...newVehicle.tipo_contrato, 
                                      valor_aluguer: valorDiario,
                                      valor_aluguer_semanal: valorSemanal
                                    }
                                  });
                                }}
                                required 
                                data-testid="vehicle-valor-aluguer-input"
                                className="bg-blue-50"
                              />
                              <p className="text-xs text-blue-600 font-medium">Calculado automaticamente</p>
                            </div>
                          </div>
                        )}

                        {newVehicle.tipo_contrato.tipo === 'comissao' && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Comissão Parceiro (%) *</Label>
                                <Input type="number" step="0.01" value={newVehicle.tipo_contrato.comissao_parceiro} onChange={(e) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, comissao_parceiro: parseFloat(e.target.value)}})} required data-testid="vehicle-comissao-parceiro-input" />
                              </div>
                              <div className="space-y-2">
                                <Label>Comissão Motorista (%) *</Label>
                                <Input type="number" step="0.01" value={newVehicle.tipo_contrato.comissao_motorista} onChange={(e) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, comissao_motorista: parseFloat(e.target.value)}})} required data-testid="vehicle-comissao-motorista-input" />
                              </div>
                            </div>
                            <div className="flex items-center space-x-6">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="inclui_combustivel" 
                                  checked={newVehicle.tipo_contrato.inclui_combustivel}
                                  onCheckedChange={(checked) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, inclui_combustivel: checked}})}
                                  data-testid="vehicle-inclui-combustivel-checkbox"
                                />
                                <Label htmlFor="inclui_combustivel" className="cursor-pointer">Inclui Combustível</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="inclui_via_verde" 
                                  checked={newVehicle.tipo_contrato.inclui_via_verde}
                                  onCheckedChange={(checked) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, inclui_via_verde: checked}})}
                                  data-testid="vehicle-inclui-viaverde-checkbox"
                                />
                                <Label htmlFor="inclui_via_verde" className="cursor-pointer">Inclui Via Verde</Label>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Regime *</Label>
                              <Select value={newVehicle.tipo_contrato.regime} onValueChange={(value) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, regime: value}})}>
                                <SelectTrigger data-testid="vehicle-regime-select">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full_time">Full Time</SelectItem>
                                  <SelectItem value="part_time">Part Time</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {newVehicle.tipo_contrato.regime === 'part_time' && (
                              <div className="space-y-2">
                                <Label>Horários Disponíveis</Label>
                                <Input value={newVehicle.tipo_contrato.horarios_disponiveis} onChange={(e) => setNewVehicle({...newVehicle, tipo_contrato: {...newVehicle.tipo_contrato, horarios_disponiveis: e.target.value}})} placeholder="Ex: 09:00-18:00" data-testid="vehicle-horarios-input" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="uber" className="space-y-4 mt-4">
                      <Label className="text-base font-semibold">Categorias Uber</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.keys(newVehicle.categorias_uber).map(cat => (
                          <div key={cat} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`uber_${cat}`}
                              checked={newVehicle.categorias_uber[cat]}
                              onCheckedChange={(checked) => setNewVehicle({...newVehicle, categorias_uber: {...newVehicle.categorias_uber, [cat]: checked}})}
                              data-testid={`vehicle-uber-${cat}-checkbox`}
                            />
                            <Label htmlFor={`uber_${cat}`} className="cursor-pointer capitalize">
                              {cat === 'uberx' ? 'UberX' : cat === 'xxl' ? 'XXL' : cat === 'xl' ? 'XL' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="bolt" className="space-y-4 mt-4">
                      <Label className="text-base font-semibold">Categorias Bolt</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.keys(newVehicle.categorias_bolt).map(cat => (
                          <div key={cat} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`bolt_${cat}`}
                              checked={newVehicle.categorias_bolt[cat]}
                              onCheckedChange={(checked) => setNewVehicle({...newVehicle, categorias_bolt: {...newVehicle.categorias_bolt, [cat]: checked}})}
                              data-testid={`vehicle-bolt-${cat}-checkbox`}
                            />
                            <Label htmlFor={`bolt_${cat}`} className="cursor-pointer capitalize">
                              {cat === 'xxl' ? 'XXL' : cat === 'xl' ? 'XL' : cat.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-vehicle-button">
                    Adicionar Veículo
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {vehicles.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum veículo encontrado</p>
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
                Mostrando {filteredVehicles.length} de {vehicles.length} veículos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle) => (
              <Card key={vehicle.id} className="card-hover" data-testid={`vehicle-card-${vehicle.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{vehicle.marca} {vehicle.modelo}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1 font-mono">{vehicle.matricula}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-700">
                          {getContratoLabel(vehicle.tipo_contrato.tipo)}
                        </Badge>
                        {vehicle.status && (
                          <Badge className={
                            vehicle.status === 'disponivel' ? 'bg-green-100 text-green-700' :
                            vehicle.status === 'atribuido' ? 'bg-purple-100 text-purple-700' :
                            vehicle.status === 'manutencao' ? 'bg-orange-100 text-orange-700' :
                            vehicle.status === 'venda' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }>
                            {vehicle.status === 'disponivel' ? 'Disponível' :
                             vehicle.status === 'atribuido' ? 'Atribuído' :
                             vehicle.status === 'manutencao' ? 'Manutenção' :
                             vehicle.status === 'venda' ? 'Venda' :
                             'Condições'}
                          </Badge>
                        )}
                        {vehicle.alerta_validade && (
                          <Badge className="bg-amber-100 text-amber-700">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Validade próxima
                          </Badge>
                        )}
                      </div>
                      {vehicle.motorista_atribuido_nome && (
                        <p className="text-xs text-slate-600 mt-2">
                          <User className="w-3 h-3 inline mr-1" />
                          Motorista: <span className="font-medium">{vehicle.motorista_atribuido_nome}</span>
                        </p>
                      )}
                    </div>
                    <Car className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cor:</span>
                      <span className="font-medium capitalize">{vehicle.cor}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Combustível:</span>
                      <div className="flex items-center space-x-1">
                        <Fuel className="w-3 h-3 text-slate-500" />
                        <span className="font-medium capitalize">{vehicle.combustivel}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Caixa:</span>
                      <span className="font-medium capitalize">{vehicle.caixa}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Lugares:</span>
                      <span className="font-medium">{vehicle.lugares}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-slate-600">Validade:</span>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span className="font-medium text-xs">{new Date(vehicle.validade_matricula).toLocaleDateString('pt-PT')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-3 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/ficha-veiculo/${vehicle.id}`)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Ver Ficha
                    </Button>
                    {(user.role === 'admin' || user.role === 'gestao') && (
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteVehicle(vehicle.id)} data-testid={`delete-vehicle-${vehicle.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Vehicles;