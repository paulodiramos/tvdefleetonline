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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, DollarSign, Upload, FileSpreadsheet, FileText, Download, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Financials = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [newExpense, setNewExpense] = useState({
    vehicle_id: '',
    tipo: '',
    descricao: '',
    valor: 0,
    data: new Date().toISOString().split('T')[0],
    categoria: ''
  });
  const [newRevenue, setNewRevenue] = useState({
    vehicle_id: '',
    tipo: '',
    valor: 0,
    data: new Date().toISOString().split('T')[0],
    km_percorridos: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [vehiclesRes, expensesRes, revenuesRes] = await Promise.all([
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/expenses`),
        axios.get(`${API}/revenues`)
      ]);
      setVehicles(vehiclesRes.data);
      setExpenses(expensesRes.data);
      setRevenues(revenuesRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/expenses`, newExpense);
      toast.success('Despesa adicionada!');
      setShowExpenseDialog(false);
      fetchData();
      setNewExpense({
        vehicle_id: '',
        tipo: '',
        descricao: '',
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        categoria: ''
      });
    } catch (error) {
      toast.error('Erro ao adicionar despesa');
    }
  };

  const handleAddRevenue = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/revenues`, newRevenue);
      toast.success('Receita adicionada!');
      setShowRevenueDialog(false);
      fetchData();
      setNewRevenue({
        vehicle_id: '',
        tipo: '',
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        km_percorridos: 0
      });
    } catch (error) {
      toast.error('Erro ao adicionar receita');
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.valor, 0);
  const totalRevenues = revenues.reduce((sum, rev) => sum + rev.valor, 0);
  const roi = totalRevenues - totalExpenses;

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
      <div className="space-y-6" data-testid="financials-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Financeiro</h1>
            <p className="text-slate-600">Gerir receitas e despesas</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => navigate('/upload-csv')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50" data-testid="add-expense-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Despesa
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="add-expense-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Despesa</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Veículo</Label>
                    <Select value={newExpense.vehicle_id} onValueChange={(value) => setNewExpense({...newExpense, vehicle_id: value})} required>
                      <SelectTrigger data-testid="expense-vehicle-select">
                        <SelectValue placeholder="Selecionar veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newExpense.tipo} onValueChange={(value) => setNewExpense({...newExpense, tipo: value})} required>
                      <SelectTrigger data-testid="expense-tipo-select">
                        <SelectValue placeholder="Tipo de despesa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seguro">Seguro</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="combustivel">Combustível</SelectItem>
                        <SelectItem value="portagem">Portagem</SelectItem>
                        <SelectItem value="multa">Multa</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Input id="descricao" value={newExpense.descricao} onChange={(e) => setNewExpense({...newExpense, descricao: e.target.value})} required data-testid="expense-descricao-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (€)</Label>
                    <Input id="valor" type="number" step="0.01" value={newExpense.valor} onChange={(e) => setNewExpense({...newExpense, valor: parseFloat(e.target.value)})} required data-testid="expense-valor-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data">Data</Label>
                    <Input id="data" type="date" value={newExpense.data} onChange={(e) => setNewExpense({...newExpense, data: e.target.value})} required data-testid="expense-data-input" />
                  </div>
                  <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" data-testid="submit-expense-button">
                    Adicionar Despesa
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-revenue-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Receita
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="add-revenue-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Receita</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddRevenue} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Veículo</Label>
                    <Select value={newRevenue.vehicle_id} onValueChange={(value) => setNewRevenue({...newRevenue, vehicle_id: value})} required>
                      <SelectTrigger data-testid="revenue-vehicle-select">
                        <SelectValue placeholder="Selecionar veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newRevenue.tipo} onValueChange={(value) => setNewRevenue({...newRevenue, tipo: value})} required>
                      <SelectTrigger data-testid="revenue-tipo-select">
                        <SelectValue placeholder="Tipo de receita" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uber">Uber</SelectItem>
                        <SelectItem value="bolt">Bolt</SelectItem>
                        <SelectItem value="aluguer">Aluguer</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_rev">Valor (€)</Label>
                    <Input id="valor_rev" type="number" step="0.01" value={newRevenue.valor} onChange={(e) => setNewRevenue({...newRevenue, valor: parseFloat(e.target.value)})} required data-testid="revenue-valor-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="km">Km Percorridos</Label>
                    <Input id="km" type="number" value={newRevenue.km_percorridos} onChange={(e) => setNewRevenue({...newRevenue, km_percorridos: parseInt(e.target.value)})} data-testid="revenue-km-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_rev">Data</Label>
                    <Input id="data_rev" type="date" value={newRevenue.data} onChange={(e) => setNewRevenue({...newRevenue, data: e.target.value})} required data-testid="revenue-data-input" />
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-revenue-button">
                    Adicionar Receita
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-hover" data-testid="total-revenues-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Receitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-3xl font-bold text-emerald-600">€{totalRevenues.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover" data-testid="total-expenses-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-3xl font-bold text-red-600">€{totalExpenses.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover" data-testid="total-roi-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className={`text-3xl font-bold ${roi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>€{roi.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <Tabs defaultValue="revenues" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="revenues" data-testid="revenues-tab">Receitas</TabsTrigger>
                <TabsTrigger value="expenses" data-testid="expenses-tab">Despesas</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="revenues" className="space-y-4">
                {revenues.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>Nenhuma receita registada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {revenues.map((revenue) => {
                      const vehicle = vehicles.find(v => v.id === revenue.vehicle_id);
                      return (
                        <div key={revenue.id} className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg" data-testid={`revenue-item-${revenue.id}`}>
                          <div>
                            <p className="font-medium text-slate-800">{revenue.tipo.toUpperCase()}</p>
                            <p className="text-sm text-slate-600">{vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Veículo'} - {new Date(revenue.data).toLocaleDateString('pt-PT')}</p>
                            {revenue.km_percorridos > 0 && (
                              <p className="text-xs text-slate-500">{revenue.km_percorridos} km</p>
                            )}
                          </div>
                          <span className="text-lg font-bold text-emerald-600">€{revenue.valor.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="expenses" className="space-y-4">
                {expenses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>Nenhuma despesa registada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((expense) => {
                      const vehicle = vehicles.find(v => v.id === expense.vehicle_id);
                      return (
                        <div key={expense.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg" data-testid={`expense-item-${expense.id}`}>
                          <div>
                            <p className="font-medium text-slate-800">{expense.tipo.toUpperCase()}</p>
                            <p className="text-sm text-slate-600">{vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Veículo'} - {new Date(expense.data).toLocaleDateString('pt-PT')}</p>
                            <p className="text-xs text-slate-500">{expense.descricao}</p>
                          </div>
                          <span className="text-lg font-bold text-red-600">€{expense.valor.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

export default Financials;