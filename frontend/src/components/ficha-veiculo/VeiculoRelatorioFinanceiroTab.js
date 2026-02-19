import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Save, TrendingUp } from 'lucide-react';

const VeiculoRelatorioFinanceiroTab = ({ vehicleId, canEdit, user, relatorioGanhos, setRelatorioGanhos }) => {
  const [periodo, setPeriodo] = useState('total');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddCusto, setShowAddCusto] = useState(false);
  const [custoForm, setCustoForm] = useState({
    categoria: 'outros',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    fornecedor: ''
  });

  const categorias = [
    { value: 'revisao', label: 'Revisão', icon: '🔧' },
    { value: 'vistoria', label: 'Vistoria/Inspeção', icon: '📋' },
    { value: 'seguro', label: 'Seguro', icon: '🛡️' },
    { value: 'pneus', label: 'Pneus', icon: '⚙️' },
    { value: 'reparacao', label: 'Reparação', icon: '🔨' },
    { value: 'combustivel', label: 'Combustível', icon: '⛽' },
    { value: 'lavagem', label: 'Lavagem', icon: '🚿' },
    { value: 'multa', label: 'Multa', icon: '📃' },
    { value: 'outros', label: 'Outros', icon: '📦' }
  ];

  const anos = [2023, 2024, 2025, 2026];
  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/api/vehicles/${vehicleId}/relatorio-ganhos?periodo=${periodo}`;
      if (periodo === 'ano') url += `&ano=${ano}`;
      if (periodo === 'mes') url += `&ano=${ano}&mes=${mes}`;
      if (periodo === 'custom' && dataInicio && dataFim) {
        url += `&data_inicio=${dataInicio}&data_fim=${dataFim}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRelatorioGanhos(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      toast.error('Erro ao carregar relatório financeiro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      if (periodo === 'custom' && (!dataInicio || !dataFim)) {
        return;
      }
      fetchRelatorio();
    }
  }, [vehicleId, periodo, ano, mes, dataInicio, dataFim]);

  const handleAddCusto = async (e) => {
    e.preventDefault();
    if (!custoForm.descricao || !custoForm.valor || !custoForm.data) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/vehicles/${vehicleId}/custos`, custoForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Custo adicionado com sucesso!');
      setShowAddCusto(false);
      setCustoForm({
        categoria: 'outros',
        descricao: '',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        fornecedor: ''
      });
      fetchRelatorio();
    } catch (error) {
      console.error('Erro ao adicionar custo:', error);
      toast.error('Erro ao adicionar custo');
    }
  };

  const getRoiColor = (roi) => {
    if (roi >= 20) return 'text-green-600 bg-green-50';
    if (roi >= 0) return 'text-blue-600 bg-blue-50';
    return 'text-red-600 bg-red-50';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  return (
    <div className="space-y-4">
      {/* Filtros de Período */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Período:</span>
              <select 
                value={periodo} 
                onChange={(e) => setPeriodo(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="total">Total (desde aquisição)</option>
                <option value="ano">Por Ano</option>
                <option value="mes">Por Mês</option>
                <option value="custom">Entre Datas</option>
              </select>
            </div>
            
            {(periodo === 'ano' || periodo === 'mes') && (
              <select 
                value={ano} 
                onChange={(e) => setAno(Number(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            
            {periodo === 'mes' && (
              <select 
                value={mes} 
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}

            {periodo === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm"
                />
                <span className="text-sm text-slate-500">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm"
                />
              </div>
            )}

            {canEdit && (
              <Button 
                size="sm" 
                onClick={() => setShowAddCusto(true)}
                className="ml-auto"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Custo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo com ROI */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-green-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Receitas</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(relatorioGanhos.ganhos_total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Alugueres cobrados</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Custos</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(relatorioGanhos.despesas_total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Manutenção, seguro, etc.</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Lucro</p>
            <p className={`text-2xl font-bold ${relatorioGanhos.lucro >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(relatorioGanhos.lucro)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Receitas - Custos</p>
          </CardContent>
        </Card>
        <Card className={getRoiColor(relatorioGanhos.roi || 0)}>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">ROI</p>
            <p className="text-2xl font-bold">
              {(relatorioGanhos.roi || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Retorno sobre investimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Custos por Categoria */}
      {relatorioGanhos.custos?.por_categoria && Object.keys(relatorioGanhos.custos.por_categoria).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(relatorioGanhos.custos.por_categoria).map(([cat, valor]) => {
                const catInfo = categorias.find(c => c.value === cat) || { label: cat, icon: '📦' };
                return (
                  <div key={cat} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">
                      {catInfo.icon} {catInfo.label}
                    </span>
                    <span className="font-medium text-red-600">{formatCurrency(valor)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de Movimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : relatorioGanhos.detalhes && relatorioGanhos.detalhes.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {relatorioGanhos.detalhes.map((item, index) => (
                <div key={index} className="flex justify-between items-center border-b py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.tipo === 'ganho' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <div>
                      <p className="font-medium text-sm">{item.descricao}</p>
                      <p className="text-xs text-slate-500">
                        {item.data} {item.categoria && `• ${item.categoria}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${item.tipo === 'ganho' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.tipo === 'ganho' ? '+' : '-'}{formatCurrency(item.valor)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum movimento registado para este período.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar Custo */}
      <Dialog open={showAddCusto} onOpenChange={setShowAddCusto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Custo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCusto} className="space-y-4">
            <div>
              <Label>Categoria *</Label>
              <select
                value={custoForm.categoria}
                onChange={(e) => setCustoForm({...custoForm, categoria: e.target.value})}
                className="w-full p-2 border rounded-md"
              >
                {categorias.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={custoForm.descricao}
                onChange={(e) => setCustoForm({...custoForm, descricao: e.target.value})}
                placeholder="Ex: Troca de óleo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={custoForm.valor}
                  onChange={(e) => setCustoForm({...custoForm, valor: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={custoForm.data}
                  onChange={(e) => setCustoForm({...custoForm, data: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Fornecedor/Oficina</Label>
              <Input
                value={custoForm.fornecedor}
                onChange={(e) => setCustoForm({...custoForm, fornecedor: e.target.value})}
                placeholder="Nome do fornecedor (opcional)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddCusto(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VeiculoRelatorioFinanceiroTab;
