import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, User, Car, Building, Calendar, Euro, Percent, Download, Check } from 'lucide-react';

const TIPOS_CONTRATO = [
  { value: 'aluguer_sem_caucao', label: 'Aluguer sem Caução' },
  { value: 'aluguer_com_caucao', label: 'Aluguer com Caução' },
  { value: 'aluguer_caucao_parcelada', label: 'Aluguer com Caução Parcelada' },
  { value: 'periodo_epoca', label: 'Período de Época' },
  { value: 'aluguer_epocas_sem_caucao', label: 'Aluguer com Épocas sem Caução' },
  { value: 'aluguer_epocas_caucao', label: 'Aluguer com Épocas e Caução' },
  { value: 'aluguer_epoca_caucao_parcelada', label: 'Aluguer Época com Caução Parcelada' },
  { value: 'compra_veiculo', label: 'Compra de Veículo' },
  { value: 'comissao', label: 'Comissão' },
  { value: 'motorista_privado', label: 'Motorista Privado' },
  { value: 'outros', label: 'Outros' }
];

const CriarContrato = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  
  const [parceiroSelecionado, setParceiroSelecionado] = useState('');
  const [parceiroData, setParceiroData] = useState(null);
  const [tipoContratoSelecionado, setTipoContratoSelecionado] = useState('');
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  
  const [veiculoData, setVeiculoData] = useState(null);
  const [tipoContrato, setTipoContrato] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [contratoGerado, setContratoGerado] = useState(null);

  // Form data para valores editáveis
  const [formData, setFormData] = useState({
    periodicidade: 'semanal',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    valor_aplicado: '',
    valor_caucao_aplicado: '',
    numero_parcelas_caucao_aplicado: '',
    epoca_atual: 'baixa',
    valor_epoca_alta_aplicado: '',
    valor_epoca_baixa_aplicado: '',
    percentagem_motorista_aplicado: '',
    percentagem_parceiro_aplicado: '',
    combustivel_incluido_aplicado: false,
    regime_trabalho_aplicado: 'full_time',
    valor_compra_aplicado: '',
    numero_semanas_aplicado: '',
    com_slot_aplicado: false,
    extra_seguro_aplicado: false,
    valor_extra_seguro_aplicado: ''
  });

  useEffect(() => {
    fetchParceiros();
  }, []);

  useEffect(() => {
    if (parceiroSelecionado) {
      fetchTemplates(parceiroSelecionado);
      fetchMotoristas(parceiroSelecionado);
      fetchVeiculos(parceiroSelecionado);
    }
  }, [parceiroSelecionado]);

  useEffect(() => {
    if (templateSelecionado) {
      const template = templates.find(t => t.id === templateSelecionado);
      setTemplateData(template);
      
      // Pre-fill com valores do template
      setFormData(prev => ({
        ...prev,
        periodicidade: template.periodicidade_padrao,
        valor_aplicado: template.valor_base || '',
        valor_caucao_aplicado: template.valor_caucao || '',
        numero_parcelas_caucao_aplicado: template.numero_parcelas_caucao || '',
        valor_epoca_alta_aplicado: template.valor_epoca_alta || '',
        valor_epoca_baixa_aplicado: template.valor_epoca_baixa || '',
        percentagem_motorista_aplicado: template.percentagem_motorista || '',
        percentagem_parceiro_aplicado: template.percentagem_parceiro || '',
        combustivel_incluido_aplicado: template.combustivel_incluido || false,
        regime_trabalho_aplicado: template.regime_trabalho || 'full_time',
        valor_compra_aplicado: template.valor_compra_veiculo || '',
        numero_semanas_aplicado: template.numero_semanas_compra || '',
        com_slot_aplicado: template.com_slot || false,
        extra_seguro_aplicado: template.extra_seguro || false,
        valor_extra_seguro_aplicado: template.valor_extra_seguro || ''
      }));
      
      setTipoContrato(template.tipo_contrato);
    }
  }, [templateSelecionado, templates]);

  useEffect(() => {
    if (veiculoSelecionado && veiculoSelecionado !== null) {
      const veiculo = veiculos.find(v => v.id === veiculoSelecionado);
      setVeiculoData(veiculo);
      
      // Se o veículo tem tipo_contrato configurado, usar esse
      if (veiculo?.tipo_contrato?.tipo) {
        const tipoVeiculo = veiculo.tipo_contrato.tipo;
        setTipoContrato(tipoVeiculo);
        
        // Pre-fill com dados do veículo
        if (tipoVeiculo === 'aluguer' || tipoVeiculo.includes('aluguer')) {
          setFormData(prev => ({
            ...prev,
            valor_aplicado: veiculo.tipo_contrato.valor_aluguer || prev.valor_aplicado
          }));
        }
        
        if (tipoVeiculo === 'comissao') {
          setFormData(prev => ({
            ...prev,
            percentagem_motorista_aplicado: veiculo.tipo_contrato.comissao_motorista || prev.percentagem_motorista_aplicado,
            percentagem_parceiro_aplicado: veiculo.tipo_contrato.comissao_parceiro || prev.percentagem_parceiro_aplicado,
            combustivel_incluido_aplicado: veiculo.tipo_contrato.inclui_combustivel || false,
            regime_trabalho_aplicado: veiculo.tipo_contrato.regime || 'full_time'
          }));
        }
        
        // Caução do veículo
        if (veiculo.caucao?.caucao_total) {
          setFormData(prev => ({
            ...prev,
            valor_caucao_aplicado: veiculo.caucao.caucao_total,
            numero_parcelas_caucao_aplicado: veiculo.caucao.caucao_parcelas || ''
          }));
        }
      }
    }
  }, [veiculoSelecionado, veiculos]);

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
    }
  };

  const fetchTemplates = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${parceiroId}/templates-contrato`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.filter(t => t.ativo));
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchMotoristas = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filtered = response.data.filter(m => m.parceiro_atribuido === parceiroId);
      setMotoristas(filtered);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const fetchVeiculos = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filtered = response.data.filter(v => v.parceiro_id === parceiroId);
      setVeiculos(filtered);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!templateSelecionado || !motoristaSelecionado) {
      toast.error('Selecione template e motorista');
      return;
    }

    // Validações
    if (tipoContrato === 'comissao') {
      const total = parseFloat(formData.percentagem_motorista_aplicado || 0) + 
                    parseFloat(formData.percentagem_parceiro_aplicado || 0);
      if (total !== 100) {
        toast.error('Percentagens devem somar 100%');
        return;
      }
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        template_id: templateSelecionado,
        motorista_id: motoristaSelecionado,
        veiculo_id: veiculoSelecionado && veiculoSelecionado !== null ? veiculoSelecionado : null,
        periodicidade: formData.periodicidade,
        valor_aplicado: parseFloat(formData.valor_aplicado),
        valor_caucao_aplicado: formData.valor_caucao_aplicado ? parseFloat(formData.valor_caucao_aplicado) : null,
        numero_parcelas_caucao_aplicado: formData.numero_parcelas_caucao_aplicado ? parseInt(formData.numero_parcelas_caucao_aplicado) : null,
        epoca_atual: formData.epoca_atual || null,
        valor_epoca_alta_aplicado: formData.valor_epoca_alta_aplicado ? parseFloat(formData.valor_epoca_alta_aplicado) : null,
        valor_epoca_baixa_aplicado: formData.valor_epoca_baixa_aplicado ? parseFloat(formData.valor_epoca_baixa_aplicado) : null,
        percentagem_motorista_aplicado: formData.percentagem_motorista_aplicado ? parseFloat(formData.percentagem_motorista_aplicado) : null,
        percentagem_parceiro_aplicado: formData.percentagem_parceiro_aplicado ? parseFloat(formData.percentagem_parceiro_aplicado) : null,
        combustivel_incluido_aplicado: formData.combustivel_incluido_aplicado,
        regime_trabalho_aplicado: formData.regime_trabalho_aplicado || null,
        valor_compra_aplicado: formData.valor_compra_aplicado ? parseFloat(formData.valor_compra_aplicado) : null,
        numero_semanas_aplicado: formData.numero_semanas_aplicado ? parseInt(formData.numero_semanas_aplicado) : null,
        com_slot_aplicado: formData.com_slot_aplicado,
        extra_seguro_aplicado: formData.extra_seguro_aplicado,
        valor_extra_seguro_aplicado: formData.valor_extra_seguro_aplicado ? parseFloat(formData.valor_extra_seguro_aplicado) : null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null
      };

      const response = await axios.post(`${API}/contratos`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Contrato criado com sucesso!');
      setContratoGerado(response.data);
      
      // Gerar PDF automaticamente
      await gerarPDF(response.data.id);
      
    } catch (error) {
      console.error('Error creating contract:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar contrato');
    } finally {
      setLoading(false);
    }
  };

  const gerarPDF = async (contratoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/contratos/${contratoId}/gerar-pdf`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('PDF gerado com sucesso!');
      
      // Update contrato with PDF URL
      setContratoGerado(prev => ({
        ...prev,
        pdf_url: response.data.pdf_url
      }));
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const downloadPDF = () => {
    if (contratoGerado?.pdf_url) {
      window.open(`${API}${contratoGerado.pdf_url}`, '_blank');
    }
  };

  const needsCaucao = () => {
    return ['aluguer_com_caucao', 'aluguer_caucao_parcelada', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(tipoContrato);
  };

  const needsCaucaoParcelada = () => {
    return ['aluguer_caucao_parcelada', 'aluguer_epoca_caucao_parcelada'].includes(tipoContrato);
  };

  const needsEpocas = () => {
    return ['periodo_epoca', 'aluguer_epocas_sem_caucao', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(tipoContrato);
  };

  const needsComissao = () => {
    return tipoContrato === 'comissao';
  };

  const needsCompraVeiculo = () => {
    return tipoContrato === 'compra_veiculo';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerar Contrato de Motorista</h1>
          <p className="text-slate-600 mt-2">
            Selecione o template e preencha os dados para gerar o contrato
          </p>
        </div>

        {contratoGerado ? (
          /* Contrato Gerado com Sucesso */
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center text-green-700">
                <Check className="w-6 h-6 mr-2" />
                Contrato Gerado com Sucesso!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">ID do Contrato:</p>
                  <p className="font-semibold">{contratoGerado.id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Tipo:</p>
                  <p className="font-semibold">
                    {TIPOS_CONTRATO.find(t => t.value === contratoGerado.tipo_contrato)?.label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Data Início:</p>
                  <p className="font-semibold">{contratoGerado.data_inicio}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Valor:</p>
                  <p className="font-semibold">€{contratoGerado.valor_aplicado}</p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                {contratoGerado.pdf_url && (
                  <Button onClick={downloadPDF}>
                    <Download className="w-4 h-4 mr-2" />
                    Descarregar PDF
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  setContratoGerado(null);
                  setTemplateSelecionado('');
                  setMotoristaSelecionado('');
                  setVeiculoSelecionado(null);
                }}>
                  Criar Outro Contrato
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção: Parceiro, Template, Motorista, Veículo */}
            <Card>
              <CardHeader>
                <CardTitle>1. Seleção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Parceiro */}
                  <div>
                    <Label htmlFor="parceiro">Parceiro *</Label>
                    <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o parceiro" />
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

                  {/* Template */}
                  <div>
                    <Label htmlFor="template">Template de Contrato *</Label>
                    <Select 
                      value={templateSelecionado} 
                      onValueChange={setTemplateSelecionado}
                      disabled={!parceiroSelecionado || templates.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome_template} ({TIPOS_CONTRATO.find(tipo => tipo.value === t.tipo_contrato)?.label})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parceiroSelecionado && templates.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Nenhum template criado para este parceiro
                      </p>
                    )}
                  </div>

                  {/* Motorista */}
                  <div>
                    <Label htmlFor="motorista">Motorista *</Label>
                    <Select 
                      value={motoristaSelecionado} 
                      onValueChange={setMotoristaSelecionado}
                      disabled={!parceiroSelecionado || motoristas.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motorista" />
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

                  {/* Veículo */}
                  <div>
                    <Label htmlFor="veiculo">Veículo (opcional)</Label>
                    <Select 
                      value={veiculoSelecionado} 
                      onValueChange={setVeiculoSelecionado}
                      disabled={!parceiroSelecionado || veiculos.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum veículo selecionado" />
                      </SelectTrigger>
                      <SelectContent>
                        {veiculos.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.matricula} - {v.marca} {v.modelo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {veiculoSelecionado && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setVeiculoSelecionado('')}
                        className="mt-1 text-xs"
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tipo de Contrato (exibido após seleção) */}
                {tipoContrato && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900">Tipo de Contrato:</p>
                    <p className="text-lg font-bold text-blue-700">
                      {TIPOS_CONTRATO.find(t => t.value === tipoContrato)?.label}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campos Dinâmicos (aparecem após selecionar template) */}
            {templateSelecionado && (
              <>
                {/* Periodicidade e Datas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="w-5 h-5 mr-2" />
                      2. Periodicidade e Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="periodicidade">Periodicidade *</Label>
                        <Select 
                          value={formData.periodicidade} 
                          onValueChange={(value) => setFormData({...formData, periodicidade: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semanal">Semanal</SelectItem>
                            <SelectItem value="mensal">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="data_inicio">Data Início *</Label>
                        <Input
                          id="data_inicio"
                          type="date"
                          value={formData.data_inicio}
                          onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="data_fim">Data Fim (opcional)</Label>
                        <Input
                          id="data_fim"
                          type="date"
                          value={formData.data_fim}
                          onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Valores Base */}
                {!needsCompraVeiculo() && !needsComissao() && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Euro className="w-5 h-5 mr-2" />
                        3. Valor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="valor_aplicado">
                            Valor {formData.periodicidade === 'semanal' ? 'Semanal' : 'Mensal'} (€) *
                          </Label>
                          <Input
                            id="valor_aplicado"
                            type="number"
                            step="0.01"
                            value={formData.valor_aplicado}
                            onChange={(e) => setFormData({...formData, valor_aplicado: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Caução */}
                {needsCaucao() && (
                  <Card className="bg-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Euro className="w-5 h-5 mr-2" />
                        4. Caução
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="valor_caucao">Valor da Caução (€)</Label>
                          <Input
                            id="valor_caucao"
                            type="number"
                            step="0.01"
                            value={formData.valor_caucao_aplicado}
                            onChange={(e) => setFormData({...formData, valor_caucao_aplicado: e.target.value})}
                          />
                        </div>
                        {needsCaucaoParcelada() && (
                          <div>
                            <Label htmlFor="numero_parcelas">Número de Parcelas</Label>
                            <Input
                              id="numero_parcelas"
                              type="number"
                              value={formData.numero_parcelas_caucao_aplicado}
                              onChange={(e) => setFormData({...formData, numero_parcelas_caucao_aplicado: e.target.value})}
                            />
                            {formData.valor_caucao_aplicado && formData.numero_parcelas_caucao_aplicado && (
                              <p className="text-sm text-slate-600 mt-1">
                                Valor por parcela: €{(parseFloat(formData.valor_caucao_aplicado) / parseInt(formData.numero_parcelas_caucao_aplicado)).toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Épocas */}
                {needsEpocas() && (
                  <Card className="bg-amber-50">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Calendar className="w-5 h-5 mr-2" />
                        5. Épocas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label htmlFor="epoca_atual">Época Atual *</Label>
                        <Select 
                          value={formData.epoca_atual} 
                          onValueChange={(value) => setFormData({...formData, epoca_atual: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alta">Época Alta</SelectItem>
                            <SelectItem value="baixa">Época Baixa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="valor_epoca_alta">Valor Época Alta (€)</Label>
                          <Input
                            id="valor_epoca_alta"
                            type="number"
                            step="0.01"
                            value={formData.valor_epoca_alta_aplicado}
                            onChange={(e) => setFormData({...formData, valor_epoca_alta_aplicado: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="valor_epoca_baixa">Valor Época Baixa (€)</Label>
                          <Input
                            id="valor_epoca_baixa"
                            type="number"
                            step="0.01"
                            value={formData.valor_epoca_baixa_aplicado}
                            onChange={(e) => setFormData({...formData, valor_epoca_baixa_aplicado: e.target.value})}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Comissão */}
                {needsComissao() && (
                  <Card className="bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Percent className="w-5 h-5 mr-2" />
                        6. Comissão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="perc_motorista">% Motorista *</Label>
                          <Input
                            id="perc_motorista"
                            type="number"
                            step="0.01"
                            value={formData.percentagem_motorista_aplicado}
                            onChange={(e) => setFormData({...formData, percentagem_motorista_aplicado: e.target.value})}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="perc_parceiro">% Parceiro *</Label>
                          <Input
                            id="perc_parceiro"
                            type="number"
                            step="0.01"
                            value={formData.percentagem_parceiro_aplicado}
                            onChange={(e) => setFormData({...formData, percentagem_parceiro_aplicado: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="combustivel_incluido"
                            checked={formData.combustivel_incluido_aplicado}
                            onChange={(e) => setFormData({...formData, combustivel_incluido_aplicado: e.target.checked})}
                            className="rounded"
                          />
                          <Label htmlFor="combustivel_incluido" className="cursor-pointer">
                            Combustível Incluído
                          </Label>
                        </div>
                        <div>
                          <Label htmlFor="regime">Regime *</Label>
                          <Select 
                            value={formData.regime_trabalho_aplicado} 
                            onValueChange={(value) => setFormData({...formData, regime_trabalho_aplicado: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">Full Time</SelectItem>
                              <SelectItem value="part_time">Part Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Compra de Veículo */}
                {needsCompraVeiculo() && (
                  <Card className="bg-purple-50">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Car className="w-5 h-5 mr-2" />
                        7. Compra de Veículo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="valor_compra">Valor de Compra (€) *</Label>
                          <Input
                            id="valor_compra"
                            type="number"
                            step="0.01"
                            value={formData.valor_compra_aplicado}
                            onChange={(e) => setFormData({...formData, valor_compra_aplicado: e.target.value})}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="numero_semanas">Número de Semanas *</Label>
                          <Input
                            id="numero_semanas"
                            type="number"
                            value={formData.numero_semanas_aplicado}
                            onChange={(e) => setFormData({...formData, numero_semanas_aplicado: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="com_slot"
                            checked={formData.com_slot_aplicado}
                            onChange={(e) => setFormData({...formData, com_slot_aplicado: e.target.checked})}
                            className="rounded"
                          />
                          <Label htmlFor="com_slot" className="cursor-pointer">Com Slot</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="extra_seguro"
                            checked={formData.extra_seguro_aplicado}
                            onChange={(e) => setFormData({...formData, extra_seguro_aplicado: e.target.checked})}
                            className="rounded"
                          />
                          <Label htmlFor="extra_seguro" className="cursor-pointer">Extra Seguro</Label>
                        </div>
                        {formData.extra_seguro_aplicado && (
                          <div>
                            <Label htmlFor="valor_extra_seguro">Valor (€)</Label>
                            <Input
                              id="valor_extra_seguro"
                              type="number"
                              step="0.01"
                              value={formData.valor_extra_seguro_aplicado}
                              onChange={(e) => setFormData({...formData, valor_extra_seguro_aplicado: e.target.value})}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Botão Gerar */}
                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    <FileText className="w-4 h-4 mr-2" />
                    {loading ? 'Gerando...' : 'Gerar Contrato'}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </Layout>
  );
};

export default CriarContrato;
