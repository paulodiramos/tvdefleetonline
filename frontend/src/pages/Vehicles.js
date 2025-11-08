import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Car, Edit, Trash2, Shield, Wrench, Calendar } from 'lucide-react';

const Vehicles = ({ user, onLogout }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    marca: '',
    modelo: '',
    matricula: '',
    ano: new Date().getFullYear(),
    cor: '',
    tipo: 'sedan',
    disponibilidade: {
      status: 'disponivel',
      comissao_full_time: 0,
      comissao_part_time: 0
    }
  });

  useEffect(() => {
    fetchVehicles();
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

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/vehicles`, newVehicle);
      toast.success('Veículo adicionado com sucesso!');
      setShowAddDialog(false);
      fetchVehicles();
      setNewVehicle({
        marca: '',
        modelo: '',
        matricula: '',
        ano: new Date().getFullYear(),
        cor: '',
        tipo: 'sedan',
        disponibilidade: {
          status: 'disponivel',
          comissao_full_time: 0,
          comissao_part_time: 0
        }
      });
    } catch (error) {
      toast.error('Erro ao adicionar veículo');
    }
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      disponivel: { label: 'Disponível', color: 'bg-emerald-100 text-emerald-700' },
      atribuido: { label: 'Atribuído', color: 'bg-blue-100 text-blue-700' },
      manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
      seguro: { label: 'Seguro', color: 'bg-red-100 text-red-700' },
      sinistro: { label: 'Sinistro', color: 'bg-red-100 text-red-700' },
      venda: { label: 'Venda', color: 'bg-slate-100 text-slate-700' }
    };
    const config = statusConfig[status] || statusConfig.disponivel;
    return <Badge className={config.color}>{config.label}</Badge>;
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
            <p className="text-slate-600">Gerir a frota de veículos</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestor_associado' || user.role === 'parceiro_associado') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-vehicle-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Veículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="add-vehicle-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Veículo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddVehicle} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca</Label>
                      <Input id="marca" value={newVehicle.marca} onChange={(e) => setNewVehicle({...newVehicle, marca: e.target.value})} required data-testid="vehicle-marca-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modelo">Modelo</Label>
                      <Input id="modelo" value={newVehicle.modelo} onChange={(e) => setNewVehicle({...newVehicle, modelo: e.target.value})} required data-testid="vehicle-modelo-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="matricula">Matrícula</Label>
                      <Input id="matricula" value={newVehicle.matricula} onChange={(e) => setNewVehicle({...newVehicle, matricula: e.target.value})} required data-testid="vehicle-matricula-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ano">Ano</Label>
                      <Input id="ano" type="number" value={newVehicle.ano} onChange={(e) => setNewVehicle({...newVehicle, ano: parseInt(e.target.value)})} required data-testid="vehicle-ano-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cor">Cor</Label>
                      <Input id="cor" value={newVehicle.cor} onChange={(e) => setNewVehicle({...newVehicle, cor: e.target.value})} required data-testid="vehicle-cor-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Select value={newVehicle.tipo} onValueChange={(value) => setNewVehicle({...newVehicle, tipo: value})}>
                        <SelectTrigger data-testid="vehicle-tipo-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedan">Sedan</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                          <SelectItem value="van">Van</SelectItem>
                          <SelectItem value="eletrico">Elétrico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status de Disponibilidade</Label>
                    <Select 
                      value={newVehicle.disponibilidade.status} 
                      onValueChange={(value) => setNewVehicle({...newVehicle, disponibilidade: {...newVehicle.disponibilidade, status: value}})}
                    >
                      <SelectTrigger data-testid="vehicle-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="atribuido">Atribuído</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="comissao_full">Comissão Full Time (€)</Label>
                      <Input id="comissao_full" type="number" step="0.01" value={newVehicle.disponibilidade.comissao_full_time} onChange={(e) => setNewVehicle({...newVehicle, disponibilidade: {...newVehicle.disponibilidade, comissao_full_time: parseFloat(e.target.value)}})} data-testid="vehicle-comissao-full-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="comissao_part">Comissão Part Time (€)</Label>
                      <Input id="comissao_part" type="number" step="0.01" value={newVehicle.disponibilidade.comissao_part_time} onChange={(e) => setNewVehicle({...newVehicle, disponibilidade: {...newVehicle.disponibilidade, comissao_part_time: parseFloat(e.target.value)}})} data-testid="vehicle-comissao-part-input" />
                    </div>
                  </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="card-hover" data-testid={`vehicle-card-${vehicle.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{vehicle.marca} {vehicle.modelo}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">{vehicle.matricula}</p>
                    </div>
                    <Car className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Ano:</span>
                    <span className="font-medium">{vehicle.ano}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Cor:</span>
                    <span className="font-medium">{vehicle.cor}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Status:</span>
                    {getStatusBadge(vehicle.disponibilidade.status)}
                  </div>
                  {vehicle.seguro && (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <Shield className="w-4 h-4" />
                        <span>Seguro: {vehicle.seguro.seguradora}</span>
                      </div>
                    </div>
                  )}
                  {(user.role === 'admin' || user.role === 'gestor_associado') && (
                    <div className="flex space-x-2 pt-3 border-t border-slate-200">
                      <Button variant="outline" size="sm" className="flex-1" data-testid={`edit-vehicle-${vehicle.id}`}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteVehicle(vehicle.id)} data-testid={`delete-vehicle-${vehicle.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Vehicles;