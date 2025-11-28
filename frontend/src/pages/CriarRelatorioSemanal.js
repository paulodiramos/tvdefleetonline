import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, DollarSign, TrendingUp, TrendingDown, Save, Send, AlertCircle } from 'lucide-react';

const CriarRelatorioSemanal = ({ user, onLogout }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [selectedMotorista, setSelectedMotorista] = useState('');
  const [selectedParceiro, setSelectedParceiro] = useState('');
  const [parceiroData, setParceiroData] = useState(null);
  const [saving, setSaving] = useState(false);

  const [relatorioData, setRelatorioData] = useState({
    periodo_inicio: '',
    periodo_fim: '',
    ganhos_uber: 0,
    ganhos_bolt: 0,
    total_combustivel: 0,
    total_via_verde: 0,
    km_efetuados: 0,
    horas_online: 0,
    numero_viagens: 0,
    valor_divida_anterior: 0,
    valor_caucao_semanal: 0,
    valor_caucao_acumulada: 0,
    valor_dano_veiculo_semanal: 0,
    valor_dano_veiculo_total: 0,
    notas: ''
  });

  const [despesasCombustivel, setDespesasCombustivel] = useState([]);
  const [despesasViaVerde, setDespesasViaVerde] = useState([]);
  const [extrasParceiro, setExtrasParceiro] = useState([]);

  // Modal states
  const [showCombustivelModal, setShowCombustivelModal] = useState(false);
  const [showViaVerdeModal, setShowViaVerdeModal] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);

  const [novaCombustivel, setNovaCombustivel] = useState({
    data: '',
    hora: '',
    valor: '',
    quantidade: '',
    local: ''
  });

  const [novaViaVerde, setNovaViaVerde] = useState({
    data: '',
    hora: '',
    valor: '',
    local: ''
  });

  const [novoExtra, setNovoExtra] = useState({
    tipo: 'dano',
    descricao: '',
    valor: ''
  });

  useEffect(() => {
    fetchMotoristas();
    fetchParceiros();
  }, []);

  useEffect(() => {
    if (selectedParceiro) {
      fetchParceiroData(selectedParceiro);
    }
  }, [selectedParceiro]);

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(response.data);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

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

  const fetchParceiroData = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiroData(response.data);
    } catch (error) {
      console.error('Error fetching parceiro:', error);
    }
  };

  const addCombustivel = () => {
    if (!novaCombustivel.data || !novaCombustivel.valor) {
      toast.error('Preencha data e valor');
      return;
    }

    setDespesasCombustivel([...despesasCombustivel, {
      ...novaCombustivel,
      valor: parseFloat(novaCombustivel.valor),
      quantidade: parseFloat(novaCombustivel.quantidade) || 0
    }]);

    setNovaCombustivel({ data: '', hora: '', valor: '', quantidade: '', local: '' });
    setShowCombustivelModal(false);
  };

  const addViaVerde = () => {
    if (!novaViaVerde.data || !novaViaVerde.valor) {
      toast.error('Preencha data e valor');
      return;
    }

    setDespesasViaVerde([...despesasViaVerde, {
      ...novaViaVerde,
      valor: parseFloat(novaViaVerde.valor)
    }]);

    setNovaViaVerde({ data: '', hora: '', valor: '', local: '' });
    setShowViaVerdeModal(false);
  };

  const addExtra = () => {
    if (!novoExtra.descricao || !novoExtra.valor) {
      toast.error('Preencha descrição e valor');
      return;
    }

    setExtrasParceiro([...extrasParceiro, {
      ...novoExtra,
      valor: parseFloat(novoExtra.valor)
    }]);

    setNovoExtra({ tipo: 'dano', descricao: '', valor: '' });
    setShowExtrasModal(false);
  };

  const calcularTotais = () => {
    const total_combustivel = despesasCombustivel.reduce((sum, d) => sum + d.valor, 0);
    const total_via_verde = despesasViaVerde.reduce((sum, d) => sum + d.valor, 0);
    const total_extras = extrasParceiro.reduce((sum, e) => sum + e.valor, 0);

    const valor_bruto = parseFloat(relatorioData.ganhos_uber) + parseFloat(relatorioData.ganhos_bolt);
    const valor_descontos = total_combustivel + total_via_verde + total_extras +
                            parseFloat(relatorioData.valor_divida_anterior) +
                            parseFloat(relatorioData.valor_caucao_semanal) +
                            parseFloat(relatorioData.valor_dano_veiculo_semanal);
    const valor_liquido = valor_bruto - valor_descontos;

    const media_por_viagem = relatorioData.numero_viagens > 0 
      ? valor_bruto / relatorioData.numero_viagens 
      : 0;
    const media_por_hora = relatorioData.horas_online > 0 
      ? valor_bruto / relatorioData.horas_online 
      : 0;

    return {
      total_combustivel,
      total_via_verde,
      total_extras,
      valor_bruto,
      valor_descontos,
      valor_liquido,
      media_por_viagem,
      media_por_hora
    };
  };

  const handleSubmit = async (enviar = false) => {
    if (!selectedMotorista || !selectedParceiro) {
      toast.error('Selecione motorista e parceiro');
      return;
    }

    if (!relatorioData.periodo_inicio || !relatorioData.periodo_fim) {
      toast.error('Preencha período início e fim');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais();

      const payload = {
        motorista_id: selectedMotorista,
        parceiro_id: selectedParceiro,
        periodo_inicio: relatorioData.periodo_inicio,
        periodo_fim: relatorioData.periodo_fim,
        ganhos_uber: parseFloat(relatorioData.ganhos_uber) || 0,
        ganhos_bolt: parseFloat(relatorioData.ganhos_bolt) || 0,
        despesas_combustivel: despesasCombustivel,
        total_combustivel: totais.total_combustivel,
        despesas_via_verde: despesasViaVerde,
        total_via_verde: totais.total_via_verde,
        km_efetuados: parseInt(relatorioData.km_efetuados) || 0,
        extras_parceiro: extrasParceiro,
        total_extras: totais.total_extras,
        valor_divida_anterior: parseFloat(relatorioData.valor_divida_anterior) || 0,
        valor_caucao_semanal: parseFloat(relatorioData.valor_caucao_semanal) || 0,
        valor_caucao_acumulada: (parseFloat(relatorioData.valor_caucao_acumulada) || 0) + (parseFloat(relatorioData.valor_caucao_semanal) || 0),
        valor_dano_veiculo_semanal: parseFloat(relatorioData.valor_dano_veiculo_semanal) || 0,
        valor_dano_veiculo_total: (parseFloat(relatorioData.valor_dano_veiculo_total) || 0) + (parseFloat(relatorioData.valor_dano_veiculo_semanal) || 0),
        horas_online: parseFloat(relatorioData.horas_online) || 0,
        numero_viagens: parseInt(relatorioData.numero_viagens) || 0,
        media_por_viagem: totais.media_por_viagem,
        media_por_hora: totais.media_por_hora,
        valor_bruto: totais.valor_bruto,
        valor_descontos: totais.valor_descontos,
        valor_liquido: totais.valor_liquido,
        parceiro_nome: parceiroData?.nome_empresa || parceiroData?.name,
        parceiro_nif: parceiroData?.nif,
        parceiro_morada: parceiroData?.morada,
        notas: relatorioData.notas,
        detalhes: {}
      };

      const response = await axios.post(`${API}/relatorios-ganhos`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Relatório criado com sucesso!');

      if (enviar) {
        // Generate receipt
        await axios.post(
          `${API}/relatorios-ganhos/${response.data.relatorio_id}/gerar-recibo`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Recibo gerado e enviado ao motorista!');
      }

      // Reset form
      setSelectedMotorista('');
      setSelectedParceiro('');
      setRelatorioData({
        periodo_inicio: '',
        periodo_fim: '',
        ganhos_uber: 0,
        ganhos_bolt: 0,
        total_combustivel: 0,
        total_via_verde: 0,
        km_efetuados: 0,
        horas_online: 0,
        numero_viagens: 0,
        valor_divida_anterior: 0,
        valor_caucao_semanal: 0,
        valor_dano_veiculo_semanal: 0,
        notas: ''
      });
      setDespesasCombustivel([]);
      setDespesasViaVerde([]);
      setExtrasParceiro([]);

    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Erro ao criar relatório');
    } finally {
      setSaving(false);
    }
  };

  const totais = calcularTotais();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Criar Relatório Semanal</h1>
          <p className="text-slate-600 mt-2">Criar relatório de ganhos e despesas para motorista</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selection */}
            <Card>
              <CardHeader>
                <CardTitle>1. Seleção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Motorista *</Label>
                    <Select value={selectedMotorista} onValueChange={setSelectedMotorista}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar motorista" />
                      </SelectTrigger>
                      <SelectContent>
                        {motoristas.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Parceiro *</Label>
                    <Select value={selectedParceiro} onValueChange={setSelectedParceiro}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar parceiro" />
                      </SelectTrigger>
                      <SelectContent>
                        {parceiros.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome_empresa || p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Período Início *</Label>
                    <Input
                      type="date"
                      value={relatorioData.periodo_inicio}
                      onChange={(e) => setRelatorioData({...relatorioData, periodo_inicio: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label>Período Fim *</Label>
                    <Input
                      type="date"
                      value={relatorioData.periodo_fim}
                      onChange={(e) => setRelatorioData({...relatorioData, periodo_fim: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ganhos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-600">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  2. Ganhos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ganhos Uber (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.ganhos_uber}
                      onChange={(e) => setRelatorioData({...relatorioData, ganhos_uber: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Ganhos Bolt (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.ganhos_bolt}
                      onChange={(e) => setRelatorioData({...relatorioData, ganhos_bolt: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Despesas Combustível */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center text-red-600">
                  <TrendingDown className="w-5 h-5 mr-2" />
                  3. Combustível
                </CardTitle>
                <Button size="sm" onClick={() => setShowCombustivelModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent>
                {despesasCombustivel.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Nenhuma despesa adicionada</p>
                ) : (
                  <div className="space-y-2">
                    {despesasCombustivel.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div>
                          <p className="text-sm font-semibold">{d.data} {d.hora} - €{d.valor.toFixed(2)}</p>
                          <p className="text-xs text-slate-600">{d.quantidade}L - {d.local}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDespesasCombustivel(despesasCombustivel.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Despesas Via Verde */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center text-orange-600">
                  <TrendingDown className="w-5 h-5 mr-2" />
                  3. Via Verde
                </CardTitle>
                <Button size="sm" onClick={() => setShowViaVerdeModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent>
                {despesasViaVerde.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Nenhuma despesa adicionada</p>
                ) : (
                  <div className="space-y-2">
                    {despesasViaVerde.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div>
                          <p className="text-sm font-semibold">{d.data} {d.hora} - €{d.valor.toFixed(2)}</p>
                          <p className="text-xs text-slate-600">{d.local}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDespesasViaVerde(despesasViaVerde.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Extras do Parceiro */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center text-purple-600">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  4. Extras e Deduções
                </CardTitle>
                <Button size="sm" onClick={() => setShowExtrasModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent>
                {extrasParceiro.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Nenhum extra adicionado</p>
                ) : (
                  <div className="space-y-2">
                    {extrasParceiro.map((e, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div>
                          <p className="text-sm font-semibold capitalize">{e.tipo}: €{e.valor.toFixed(2)}</p>
                          <p className="text-xs text-slate-600">{e.descricao}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExtrasParceiro(extrasParceiro.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outras Informações */}
            <Card>
              <CardHeader>
                <CardTitle>5. Estatísticas e Deduções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>KM Efetuados</Label>
                    <Input
                      type="number"
                      value={relatorioData.km_efetuados}
                      onChange={(e) => setRelatorioData({...relatorioData, km_efetuados: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Horas Online</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={relatorioData.horas_online}
                      onChange={(e) => setRelatorioData({...relatorioData, horas_online: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Número de Viagens</Label>
                    <Input
                      type="number"
                      value={relatorioData.numero_viagens}
                      onChange={(e) => setRelatorioData({...relatorioData, numero_viagens: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Dívida Anterior (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.valor_divida_anterior}
                      onChange={(e) => setRelatorioData({...relatorioData, valor_divida_anterior: e.target.value})}
                    />
                  </div>
                </div>

                <hr className="my-4" />
                <p className="text-sm font-semibold text-slate-700 mb-3">Valores Acumulados</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Caução Semanal (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.valor_caucao_semanal}
                      onChange={(e) => setRelatorioData({...relatorioData, valor_caucao_semanal: e.target.value})}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Total acumulado: €{((parseFloat(relatorioData.valor_caucao_acumulada) || 0) + (parseFloat(relatorioData.valor_caucao_semanal) || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label>Dano Veículo Semanal (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.valor_dano_veiculo_semanal}
                      onChange={(e) => setRelatorioData({...relatorioData, valor_dano_veiculo_semanal: e.target.value})}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Total acumulado: €{((parseFloat(relatorioData.valor_dano_veiculo_total) || 0) + (parseFloat(relatorioData.valor_dano_veiculo_semanal) || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label>Caução Acumulada Anterior (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.valor_caucao_acumulada}
                      onChange={(e) => setRelatorioData({...relatorioData, valor_caucao_acumulada: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Dano Acumulado Anterior (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioData.valor_dano_veiculo_total}
                      onChange={(e) => setRelatorioData({...relatorioData, valor_dano_veiculo_total: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Notas/Observações</Label>
                  <Textarea
                    value={relatorioData.notas}
                    onChange={(e) => setRelatorioData({...relatorioData, notas: e.target.value})}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Valor Bruto:</span>
                  <span className="font-semibold text-green-600">€{totais.valor_bruto.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Descontos:</span>
                  <span className="font-semibold text-red-600">-€{totais.valor_descontos.toFixed(2)}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="font-bold">Valor Líquido:</span>
                  <span className="font-bold text-lg text-blue-600">€{totais.valor_liquido.toFixed(2)}</span>
                </div>

                <hr className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Média/Viagem:</span>
                    <span>€{totais.media_por_viagem.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Média/Hora:</span>
                    <span>€{totais.media_por_hora.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={saving}
                    className="w-full"
                    variant="outline"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'A guardar...' : 'Guardar Rascunho'}
                  </Button>
                  <Button
                    onClick={() => handleSubmit(true)}
                    disabled={saving}
                    className="w-full"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {saving ? 'A enviar...' : 'Gerar e Enviar Recibo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modals */}
        <Dialog open={showCombustivelModal} onOpenChange={setShowCombustivelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Despesa de Combustível</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={novaCombustivel.data}
                    onChange={(e) => setNovaCombustivel({...novaCombustivel, data: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={novaCombustivel.hora}
                    onChange={(e) => setNovaCombustivel({...novaCombustivel, hora: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novaCombustivel.valor}
                    onChange={(e) => setNovaCombustivel({...novaCombustivel, valor: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Quantidade (L)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novaCombustivel.quantidade}
                    onChange={(e) => setNovaCombustivel({...novaCombustivel, quantidade: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label>Local</Label>
                <Input
                  value={novaCombustivel.local}
                  onChange={(e) => setNovaCombustivel({...novaCombustivel, local: e.target.value})}
                  placeholder="Ex: Galp Alameda"
                />
              </div>
              <Button onClick={addCombustivel} className="w-full">
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Via Verde */}
        <Dialog open={showViaVerdeModal} onOpenChange={setShowViaVerdeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Despesa de Via Verde</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={novaViaVerde.data}
                    onChange={(e) => setNovaViaVerde({...novaViaVerde, data: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={novaViaVerde.hora}
                    onChange={(e) => setNovaViaVerde({...novaViaVerde, hora: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label>Valor (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaViaVerde.valor}
                  onChange={(e) => setNovaViaVerde({...novaViaVerde, valor: e.target.value})}
                />
              </div>
              <div>
                <Label>Local</Label>
                <Input
                  value={novaViaVerde.local}
                  onChange={(e) => setNovaViaVerde({...novaViaVerde, local: e.target.value})}
                  placeholder="Ex: A1 Norte"
                />
              </div>
              <Button onClick={addViaVerde} className="w-full">
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Extras */}
        <Dialog open={showExtrasModal} onOpenChange={setShowExtrasModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Extra/Dedução</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo *</Label>
                <select
                  value={novoExtra.tipo}
                  onChange={(e) => setNovoExtra({...novoExtra, tipo: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="dano">Dano</option>
                  <option value="multa">Multa</option>
                  <option value="penalizacao">Penalização</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={novoExtra.descricao}
                  onChange={(e) => setNovoExtra({...novoExtra, descricao: e.target.value})}
                  placeholder="Descrição do extra"
                />
              </div>
              <div>
                <Label>Valor (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novoExtra.valor}
                  onChange={(e) => setNovoExtra({...novoExtra, valor: e.target.value})}
                />
              </div>
              <Button onClick={addExtra} className="w-full">
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CriarRelatorioSemanal;
