import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, CreditCard, Car, FileText,
  Save, Edit, Euro, Percent, Calculator, TrendingUp, Wallet,
  Receipt, Settings, History, AlertCircle, CheckCircle, Clock
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FichaMotorista = ({ user }) => {
  const { motoristaId } = useParams();
  const navigate = useNavigate();
  
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  
  // Campos financeiros
  const [configFinanceira, setConfigFinanceira] = useState({
    // Acumulação Via Verde
    acumular_viaverde: false,
    viaverde_acumulado: 0,
    viaverde_fonte: 'ambos', // uber, bolt, ambos
    
    // Gratificação
    gratificacao_tipo: 'na_comissao', // na_comissao, fora_comissao
    gratificacao_valor_fixo: 0,
    
    // IVA
    incluir_iva_rendimentos: true,
    iva_percentagem: 23,
    
    // Comissão personalizada (se diferente do contrato)
    comissao_personalizada: false,
    comissao_motorista_percentagem: 0,
    comissao_parceiro_percentagem: 0
  });
  
  // Histórico de Via Verde acumulado
  const [historicoViaVerde, setHistoricoViaVerde] = useState([]);
  
  // Veículo atribuído
  const [veiculo, setVeiculo] = useState(null);
  
  // Contrato activo
  const [contrato, setContrato] = useState(null);

  useEffect(() => {
    if (motoristaId) {
      fetchMotorista();
      fetchHistoricoViaVerde();
    }
  }, [motoristaId]);

  const fetchMotorista = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const motoristaData = response.data;
      setMotorista(motoristaData);
      
      // Carregar configurações financeiras se existirem
      if (motoristaData.config_financeira) {
        setConfigFinanceira(prev => ({
          ...prev,
          ...motoristaData.config_financeira
        }));
      }
      
      // Carregar veículo se atribuído
      if (motoristaData.veiculo_atribuido) {
        fetchVeiculo(motoristaData.veiculo_atribuido);
      }
      
      // Carregar contrato activo
      fetchContrato(motoristaId);
      
    } catch (error) {
      console.error('Erro ao carregar motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const fetchVeiculo = async (veiculoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/vehicles/${veiculoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculo(response.data);
    } catch (error) {
      console.error('Erro ao carregar veículo:', error);
    }
  };

  const fetchContrato = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/contratos?motorista_id=${motoristaId}&ativo=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.length > 0) {
        setContrato(response.data[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar contrato:', error);
    }
  };

  const fetchHistoricoViaVerde = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}/viaverde-acumulado`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricoViaVerde(response.data?.historico || []);
      if (response.data?.total_acumulado !== undefined) {
        setConfigFinanceira(prev => ({
          ...prev,
          viaverde_acumulado: response.data.total_acumulado
        }));
      }
    } catch (error) {
      // Endpoint pode não existir ainda
      console.log('Histórico Via Verde não disponível');
    }
  };

  const handleSaveConfigFinanceira = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/motoristas/${motoristaId}/config-financeira`, configFinanceira, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configurações financeiras guardadas!');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAbaterViaVerde = async () => {
    if (!window.confirm(`Confirma o abate de €${configFinanceira.viaverde_acumulado.toFixed(2)} do Via Verde acumulado?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/motoristas/${motoristaId}/viaverde-abater`, {
        valor: configFinanceira.viaverde_acumulado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConfigFinanceira(prev => ({ ...prev, viaverde_acumulado: 0 }));
      toast.success('Via Verde abatido com sucesso!');
      fetchHistoricoViaVerde();
    } catch (error) {
      console.error('Erro ao abater:', error);
      toast.error('Erro ao abater Via Verde');
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ativo: { label: 'Ativo', variant: 'default', className: 'bg-green-500' },
      inativo: { label: 'Inativo', variant: 'secondary', className: 'bg-gray-500' },
      pendente: { label: 'Pendente', variant: 'outline', className: 'bg-yellow-500' },
      suspenso: { label: 'Suspenso', variant: 'destructive', className: 'bg-red-500' }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!motorista) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Motorista não encontrado</h2>
          <Button onClick={() => navigate('/motoristas')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/motoristas')} data-testid="btn-voltar">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                  {getInitials(motorista.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold" data-testid="motorista-nome">{motorista.name}</h1>
                <p className="text-slate-500">{motorista.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(motorista.status_motorista || motorista.status)}
            {contrato && (
              <Badge variant="outline">
                {contrato.tipo_contrato === 'comissao' ? 'Comissão' : 'Aluguer'}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral" data-testid="tab-geral">
              <User className="w-4 h-4 mr-2" /> Geral
            </TabsTrigger>
            <TabsTrigger value="financeiro" data-testid="tab-financeiro">
              <Euro className="w-4 h-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="documentos" data-testid="tab-documentos">
              <FileText className="w-4 h-4 mr-2" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="historico" data-testid="tab-historico">
              <History className="w-4 h-4 mr-2" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab Geral */}
          <TabsContent value="geral" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dados Pessoais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" /> Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-sm">Email</Label>
                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {motorista.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-sm">Telefone</Label>
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {motorista.phone || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-sm">NIF</Label>
                      <p>{motorista.nif || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-sm">IBAN</Label>
                      <p className="text-sm">{motorista.iban || 'N/A'}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-slate-500 text-sm">Morada</Label>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {motorista.morada_completa || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Veículo Atribuído */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Car className="w-5 h-5" /> Veículo Atribuído
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {veiculo ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-lg">{veiculo.matricula}</p>
                          <p className="text-slate-500">{veiculo.marca} {veiculo.modelo}</p>
                        </div>
                        <Badge>{veiculo.ano}</Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-500">Tipo Contrato:</span>
                          <p className="font-medium">{veiculo.tipo_contrato_veiculo || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Valor Semanal:</span>
                          <p className="font-medium">€{veiculo.valor_semanal || 0}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500">
                      <Car className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>Sem veículo atribuído</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Emails Plataformas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Emails das Plataformas</CardTitle>
                <CardDescription>Emails utilizados nas plataformas Uber e Bolt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-sm">Email Uber</Label>
                    <p className="font-medium">{motorista.email_uber || motorista.email}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Email Bolt</Label>
                    <p className="font-medium">{motorista.email_bolt || motorista.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Financeiro */}
          <TabsContent value="financeiro" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="btn-editar-financeiro">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveConfigFinanceira} disabled={saving} data-testid="btn-guardar-financeiro">
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Acumulação Via Verde */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" /> Acumulação Via Verde
                  </CardTitle>
                  <CardDescription>
                    Acumula valores de Via Verde dos ganhos até ser cobrado no relatório
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Ativar acumulação</Label>
                    <Switch
                      checked={configFinanceira.acumular_viaverde}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, acumular_viaverde: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-acumular-viaverde"
                    />
                  </div>

                  {configFinanceira.acumular_viaverde && (
                    <>
                      <div>
                        <Label>Fonte dos valores</Label>
                        <Select
                          value={configFinanceira.viaverde_fonte}
                          onValueChange={(value) => 
                            setConfigFinanceira(prev => ({ ...prev, viaverde_fonte: value }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger data-testid="select-viaverde-fonte">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uber">Apenas Uber</SelectItem>
                            <SelectItem value="bolt">Apenas Bolt</SelectItem>
                            <SelectItem value="ambos">Uber + Bolt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Valor Acumulado</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="valor-viaverde-acumulado">
                              €{configFinanceira.viaverde_acumulado.toFixed(2)}
                            </p>
                          </div>
                          {configFinanceira.viaverde_acumulado > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleAbaterViaVerde}
                              data-testid="btn-abater-viaverde"
                            >
                              Abater no Relatório
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Gratificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-purple-600" /> Gratificação
                  </CardTitle>
                  <CardDescription>
                    Configuração de gratificações (gorjetas) em contratos de comissão
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Gratificação</Label>
                    <Select
                      value={configFinanceira.gratificacao_tipo}
                      onValueChange={(value) => 
                        setConfigFinanceira(prev => ({ ...prev, gratificacao_tipo: value }))
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-gratificacao-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na_comissao">Na Comissão (incluído no cálculo)</SelectItem>
                        <SelectItem value="fora_comissao">Fora da Comissão (pago separadamente)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span>Gratificações <strong>incluídas</strong> no cálculo da comissão com o parceiro</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Gratificações <strong>pagas separadamente</strong> ao motorista (100% para o motorista)</span>
                        </>
                      )}
                    </div>
                  </div>

                  {configFinanceira.gratificacao_tipo === 'fora_comissao' && (
                    <div>
                      <Label>Valor Fixo Adicional (opcional)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={configFinanceira.gratificacao_valor_fixo}
                          onChange={(e) => 
                            setConfigFinanceira(prev => ({ 
                              ...prev, 
                              gratificacao_valor_fixo: parseFloat(e.target.value) || 0 
                            }))
                          }
                          disabled={!isEditing}
                          className="w-32"
                          data-testid="input-gratificacao-valor"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Configuração IVA */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Percent className="w-5 h-5 text-blue-600" /> Configuração IVA
                  </CardTitle>
                  <CardDescription>
                    Define se o IVA é incluído ou excluído dos rendimentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Incluir IVA nos rendimentos</Label>
                    <Switch
                      checked={configFinanceira.incluir_iva_rendimentos}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, incluir_iva_rendimentos: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-incluir-iva"
                    />
                  </div>

                  <div>
                    <Label>Percentagem IVA</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={configFinanceira.iva_percentagem}
                        onChange={(e) => 
                          setConfigFinanceira(prev => ({ 
                            ...prev, 
                            iva_percentagem: parseFloat(e.target.value) || 23 
                          }))
                        }
                        disabled={!isEditing}
                        className="w-24"
                        data-testid="input-iva-percentagem"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.incluir_iva_rendimentos ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span>Rendimentos <strong>com IVA</strong> ({configFinanceira.iva_percentagem}%)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Rendimentos <strong>sem IVA</strong> (líquido)</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comissão Personalizada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-orange-600" /> Comissão
                  </CardTitle>
                  <CardDescription>
                    Percentagens de comissão (se diferente do contrato padrão)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Usar comissão personalizada</Label>
                    <Switch
                      checked={configFinanceira.comissao_personalizada}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, comissao_personalizada: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-comissao-personalizada"
                    />
                  </div>

                  {configFinanceira.comissao_personalizada ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Comissão Motorista</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_motorista_percentagem}
                            onChange={(e) => {
                              const motorista = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_motorista_percentagem: motorista,
                                comissao_parceiro_percentagem: 100 - motorista
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                            data-testid="input-comissao-motorista"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Comissão Parceiro</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_parceiro_percentagem}
                            onChange={(e) => {
                              const parceiro = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_parceiro_percentagem: parceiro,
                                comissao_motorista_percentagem: 100 - parceiro
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                            data-testid="input-comissao-parceiro"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">
                        A usar comissão do contrato: <strong>
                          {contrato ? `${contrato.comissao_motorista || 70}% / ${contrato.comissao_parceiro || 30}%` : 'N/A'}
                        </strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Resumo da Configuração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Via Verde</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.acumular_viaverde ? 'Acumulado' : 'Direto'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Gratificação</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? 'Na Comissão' : 'Separado'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">IVA</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.incluir_iva_rendimentos ? `${configFinanceira.iva_percentagem}%` : 'Excluído'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Comissão</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.comissao_personalizada 
                        ? `${configFinanceira.comissao_motorista_percentagem}/${configFinanceira.comissao_parceiro_percentagem}`
                        : 'Contrato'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documentos do Motorista</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Carta de Condução</span>
                      {motorista.carta_conducao_validade ? (
                        <Badge variant="outline">{motorista.carta_conducao_validade}</Badge>
                      ) : (
                        <Badge variant="destructive">Não definida</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Nº: {motorista.carta_conducao_numero || 'N/A'}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Licença TVDE</span>
                      {motorista.licenca_tvde_validade ? (
                        <Badge variant="outline">{motorista.licenca_tvde_validade}</Badge>
                      ) : (
                        <Badge variant="destructive">Não definida</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Nº: {motorista.licenca_tvde_numero || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Via Verde Acumulado</CardTitle>
              </CardHeader>
              <CardContent>
                {historicoViaVerde.length > 0 ? (
                  <div className="space-y-2">
                    {historicoViaVerde.map((item, index) => (
                      <div key={index} className="flex items-center justify-between border-b py-2">
                        <div>
                          <p className="font-medium">{item.descricao || 'Movimento'}</p>
                          <p className="text-sm text-slate-500">{item.data}</p>
                        </div>
                        <div className={`font-bold ${item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.tipo === 'credito' ? '+' : '-'}€{Math.abs(item.valor).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Sem histórico de Via Verde</p>
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

export default FichaMotorista;
