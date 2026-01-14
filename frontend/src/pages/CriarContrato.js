import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { FileText, User, Car, Building, Calendar, Euro, Percent, Download, Check, AlertTriangle, Edit } from 'lucide-react';

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
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [tipoContratoSelecionado, setTipoContratoSelecionado] = useState('');
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  
  const [veiculoData, setVeiculoData] = useState(null);
  const [tipoContrato, setTipoContrato] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [contratoGerado, setContratoGerado] = useState(null);
  
  const [permitirAlterarCondicoes, setPermitirAlterarCondicoes] = useState(false);
  const [showConfirmacaoAlteracao, setShowConfirmacaoAlteracao] = useState(false);
  const [veiculoTemCondicoesPredefinidas, setVeiculoTemCondicoesPredefinidas] = useState(false);

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
    if (user && user.id) {
      fetchParceiros();
    }
  }, [user]);

  useEffect(() => {
    if (parceiroSelecionado) {
      fetchParceiroData(parceiroSelecionado);
      fetchMotoristas(parceiroSelecionado);
      fetchVeiculos(parceiroSelecionado);
      fetchTemplates(parceiroSelecionado);
    } else {
      setTemplates([]);
      setTipoContratoSelecionado('');
    }
  }, [parceiroSelecionado]);

  useEffect(() => {
    if (tipoContratoSelecionado && templates.length > 0) {
      const template = templates.find(t => t.id === tipoContratoSelecionado);
      if (template) {
        // Set template selecionado
        setTemplateSelecionado(template.id);
        
        // Pre-fill com valores do template
        setFormData(prev => ({
          ...prev,
          periodicidade: template.periodicidade_padrao || 'semanal',
          valor_aplicado: template.valor_base || '',
          valor_caucao_aplicado: template.valor_caucao || '',
          numero_parcelas_caucao_aplicado: template.numero_parcelas_caucao || '',
          percentagem_motorista_aplicado: template.percentagem_motorista || '',
          percentagem_parceiro_aplicado: template.percentagem_parceiro || ''
        }));
        
        setTipoContrato(template.tipo_contrato);
      }
    } else {
      setTemplateSelecionado('');
    }
  }, [tipoContratoSelecionado, templates]);

  useEffect(() => {
    if (veiculoSelecionado && veiculoSelecionado !== null) {
      const veiculo = veiculos.find(v => v.id === veiculoSelecionado);
      setVeiculoData(veiculo);
      
      // Verificar se veículo tem condições pré-definidas
      const temCondicoes = veiculo?.tipo_contrato?.tipo || veiculo?.tipo_exploracao;
      setVeiculoTemCondicoesPredefinidas(!!temCondicoes);
      setPermitirAlterarCondicoes(false); // Reset ao trocar de veículo
      
      // Se o veículo tem tipo_contrato configurado, usar esse
      if (veiculo?.tipo_contrato?.tipo) {
        const tipoVeiculo = veiculo.tipo_contrato.tipo;
        setTipoContrato(tipoVeiculo);
        
        // Determinar qual template usar baseado no tipo do veículo
        let templateMatch = null;
        if (tipoVeiculo === 'comissao') {
          templateMatch = templates.find(t => t.tipo_contrato === 'comissao');
        } else if (tipoVeiculo === 'aluguer' || tipoVeiculo.includes('aluguer')) {
          // Tentar encontrar template de aluguer mais apropriado
          templateMatch = templates.find(t => 
            t.tipo_contrato.includes('aluguer') || 
            t.tipo_contrato === 'aluguer_sem_caucao'
          );
        }
        
        // Se encontrou template compatível, selecionar automaticamente
        if (templateMatch) {
          setTipoContratoSelecionado(templateMatch.id);
          toast.info(`Template "${templateMatch.nome_template}" selecionado automaticamente baseado no veículo`);
        }
        
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
    } else {
      setVeiculoTemCondicoesPredefinidas(false);
      setPermitirAlterarCondicoes(false);
    }
  }, [veiculoSelecionado, veiculos, templates]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      
      // Se for parceiro, pré-selecionar automaticamente usando user.id (mais confiável)
      if (user.role === 'parceiro') {
        // O user.id do parceiro é o mesmo que parceiro_id
        setParceiroSelecionado(user.id);
      } else if (response.data.length > 0) {
        // Para admin/gestao, selecionar o primeiro
        setParceiroSelecionado(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching parceiros:', error);
      toast.error('Erro ao carregar parceiros');
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
      console.error('Error fetching parceiro data:', error);
      toast.error('Erro ao carregar dados do parceiro');
    }
  };

  const fetchTemplates = async (parceiroId) => {
    console.log('🔍 fetchTemplates called with parceiroId:', parceiroId);
    try {
      const token = localStorage.getItem('token');
      const url = `${API}/parceiros/${parceiroId}/templates-contrato`;
      console.log('🔍 Fetching templates from:', url);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('🔍 Templates response:', response.data);
      
      // Ensure response.data is an array
      if (Array.isArray(response.data)) {
        setTemplates(response.data);
        console.log('🔍 Templates set successfully, count:', response.data.length);
      } else {
        console.warn('Expected array but got:', typeof response.data);
        setTemplates([]);
      }
    } catch (error) {
      console.error('❌ Error fetching templates:', error.response?.data || error.message);
      setTemplates([]);
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
    
    if (!tipoContratoSelecionado || !motoristaSelecionado) {
      toast.error('Selecione tipo de contrato e motorista');
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
      
      // O tipoContratoSelecionado já é o template_id
      if (!tipoContratoSelecionado) {
        toast.error('Selecione um template de contrato');
        setLoading(false);
        return;
      }
      
      const payload = {
        template_id: tipoContratoSelecionado,
        motorista_id: motoristaSelecionado,
        veiculo_id: veiculoSelecionado || null,
        periodicidade: formData.periodicidade || 'semanal',
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        valor_aplicado: parseFloat(formData.valor_aplicado) || 0,
        valor_caucao_aplicado: formData.valor_caucao_aplicado ? parseFloat(formData.valor_caucao_aplicado) : 0,
        numero_parcelas_caucao_aplicado: formData.numero_parcelas_caucao_aplicado ? parseInt(formData.numero_parcelas_caucao_aplicado) : null,
        percentagem_motorista_aplicado: formData.percentagem_motorista_aplicado ? parseFloat(formData.percentagem_motorista_aplicado) : null,
        percentagem_parceiro_aplicado: formData.percentagem_parceiro_aplicado ? parseFloat(formData.percentagem_parceiro_aplicado) : null
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
      
      // Handle validation errors (422 status)
      let errorMessage = 'Erro ao criar contrato';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        // If detail is an array of validation errors
        if (Array.isArray(detail)) {
          errorMessage = detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'campo';
            return `${field}: ${err.msg}`;
          }).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else {
          errorMessage = JSON.stringify(detail);
        }
      }
      
      toast.error(errorMessage);
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

  const downloadPDF = async () => {
    if (!contratoGerado?.pdf_url) {
      toast.error('PDF não disponível');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Construct full URL
      let pdfUrl = contratoGerado.pdf_url;
      if (!pdfUrl.startsWith('http')) {
        // It's a relative path
        const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
        pdfUrl = `${backendUrl}${pdfUrl.startsWith('/') ? pdfUrl : '/' + pdfUrl}`;
      }
      
      const response = await fetch(pdfUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contratoGerado.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download concluído!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error(`Erro ao fazer download: ${error.message}`);
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
                  setTipoContratoSelecionado('');
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
                  {/* Parceiro - Fixo para parceiro logado */}
                  <div>
                    <Label htmlFor="parceiro">Parceiro *</Label>
                    {user.role === 'parceiro' ? (
                      <div className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-700">
                          {parceiros.length > 0 ? (parceiros[0].nome_empresa || parceiros[0].name) : 'A carregar...'}
                        </span>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Template de Contrato */}
                  <div>
                    <Label htmlFor="template-contrato">Template de Contrato *</Label>
                    <Select 
                      value={tipoContratoSelecionado} 
                      onValueChange={setTipoContratoSelecionado}
                      disabled={!parceiroSelecionado || templates.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o template de contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.nome_template} - {template.tipo_contrato}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parceiroSelecionado && templates.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Este parceiro não tem templates de contrato. Crie templates em "Parceiros" → Selecionar Parceiro → "Criar Template de Contrato"
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

                {/* Aviso quando veículo tem condições pré-definidas */}
                {veiculoTemCondicoesPredefinidas && veiculoSelecionado && (
                  <Alert className="mt-4 border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <p className="font-semibold mb-2">Este veículo tem condições pré-definidas</p>
                      <p className="text-sm mb-3">
                        Tipo: <span className="font-semibold">{veiculoData?.tipo_contrato?.tipo || veiculoData?.tipo_exploracao}</span>
                        {veiculoData?.tipo_contrato?.tipo === 'comissao' && (
                          <span className="ml-2">
                            (Motorista: {veiculoData.tipo_contrato.comissao_motorista}% / 
                            Parceiro: {veiculoData.tipo_contrato.comissao_parceiro}%)
                          </span>
                        )}
                        {veiculoData?.tipo_contrato?.tipo === 'aluguer' && (
                          <span className="ml-2">
                            (Valor: €{veiculoData.tipo_contrato.valor_aluguer})
                          </span>
                        )}
                      </p>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Checkbox 
                          id="permitir-alterar"
                          checked={permitirAlterarCondicoes}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setShowConfirmacaoAlteracao(true);
                            } else {
                              setPermitirAlterarCondicoes(false);
                            }
                          }}
                        />
                        <Label 
                          htmlFor="permitir-alterar" 
                          className="text-sm font-medium cursor-pointer flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Alterar condições para este contrato
                        </Label>
                      </div>
                      
                      {!permitirAlterarCondicoes && (
                        <p className="text-xs text-amber-700 mt-2">
                          As condições do veículo serão aplicadas automaticamente. 
                          Marque a opção acima se desejar alterar.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

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
                            {veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes && (
                              <span className="text-xs text-amber-600 ml-2">(Pré-definido pelo veículo)</span>
                            )}
                          </Label>
                          <Input
                            id="valor_aplicado"
                            type="number"
                            step="0.01"
                            value={formData.valor_aplicado}
                            onChange={(e) => setFormData({...formData, valor_aplicado: e.target.value})}
                            disabled={veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes}
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
                          <Label htmlFor="perc_motorista">
                            % Motorista *
                            {veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes && (
                              <span className="text-xs text-amber-600 ml-2">(Pré-definido pelo veículo)</span>
                            )}
                          </Label>
                          <Input
                            id="perc_motorista"
                            type="number"
                            step="0.01"
                            value={formData.percentagem_motorista_aplicado}
                            onChange={(e) => setFormData({...formData, percentagem_motorista_aplicado: e.target.value})}
                            disabled={veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="perc_parceiro">
                            % Parceiro *
                            {veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes && (
                              <span className="text-xs text-amber-600 ml-2">(Pré-definido pelo veículo)</span>
                            )}
                          </Label>
                          <Input
                            id="perc_parceiro"
                            type="number"
                            step="0.01"
                            value={formData.percentagem_parceiro_aplicado}
                            onChange={(e) => setFormData({...formData, percentagem_parceiro_aplicado: e.target.value})}
                            disabled={veiculoTemCondicoesPredefinidas && !permitirAlterarCondicoes}
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

      {/* Modal de Confirmação de Alteração */}
      <Dialog open={showConfirmacaoAlteracao} onOpenChange={setShowConfirmacaoAlteracao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Confirmar Alteração de Condições</span>
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-3 mt-3">
                <p className="text-slate-700">
                  Você está prestes a alterar as condições de exploração deste veículo.
                </p>
                
                <div className="bg-slate-50 p-3 rounded border">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Condições Atuais do Veículo:</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Tipo: <span className="font-medium">{veiculoData?.tipo_contrato?.tipo || 'N/A'}</span></li>
                    {veiculoData?.tipo_contrato?.tipo === 'comissao' && (
                      <>
                        <li>• Comissão Motorista: <span className="font-medium">{veiculoData.tipo_contrato.comissao_motorista}%</span></li>
                        <li>• Comissão Parceiro: <span className="font-medium">{veiculoData.tipo_contrato.comissao_parceiro}%</span></li>
                      </>
                    )}
                    {veiculoData?.tipo_contrato?.tipo === 'aluguer' && (
                      <li>• Valor Aluguer: <span className="font-medium">€{veiculoData.tipo_contrato.valor_aluguer}</span></li>
                    )}
                  </ul>
                </div>

                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-800">
                    <p className="font-semibold">Atenção:</p>
                    <p>As alterações feitas neste contrato <strong>NÃO</strong> serão aplicadas automaticamente ao veículo.</p>
                    <p className="mt-2">
                      Se desejar alterar permanentemente as condições do veículo, 
                      edite-as diretamente na ficha do veículo.
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmacaoAlteracao(false);
                setPermitirAlterarCondicoes(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setShowConfirmacaoAlteracao(false);
                setPermitirAlterarCondicoes(true);
                toast.success('Você pode agora alterar as condições para este contrato');
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CriarContrato;
