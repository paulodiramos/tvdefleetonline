import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calcularSemIva, formatarEuros } from '@/utils/iva';
import {
  ArrowLeft,
  Percent,
  Award,
  TrendingUp,
  Euro,
  Plus,
  Trash2,
  Edit,
  Save,
  Loader2,
  Calculator,
  Users,
  Car,
  Settings,
  Lock,
  CheckCircle
} from 'lucide-react';

const ConfigComissoesParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Verificar se tem módulo
  const [temModuloComissoes, setTemModuloComissoes] = useState(false);
  const [temModuloClassificacao, setTemModuloClassificacao] = useState(false);
  
  // Configuração do parceiro
  const [configParceiro, setConfigParceiro] = useState({
    usar_escala_propria: false,
    usar_valor_fixo: false,
    valor_fixo_comissao: 0,
    percentagem_fixa: 15,
    escala_propria: [],
    usar_classificacao_propria: false,
    niveis_classificacao: []
  });
  
  // Escalas e classificações globais (para referência)
  const [escalaGlobal, setEscalaGlobal] = useState(null);
  const [classificacaoGlobal, setClassificacaoGlobal] = useState(null);
  
  // Motoristas do parceiro
  const [motoristas, setMotoristas] = useState([]);
  
  // Edição
  const [editandoEscala, setEditandoEscala] = useState(false);
  const [editandoClassificacao, setEditandoClassificacao] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Verificar módulos ativos
      const modulosRes = await axios.get(`${API}/gestao-planos/modulos-ativos/user/${user?.id}`, { headers }).catch(() => ({ data: { modulos_ativos: [] } }));
      const modulosAtivos = modulosRes.data.modulos_ativos || [];
      
      // Verificar se tem módulos de comissões
      const temComissoes = modulosAtivos.some(m => 
        m.toLowerCase().includes('comiss') || 
        m.toLowerCase().includes('commission') ||
        m.toLowerCase().includes('relatorios') ||
        m.toLowerCase().includes('reports')
      );
      const temClassif = modulosAtivos.some(m => 
        m.toLowerCase().includes('classific') || 
        m.toLowerCase().includes('motorista') ||
        m.toLowerCase().includes('driver')
      );
      
      // Para demo, vamos permitir sempre (pode ajustar depois)
      setTemModuloComissoes(true);
      setTemModuloClassificacao(true);
      
      // Buscar configuração do parceiro
      const configRes = await axios.get(`${API}/comissoes/parceiro/config`, { headers }).catch(() => ({ data: null }));
      if (configRes.data) {
        setConfigParceiro(prev => ({ ...prev, ...configRes.data }));
      }
      
      // Buscar escala e classificação globais
      const [escalaRes, classificacaoRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/comissoes/escalas/ativa`, { headers }),
        axios.get(`${API}/comissoes/classificacao/config`, { headers }),
        axios.get(`${API}/motoristas`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setEscalaGlobal(escalaRes.data);
      setClassificacaoGlobal(classificacaoRes.data);
      setMotoristas(Array.isArray(motoristasRes.data) ? motoristasRes.data : motoristasRes.data?.motoristas || []);
      
      // Se não tem escala própria, usar a global como base
      if (!configRes.data?.escala_propria?.length && escalaRes.data?.niveis) {
        setConfigParceiro(prev => ({
          ...prev,
          escala_propria: escalaRes.data.niveis
        }));
      }
      
      // Se não tem classificação própria, usar a global
      if (!configRes.data?.niveis_classificacao?.length && classificacaoRes.data?.niveis) {
        setConfigParceiro(prev => ({
          ...prev,
          niveis_classificacao: classificacaoRes.data.niveis
        }));
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/comissoes/parceiro/config`,
        configParceiro,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração guardada com sucesso');
      setEditandoEscala(false);
      setEditandoClassificacao(false);
    } catch (error) {
      toast.error('Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const updateNivelEscala = (index, field, value) => {
    const updated = [...configParceiro.escala_propria];
    updated[index] = { ...updated[index], [field]: value };
    setConfigParceiro(prev => ({ ...prev, escala_propria: updated }));
  };

  const addNivelEscala = () => {
    const niveis = configParceiro.escala_propria || [];
    const novoNivel = {
      id: `novo-${Date.now()}`,
      nome: `Nível ${niveis.length + 1}`,
      valor_minimo: niveis.length > 0 ? (niveis[niveis.length - 1].valor_maximo || 0) : 0,
      valor_maximo: null,
      percentagem_comissao: 10,
      ordem: niveis.length + 1
    };
    setConfigParceiro(prev => ({
      ...prev,
      escala_propria: [...(prev.escala_propria || []), novoNivel]
    }));
  };

  const removeNivelEscala = (index) => {
    setConfigParceiro(prev => ({
      ...prev,
      escala_propria: prev.escala_propria.filter((_, i) => i !== index)
    }));
  };

  const updateNivelClassificacao = (index, field, value) => {
    const updated = [...configParceiro.niveis_classificacao];
    updated[index] = { ...updated[index], [field]: value };
    setConfigParceiro(prev => ({ ...prev, niveis_classificacao: updated }));
  };

  const atualizarClassificacaoMotorista = async (motoristaId, nivelId, pontuacaoCuidado) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/comissoes/classificacao/motorista/${motoristaId}`,
        {
          nivel_id: nivelId,
          nivel_manual: true,
          pontuacao_cuidado_veiculo: pontuacaoCuidado,
          motivo: "Definido pelo parceiro"
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Classificação do motorista atualizada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao atualizar classificação');
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="config-comissoes-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="btn-voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="page-title">
                <Settings className="w-6 h-6" />
                Configuração de Comissões
              </h1>
              <p className="text-slate-600">Configure escalas de comissão e classificação de motoristas</p>
            </div>
          </div>
          <Button onClick={handleSaveConfig} disabled={saving} data-testid="btn-guardar-config">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Tudo
          </Button>
        </div>

        <Tabs defaultValue="comissoes" className="space-y-6" data-testid="tabs-comissoes">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comissoes" className="flex items-center gap-2" data-testid="tab-comissoes">
              <Percent className="w-4 h-4" />
              Comissões
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="flex items-center gap-2" data-testid="tab-classificacao">
              <Award className="w-4 h-4" />
              Classificação
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Meus Motoristas
            </TabsTrigger>
          </TabsList>

          {/* COMISSÕES */}
          <TabsContent value="comissoes">
            <div className="space-y-6">
              {/* Tipo de Comissão */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Euro className="w-5 h-5 text-green-600" />
                    Tipo de Comissão
                  </CardTitle>
                  <CardDescription>
                    Escolha entre valor fixo, percentagem fixa ou escala por valor faturado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Valor Fixo */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Euro className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <Label className="font-medium">Valor Fixo por Semana</Label>
                        <p className="text-sm text-slate-500">Comissão fixa independente do valor faturado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {configParceiro.usar_valor_fixo && (
                        <div className="flex items-center gap-2">
                          <span>€</span>
                          <Input
                            type="number"
                            value={configParceiro.valor_fixo_comissao}
                            onChange={(e) => setConfigParceiro(prev => ({
                              ...prev,
                              valor_fixo_comissao: parseFloat(e.target.value) || 0
                            }))}
                            className="w-24"
                          />
                        </div>
                      )}
                      <Switch
                        checked={configParceiro.usar_valor_fixo}
                        onCheckedChange={(checked) => setConfigParceiro(prev => ({
                          ...prev,
                          usar_valor_fixo: checked,
                          usar_escala_propria: checked ? false : prev.usar_escala_propria
                        }))}
                      />
                    </div>
                  </div>

                  {/* Percentagem Fixa */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Percent className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <Label className="font-medium">Percentagem Fixa</Label>
                        <p className="text-sm text-slate-500">Mesma % para todos os valores faturados</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!configParceiro.usar_valor_fixo && !configParceiro.usar_escala_propria && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.5"
                            value={configParceiro.percentagem_fixa}
                            onChange={(e) => setConfigParceiro(prev => ({
                              ...prev,
                              percentagem_fixa: parseFloat(e.target.value) || 0
                            }))}
                            className="w-20"
                          />
                          <span>%</span>
                        </div>
                      )}
                      <Badge variant={!configParceiro.usar_valor_fixo && !configParceiro.usar_escala_propria ? "default" : "outline"}>
                        {!configParceiro.usar_valor_fixo && !configParceiro.usar_escala_propria ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  {/* Escala Própria */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <Label className="font-medium">Escala por Valor Faturado</Label>
                        <p className="text-sm text-slate-500">Diferentes % consoante o valor semanal</p>
                      </div>
                    </div>
                    <Switch
                      checked={configParceiro.usar_escala_propria}
                      onCheckedChange={(checked) => setConfigParceiro(prev => ({
                        ...prev,
                        usar_escala_propria: checked,
                        usar_valor_fixo: checked ? false : prev.usar_valor_fixo
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Escala de Comissão */}
              {configParceiro.usar_escala_propria && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Escala de Comissões</CardTitle>
                        <CardDescription>Configure os níveis de comissão por valor faturado</CardDescription>
                      </div>
                      {!editandoEscala ? (
                        <Button variant="outline" onClick={() => setEditandoEscala(true)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => setEditandoEscala(false)}>
                          Concluir
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nível</TableHead>
                          <TableHead>De (€)</TableHead>
                          <TableHead>Até (€)</TableHead>
                          <TableHead>Comissão (%)</TableHead>
                          {editandoEscala && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(configParceiro.escala_propria || []).map((nivel, index) => (
                          <TableRow key={nivel.id || index}>
                            <TableCell>
                              {editandoEscala ? (
                                <Input
                                  value={nivel.nome}
                                  onChange={(e) => updateNivelEscala(index, 'nome', e.target.value)}
                                  className="w-28"
                                />
                              ) : (
                                <Badge variant="outline">{nivel.nome}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {editandoEscala ? (
                                <Input
                                  type="number"
                                  value={nivel.valor_minimo}
                                  onChange={(e) => updateNivelEscala(index, 'valor_minimo', parseFloat(e.target.value) || 0)}
                                  className="w-24"
                                />
                              ) : (
                                `€${formatarEuros(nivel.valor_minimo)}`
                              )}
                            </TableCell>
                            <TableCell>
                              {editandoEscala ? (
                                <Input
                                  type="number"
                                  value={nivel.valor_maximo || ''}
                                  onChange={(e) => updateNivelEscala(index, 'valor_maximo', e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="Sem limite"
                                  className="w-24"
                                />
                              ) : (
                                nivel.valor_maximo ? `€${formatarEuros(nivel.valor_maximo)}` : <Badge>Sem limite</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {editandoEscala ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={nivel.percentagem_comissao}
                                  onChange={(e) => updateNivelEscala(index, 'percentagem_comissao', parseFloat(e.target.value) || 0)}
                                  className="w-20"
                                />
                              ) : (
                                <span className="font-bold text-green-600">{nivel.percentagem_comissao}%</span>
                              )}
                            </TableCell>
                            {editandoEscala && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeNivelEscala(index)}
                                  className="text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {editandoEscala && (
                      <Button variant="outline" className="mt-4" onClick={addNivelEscala}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Nível
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* CLASSIFICAÇÃO */}
          <TabsContent value="classificacao">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      Níveis de Classificação
                    </CardTitle>
                    <CardDescription>
                      Configure os bónus por nível de classificação dos motoristas
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Usar classificação própria</Label>
                      <Switch
                        checked={configParceiro.usar_classificacao_propria}
                        onCheckedChange={(checked) => setConfigParceiro(prev => ({
                          ...prev,
                          usar_classificacao_propria: checked
                        }))}
                      />
                    </div>
                    {configParceiro.usar_classificacao_propria && !editandoClassificacao && (
                      <Button variant="outline" onClick={() => setEditandoClassificacao(true)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    )}
                    {editandoClassificacao && (
                      <Button variant="outline" onClick={() => setEditandoClassificacao(false)}>
                        Concluir
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {(configParceiro.niveis_classificacao || []).map((nivel, index) => (
                    <Card key={nivel.id || index} className="overflow-hidden">
                      <div className="h-2" style={{ backgroundColor: nivel.cor }} />
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">{nivel.icone}</span>
                          {editandoClassificacao && configParceiro.usar_classificacao_propria ? (
                            <Input
                              value={nivel.nome}
                              onChange={(e) => updateNivelClassificacao(index, 'nome', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            nivel.nome
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Meses mín:</span>
                          {editandoClassificacao && configParceiro.usar_classificacao_propria ? (
                            <Input
                              type="number"
                              value={nivel.meses_minimos}
                              onChange={(e) => updateNivelClassificacao(index, 'meses_minimos', parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-right"
                            />
                          ) : (
                            <span>{nivel.meses_minimos}</span>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cuidado:</span>
                          {editandoClassificacao && configParceiro.usar_classificacao_propria ? (
                            <Input
                              type="number"
                              value={nivel.cuidado_veiculo_minimo}
                              onChange={(e) => updateNivelClassificacao(index, 'cuidado_veiculo_minimo', parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-right"
                            />
                          ) : (
                            <span>{nivel.cuidado_veiculo_minimo}%</span>
                          )}
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-green-600 font-medium">Bónus:</span>
                            {editandoClassificacao && configParceiro.usar_classificacao_propria ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={nivel.bonus_percentagem}
                                  onChange={(e) => updateNivelClassificacao(index, 'bonus_percentagem', parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 text-right"
                                />
                                <span>%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-green-600">+{nivel.bonus_percentagem}%</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MOTORISTAS */}
          <TabsContent value="motoristas">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Classificação dos Meus Motoristas
                </CardTitle>
                <CardDescription>
                  Defina manualmente o nível e pontuação de cuidado do veículo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {motoristas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Nível Atual</TableHead>
                        <TableHead>Meses de Serviço</TableHead>
                        <TableHead>Cuidado Veículo</TableHead>
                        <TableHead>Bónus</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {motoristas.map((motorista) => (
                        <TableRow key={motorista.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                {motorista.nome?.charAt(0) || motorista.name?.charAt(0) || '?'}
                              </div>
                              <span className="font-medium">{motorista.nome || motorista.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {motorista.classificacao ? (
                              <Badge style={{ backgroundColor: configParceiro.niveis_classificacao?.find(n => n.nivel === motorista.classificacao?.nivel)?.cor }}>
                                {motorista.classificacao.icone} {motorista.classificacao.nome}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Sem classificação</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {motorista.meses_servico || 0} meses
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[motorista.pontuacao_cuidado_veiculo || 50]}
                                max={100}
                                step={5}
                                className="w-24"
                                onValueChange={(value) => {
                                  // Atualização local
                                  const updated = motoristas.map(m => 
                                    m.id === motorista.id 
                                      ? { ...m, pontuacao_cuidado_veiculo: value[0] }
                                      : m
                                  );
                                  setMotoristas(updated);
                                }}
                              />
                              <span className="text-sm font-medium w-10">
                                {motorista.pontuacao_cuidado_veiculo || 50}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-600">
                              +{motorista.classificacao?.bonus_percentagem || 0}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={motorista.classificacao?.nivel_id || ''}
                              onValueChange={(nivelId) => {
                                atualizarClassificacaoMotorista(
                                  motorista.id,
                                  nivelId,
                                  motorista.pontuacao_cuidado_veiculo || 50
                                );
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Atribuir nível" />
                              </SelectTrigger>
                              <SelectContent>
                                {(configParceiro.niveis_classificacao || []).map((nivel) => (
                                  <SelectItem key={nivel.id} value={nivel.id}>
                                    {nivel.icone} {nivel.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum motorista encontrado</p>
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

export default ConfigComissoesParceiro;
