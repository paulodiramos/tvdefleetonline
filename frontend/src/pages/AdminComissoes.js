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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Star,
  Crown,
  Medal,
  Users,
  Car
} from 'lucide-react';

const AdminComissoes = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Escalas
  const [escalas, setEscalas] = useState([]);
  const [escalaAtiva, setEscalaAtiva] = useState(null);
  const [editandoEscala, setEditandoEscala] = useState(false);
  const [niveisEscala, setNiveisEscala] = useState([]);
  
  // Classificações
  const [configClassificacao, setConfigClassificacao] = useState(null);
  const [niveisClassificacao, setNiveisClassificacao] = useState([]);
  const [editandoClassificacao, setEditandoClassificacao] = useState(false);
  
  // Simulador
  const [valorSimulacao, setValorSimulacao] = useState(1000);
  const [nivelSimulacao, setNivelSimulacao] = useState(1);
  const [resultadoSimulacao, setResultadoSimulacao] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [escalasRes, classificacaoRes] = await Promise.all([
        axios.get(`${API}/comissoes/escalas`, { headers }),
        axios.get(`${API}/comissoes/classificacao/config`, { headers })
      ]);
      
      setEscalas(escalasRes.data.escalas || []);
      const ativa = escalasRes.data.escalas?.find(e => e.ativo);
      setEscalaAtiva(ativa);
      setNiveisEscala(ativa?.niveis || []);
      
      setConfigClassificacao(classificacaoRes.data);
      setNiveisClassificacao(classificacaoRes.data?.niveis || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSimular = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/comissoes/simular?valor_faturado=${valorSimulacao}&nivel_classificacao=${nivelSimulacao}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResultadoSimulacao(response.data);
    } catch (error) {
      toast.error('Erro ao simular');
    }
  };

  const handleSaveEscala = async () => {
    if (!escalaAtiva) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/comissoes/escalas/${escalaAtiva.id}/niveis`,
        { niveis: niveisEscala },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Escala de comissões guardada');
      setEditandoEscala(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao guardar escala');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClassificacao = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/comissoes/classificacao/config`,
        niveisClassificacao,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Níveis de classificação guardados');
      setEditandoClassificacao(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao guardar classificação');
    } finally {
      setSaving(false);
    }
  };

  const addNivelEscala = () => {
    const novoNivel = {
      id: `temp-${Date.now()}`,
      nome: `Nível ${niveisEscala.length + 1}`,
      valor_minimo: niveisEscala.length > 0 ? niveisEscala[niveisEscala.length - 1].valor_maximo || 0 : 0,
      valor_maximo: null,
      percentagem_comissao: 10,
      ordem: niveisEscala.length + 1
    };
    setNiveisEscala([...niveisEscala, novoNivel]);
  };

  const removeNivelEscala = (index) => {
    setNiveisEscala(niveisEscala.filter((_, i) => i !== index));
  };

  const updateNivelEscala = (index, field, value) => {
    const updated = [...niveisEscala];
    updated[index] = { ...updated[index], [field]: value };
    setNiveisEscala(updated);
  };

  const updateNivelClassificacao = (index, field, value) => {
    const updated = [...niveisClassificacao];
    updated[index] = { ...updated[index], [field]: value };
    setNiveisClassificacao(updated);
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Percent className="w-6 h-6" />
                Comissões e Classificações
              </h1>
              <p className="text-slate-600">Gerir escalas de comissão e níveis de motoristas</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="escalas" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="escalas" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Escalas Comissão
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Classificação Motoristas
            </TabsTrigger>
            <TabsTrigger value="simulador" className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Simulador
            </TabsTrigger>
          </TabsList>

          {/* ESCALAS DE COMISSÃO */}
          <TabsContent value="escalas">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Escala de Comissões por Valor Faturado
                    </CardTitle>
                    <CardDescription>
                      Define a percentagem de comissão baseada no valor faturado semanal
                    </CardDescription>
                  </div>
                  {!editandoEscala ? (
                    <Button onClick={() => setEditandoEscala(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => {
                        setEditandoEscala(false);
                        setNiveisEscala(escalaAtiva?.niveis || []);
                      }}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveEscala} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nível</TableHead>
                      <TableHead>Valor Mínimo (€)</TableHead>
                      <TableHead>Valor Máximo (€)</TableHead>
                      <TableHead>Comissão (%)</TableHead>
                      {editandoEscala && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {niveisEscala.map((nivel, index) => (
                      <TableRow key={nivel.id}>
                        <TableCell>
                          {editandoEscala ? (
                            <Input
                              value={nivel.nome}
                              onChange={(e) => updateNivelEscala(index, 'nome', e.target.value)}
                              className="w-32"
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
                              className="text-red-500 hover:text-red-700"
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
          </TabsContent>

          {/* CLASSIFICAÇÃO DE MOTORISTAS */}
          <TabsContent value="classificacao">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      Níveis de Classificação de Motoristas
                    </CardTitle>
                    <CardDescription>
                      Define níveis com bónus % adicionado à comissão base (antiguidade + cuidado veículo)
                    </CardDescription>
                  </div>
                  {!editandoClassificacao ? (
                    <Button onClick={() => setEditandoClassificacao(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => {
                        setEditandoClassificacao(false);
                        setNiveisClassificacao(configClassificacao?.niveis || []);
                      }}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveClassificacao} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {niveisClassificacao.map((nivel, index) => (
                    <Card key={nivel.id} className="overflow-hidden">
                      <div className="h-2" style={{ backgroundColor: nivel.cor }} />
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="text-2xl">{nivel.icone}</span>
                          {editandoClassificacao ? (
                            <Input
                              value={nivel.nome}
                              onChange={(e) => updateNivelClassificacao(index, 'nome', e.target.value)}
                              className="font-bold"
                            />
                          ) : (
                            nivel.nome
                          )}
                        </CardTitle>
                        <CardDescription>
                          {editandoClassificacao ? (
                            <Input
                              value={nivel.descricao || ''}
                              onChange={(e) => updateNivelClassificacao(index, 'descricao', e.target.value)}
                              placeholder="Descrição"
                            />
                          ) : (
                            nivel.descricao
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Critérios */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Meses mínimos:</span>
                            {editandoClassificacao ? (
                              <Input
                                type="number"
                                value={nivel.meses_minimos}
                                onChange={(e) => updateNivelClassificacao(index, 'meses_minimos', parseInt(e.target.value) || 0)}
                                className="w-20 text-right"
                              />
                            ) : (
                              <span className="font-medium">{nivel.meses_minimos}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              Cuidado veículo:
                            </span>
                            {editandoClassificacao ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={nivel.cuidado_veiculo_minimo}
                                onChange={(e) => updateNivelClassificacao(index, 'cuidado_veiculo_minimo', parseInt(e.target.value) || 0)}
                                className="w-20 text-right"
                              />
                            ) : (
                              <span className="font-medium">{nivel.cuidado_veiculo_minimo}%</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Bónus */}
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-green-700 font-medium">Bónus Comissão:</span>
                            {editandoClassificacao ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={nivel.bonus_percentagem}
                                  onChange={(e) => updateNivelClassificacao(index, 'bonus_percentagem', parseFloat(e.target.value) || 0)}
                                  className="w-20 text-right"
                                />
                                <span>%</span>
                              </div>
                            ) : (
                              <span className="text-xl font-bold text-green-600">+{nivel.bonus_percentagem}%</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Cor e ícone */}
                        {editandoClassificacao && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                            <div>
                              <Label className="text-xs">Ícone</Label>
                              <Input
                                value={nivel.icone}
                                onChange={(e) => updateNivelClassificacao(index, 'icone', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Cor</Label>
                              <Input
                                type="color"
                                value={nivel.cor}
                                onChange={(e) => updateNivelClassificacao(index, 'cor', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIMULADOR */}
          <TabsContent value="simulador">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    Simulador de Comissão
                  </CardTitle>
                  <CardDescription>
                    Calcule a comissão para um valor faturado e nível de classificação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Valor Faturado Semanal (€)</Label>
                    <Input
                      type="number"
                      value={valorSimulacao}
                      onChange={(e) => setValorSimulacao(parseFloat(e.target.value) || 0)}
                    />
                    <Slider
                      value={[valorSimulacao]}
                      onValueChange={(v) => setValorSimulacao(v[0])}
                      max={3000}
                      step={50}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Nível de Classificação do Motorista</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {niveisClassificacao.map((nivel) => (
                        <Button
                          key={nivel.nivel}
                          variant={nivelSimulacao === nivel.nivel ? "default" : "outline"}
                          onClick={() => setNivelSimulacao(nivel.nivel)}
                          className="flex flex-col h-auto py-2"
                        >
                          <span className="text-lg">{nivel.icone}</span>
                          <span className="text-xs">{nivel.nome}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Button onClick={handleSimular} className="w-full">
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Comissão
                  </Button>
                </CardContent>
              </Card>

              {/* Resultado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Euro className="w-5 h-5 text-green-600" />
                    Resultado da Simulação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resultadoSimulacao ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Valor Faturado:</span>
                          <span className="font-bold text-lg">€{formatarEuros(resultadoSimulacao.valor_faturado)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Escala:</span>
                          <Badge variant="outline">{resultadoSimulacao.nivel_escala}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Classificação:</span>
                          <Badge>{resultadoSimulacao.nivel_classificacao}</Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-blue-50 rounded">
                          <span>Comissão Base ({resultadoSimulacao.percentagem_base}%):</span>
                          <span className="font-medium">€{formatarEuros(resultadoSimulacao.valor_comissao_base)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-green-50 rounded">
                          <span>Bónus Classificação (+{resultadoSimulacao.bonus_percentagem}%):</span>
                          <span className="font-medium text-green-600">+€{formatarEuros(resultadoSimulacao.valor_bonus)}</span>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-green-100 text-sm">Comissão Total</p>
                            <p className="text-sm opacity-75">({resultadoSimulacao.percentagem_total}%)</p>
                          </div>
                          <span className="text-3xl font-bold">€{formatarEuros(resultadoSimulacao.valor_total)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Clique em "Calcular Comissão" para ver o resultado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminComissoes;
