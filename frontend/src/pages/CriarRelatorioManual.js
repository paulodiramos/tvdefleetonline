import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  ArrowLeft, Save, FileText, DollarSign, Calendar, 
  User, Car, Plus, Trash2, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CriarRelatorioManual = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    motorista_id: '',
    semana: '',
    ano: new Date().getFullYear(),
    data_inicio: '',
    data_fim: '',
    
    // Ganhos
    ganhos_uber: 0,
    ganhos_bolt: 0,
    viagens_totais: 0,
    
    // Despesas
    combustivel_total: 0,
    via_verde_total: 0,
    caucao_semanal: 0,
    gps_custo: 0,
    
    // Danos e Extras
    danos: [],
    extras: 0,
    observacoes: ''
  });

  const [novoDano, setNovoDano] = useState({
    descricao: '',
    valor: 0
  });

  useEffect(() => {
    fetchMotoristas();
  }, []);

  useEffect(() => {
    // Auto-calcular datas quando semana é preenchida
    if (formData.semana && formData.ano) {
      const { dataInicio, dataFim } = calcularDatasDaSemana(formData.semana, formData.ano);
      setFormData(prev => ({
        ...prev,
        data_inicio: dataInicio,
        data_fim: dataFim
      }));
    }
  }, [formData.semana, formData.ano]);

  const fetchMotoristas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/motoristas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMotoristas(response.data);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const calcularDatasDaSemana = (semana, ano) => {
    const primeiroDiaAno = new Date(ano, 0, 1);
    const diasAteASemana = (semana - 1) * 7;
    const dataInicio = new Date(primeiroDiaAno.getTime() + diasAteASemana * 24 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    return {
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: dataFim.toISOString().split('T')[0]
    };
  };

  const calcularTotais = () => {
    const ganhosTotais = parseFloat(formData.ganhos_uber || 0) + parseFloat(formData.ganhos_bolt || 0);
    
    const totalDanos = formData.danos.reduce((sum, dano) => sum + parseFloat(dano.valor || 0), 0);
    
    const totalDespesas = 
      parseFloat(formData.combustivel_total || 0) +
      parseFloat(formData.via_verde_total || 0) +
      parseFloat(formData.caucao_semanal || 0) +
      parseFloat(formData.gps_custo || 0) +
      totalDanos +
      parseFloat(formData.extras || 0);
    
    const totalRecibo = ganhosTotais - totalDespesas;
    
    return { ganhosTotais, totalDespesas, totalDanos, totalRecibo };
  };

  const handleAddDano = () => {
    if (!novoDano.descricao || novoDano.valor <= 0) {
      toast.error('Preencha a descrição e valor do dano');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      danos: [...prev.danos, { ...novoDano }]
    }));
    
    setNovoDano({ descricao: '', valor: 0 });
  };

  const handleRemoveDano = (index) => {
    setFormData(prev => ({
      ...prev,
      danos: prev.danos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (status = 'rascunho') => {
    // Validações
    if (!formData.motorista_id) {
      toast.error('Selecione um motorista');
      return;
    }
    
    if (!formData.semana || !formData.ano) {
      toast.error('Preencha a semana e o ano');
      return;
    }

    setSalvando(true);
    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais();
      
      const payload = {
        ...formData,
        ganhos_totais: totais.ganhosTotais,
        total_despesas: totais.totalDespesas,
        total_recibo: totais.totalRecibo,
        outros: (formData.danos.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0) + parseFloat(formData.extras || 0)),
        status: status,
        estado: status,
        data_emissao: new Date().toISOString(),
        parceiro_id: user.id
      };
      
      await axios.post(
        `${API_URL}/api/relatorios/criar-manual`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(status === 'rascunho' ? 'Rascunho guardado!' : 'Relatório criado e enviado para aprovação!');
      navigate('/relatorios-semanais-lista');
    } catch (error) {
      console.error('Erro ao criar relatório:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar relatório');
    } finally {
      setSalvando(false);
    }
  };

  const motoristaInfo = motoristas.find(m => m.id === formData.motorista_id);
  const totais = calcularTotais();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => navigate('/criar-relatorio-opcoes')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Criar Relatório Manual
              </h1>
              <p className="text-slate-600">
                Introduza todos os dados manualmente
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Motorista *</Label>
                  <select
                    value={formData.motorista_id}
                    onChange={(e) => setFormData({ ...formData, motorista_id: e.target.value })}
                    className="w-full border rounded-md p-2"
                    required
                  >
                    <option value="">Selecione um motorista</option>
                    {motoristas.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nome} - {m.email}
                      </option>
                    ))}
                  </select>
                </div>

                {motoristaInfo && (
                  <div className="p-3 bg-blue-50 rounded-lg text-sm">
                    <p><strong>Veículo:</strong> {motoristaInfo.veiculo_matricula || 'Não atribuído'}</p>
                    <p><strong>Email:</strong> {motoristaInfo.email}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Semana *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="52"
                      value={formData.semana}
                      onChange={(e) => setFormData({ ...formData, semana: e.target.value })}
                      placeholder="1-52"
                      required
                    />
                  </div>
                  <div>
                    <Label>Ano *</Label>
                    <Input
                      type="number"
                      min="2020"
                      max="2030"
                      value={formData.ano}
                      onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Viagens</Label>
                    <Input
                      type="number"
                      value={formData.viagens_totais}
                      onChange={(e) => setFormData({ ...formData, viagens_totais: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={formData.data_fim}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ganhos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <DollarSign className="w-5 h-5" />
                  Ganhos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ganhos Uber (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.ganhos_uber}
                      onChange={(e) => setFormData({ ...formData, ganhos_uber: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Ganhos Bolt (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.ganhos_bolt}
                      onChange={(e) => setFormData({ ...formData, ganhos_bolt: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-semibold text-green-800">
                    Total Ganhos: €{totais.ganhosTotais.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Despesas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <DollarSign className="w-5 h-5" />
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Combustível (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.combustivel_total}
                      onChange={(e) => setFormData({ ...formData, combustivel_total: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Via Verde (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.via_verde_total}
                      onChange={(e) => setFormData({ ...formData, via_verde_total: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Caução Semanal (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.caucao_semanal}
                      onChange={(e) => setFormData({ ...formData, caucao_semanal: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>GPS (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.gps_custo}
                      onChange={(e) => setFormData({ ...formData, gps_custo: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertCircle className="w-5 h-5" />
                  Danos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.danos.length > 0 && (
                  <div className="space-y-2">
                    {formData.danos.map((dano, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <p className="font-medium">{dano.descricao}</p>
                          <p className="text-sm text-slate-600">€{parseFloat(dano.valor).toFixed(2)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveDano(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-sm font-semibold text-orange-800">
                      Total Danos: €{totais.totalDanos.toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold text-sm">Adicionar Novo Dano</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input
                        value={novoDano.descricao}
                        onChange={(e) => setNovoDano({ ...novoDano, descricao: e.target.value })}
                        placeholder="Descrição do dano"
                      />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={novoDano.valor}
                      onChange={(e) => setNovoDano({ ...novoDano, valor: e.target.value })}
                      placeholder="Valor (€)"
                    />
                  </div>
                  <Button
                    onClick={handleAddDano}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Dano
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Extras e Observações */}
            <Card>
              <CardHeader>
                <CardTitle>Extras e Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Extras (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.extras}
                    onChange={(e) => setFormData({ ...formData, extras: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">Outros custos não categorizados</p>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações adicionais sobre este relatório..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Motorista</p>
                  <p className="font-semibold">
                    {motoristaInfo?.nome || 'Não selecionado'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600 mb-1">Período</p>
                  <p className="font-semibold">
                    Semana {formData.semana || '-'}/{formData.ano}
                  </p>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Ganhos Totais:</span>
                    <span className="font-bold text-green-600">€{totais.ganhosTotais.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Despesas Totais:</span>
                    <span className="font-bold text-red-600">€{totais.totalDespesas.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Total a Receber:</span>
                    <span className="text-xl font-bold text-blue-600">
                      €{totais.totalRecibo.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Button
                    onClick={() => handleSubmit('rascunho')}
                    variant="outline"
                    className="w-full"
                    disabled={salvando}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Rascunho
                  </Button>
                  <Button
                    onClick={() => handleSubmit('pendente_aprovacao')}
                    className="w-full"
                    disabled={salvando}
                  >
                    {salvando ? 'A criar...' : 'Criar e Enviar para Aprovação'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriarRelatorioManual;
