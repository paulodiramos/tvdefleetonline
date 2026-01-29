import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Calendar,
  Clock,
  Save,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Upload,
  Settings,
  Bell,
  Mail,
  MessageSquare,
  FileText,
  Car,
  Fuel,
  CreditCard
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const DIAS_SEMANA = [
  { value: 0, label: 'Segunda-feira' },
  { value: 1, label: 'Terça-feira' },
  { value: 2, label: 'Quarta-feira' },
  { value: 3, label: 'Quinta-feira' },
  { value: 4, label: 'Sexta-feira' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
];

const FREQUENCIAS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

const METODOS = {
  rpa: { label: 'Automático (RPA)', icon: '🤖', description: 'Login automático e download' },
  api: { label: 'API Oficial', icon: '🔌', description: 'Integração direta com API' },
  csv: { label: 'Upload Manual', icon: '📄', description: 'Carregar ficheiro CSV' },
};

const ICONES_FONTES = {
  uber: <Car className="w-5 h-5" />,
  bolt: <Car className="w-5 h-5" />,
  viaverde: <CreditCard className="w-5 h-5" />,
  abastecimentos: <Fuel className="w-5 h-5" />,
};

const ConfigSincronizacao = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [config, setConfig] = useState(null);
  const [fontesInfo, setFontesInfo] = useState({});
  const [historico, setHistorico] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [configRes, historicoRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/sincronizacao-auto/config`, { headers }),
        axios.get(`${API}/api/sincronizacao-auto/historico?limit=10`, { headers }),
        axios.get(`${API}/api/sincronizacao-auto/estatisticas`, { headers })
      ]);
      
      setConfig(configRes.data);
      setFontesInfo(configRes.data.fontes_info || {});
      setHistorico(historicoRes.data || []);
      setEstatisticas(statsRes.data);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error('Erro ao carregar configuração de sincronização');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/sincronizacao-auto/config`,
        config,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success('Configuração guardada com sucesso!');
    } catch (error) {
      console.error('Erro ao guardar configuração:', error);
      toast.error('Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleExecutarSincronizacao = async (fontes = null) => {
    try {
      setExecuting(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/sincronizacao-auto/executar`,
        { fontes },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      
      if (response.data.sucesso) {
        toast.success('Sincronização iniciada com sucesso!');
        // Recarregar dados após alguns segundos
        setTimeout(fetchData, 3000);
      } else {
        toast.error(response.data.erro || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Erro ao executar sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
    } finally {
      setExecuting(false);
    }
  };

  const updateFonte = (fonte, field, value) => {
    setConfig(prev => ({
      ...prev,
      fontes: {
        ...prev.fontes,
        [fonte]: {
          ...prev.fontes[fonte],
          [field]: value
        }
      }
    }));
  };

  const updateAgendamento = (field, value) => {
    setConfig(prev => ({
      ...prev,
      agendamento_global: {
        ...prev.agendamento_global,
        [field]: value
      }
    }));
  };

  const updateNotificacoes = (field, value) => {
    setConfig(prev => ({
      ...prev,
      notificacoes: {
        ...prev.notificacoes,
        [field]: value
      }
    }));
  };

  const updateResumo = (field, value) => {
    setConfig(prev => ({
      ...prev,
      resumo_semanal: {
        ...prev.resumo_semanal,
        [field]: value
      }
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sucesso':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
      case 'sucesso_parcial':
        return <Badge className="bg-amber-100 text-amber-800"><AlertCircle className="w-3 h-3 mr-1" />Parcial</Badge>;
      case 'erro':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'em_execucao':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />A executar</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-slate-500">
        Erro ao carregar configuração
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="config-sincronizacao">
      {/* Header com Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sincronizações</p>
                <p className="text-2xl font-bold">{estatisticas?.total_sincronizacoes || 0}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Taxa Sucesso</p>
                <p className="text-2xl font-bold">{estatisticas?.taxa_sucesso || 0}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Última Sync</p>
                <p className="text-sm font-medium">
                  {estatisticas?.ultima_sincronizacao 
                    ? new Date(estatisticas.ultima_sincronizacao).toLocaleDateString('pt-PT')
                    : 'Nunca'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Próxima Sync</p>
                <p className="text-sm font-medium">
                  {estatisticas?.proxima_execucao 
                    ? new Date(estatisticas.proxima_execucao).toLocaleDateString('pt-PT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Não agendada'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fontes de Dados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Fontes de Dados
              </CardTitle>
              <CardDescription>Configure as fontes de dados para sincronização automática</CardDescription>
            </div>
            <Button 
              onClick={() => handleExecutarSincronizacao()} 
              disabled={executing}
              data-testid="btn-sincronizar-todas"
            >
              {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Sincronizar Agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(fontesInfo).map(([fonte, info]) => (
              <Card key={fonte} className={`border-2 ${config.fontes[fonte]?.ativo ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: info.cor + '20', color: info.cor }}
                      >
                        {info.icone}
                      </div>
                      <div>
                        <h4 className="font-semibold">{info.nome}</h4>
                        <p className="text-sm text-slate-500">{info.descricao}</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.fontes[fonte]?.ativo || false}
                      onCheckedChange={(v) => updateFonte(fonte, 'ativo', v)}
                      data-testid={`switch-${fonte}`}
                    />
                  </div>
                  
                  {config.fontes[fonte]?.ativo && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Método de recolha</Label>
                        <Select
                          value={config.fontes[fonte]?.metodo || 'csv'}
                          onValueChange={(v) => updateFonte(fonte, 'metodo', v)}
                        >
                          <SelectTrigger className="w-40" data-testid={`select-metodo-${fonte}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {info.metodos.map((m) => (
                              <SelectItem key={m} value={m}>
                                {METODOS[m]?.icon} {METODOS[m]?.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Opção de atraso para Via Verde */}
                      {fonte === 'viaverde' && (
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Atraso na sincronização</Label>
                          <Select
                            value={config.fontes[fonte]?.atraso || '0'}
                            onValueChange={(v) => updateFonte(fonte, 'atraso', v)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sem atraso</SelectItem>
                              <SelectItem value="1">1 semana</SelectItem>
                              <SelectItem value="2">2 semanas</SelectItem>
                              <SelectItem value="mensal">Mensal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleExecutarSincronizacao([fonte])}
                        disabled={executing}
                        data-testid={`btn-sincronizar-${fonte}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Sincronizar {info.nome}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Agendamento */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agendamento Automático
              </CardTitle>
              <CardDescription>Configure quando a sincronização deve ser executada automaticamente</CardDescription>
            </div>
            <Switch
              checked={config.agendamento_global?.ativo || false}
              onCheckedChange={(v) => updateAgendamento('ativo', v)}
              data-testid="switch-agendamento"
            />
          </div>
        </CardHeader>
        {config.agendamento_global?.ativo && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={config.agendamento_global?.frequencia || 'semanal'}
                  onValueChange={(v) => updateAgendamento('frequencia', v)}
                >
                  <SelectTrigger data-testid="select-frequencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {config.agendamento_global?.frequencia === 'semanal' && (
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select
                    value={String(config.agendamento_global?.dia_semana || 1)}
                    onValueChange={(v) => updateAgendamento('dia_semana', parseInt(v))}
                  >
                    <SelectTrigger data-testid="select-dia-semana">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {config.agendamento_global?.frequencia === 'mensal' && (
                <div className="space-y-2">
                  <Label>Dia do Mês</Label>
                  <Select
                    value={String(config.agendamento_global?.dia_mes || 1)}
                    onValueChange={(v) => updateAgendamento('dia_mes', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={config.agendamento_global?.hora || '06:00'}
                  onChange={(e) => updateAgendamento('hora', e.target.value)}
                  data-testid="input-hora"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Resumo Semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resumo Semanal
          </CardTitle>
          <CardDescription>Configurar geração automática de resumo após sincronização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Gerar resumo automaticamente</Label>
              <p className="text-sm text-slate-500">Após cada sincronização bem-sucedida</p>
            </div>
            <Switch
              checked={config.resumo_semanal?.gerar_automaticamente || false}
              onCheckedChange={(v) => updateResumo('gerar_automaticamente', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enviar email aos motoristas</Label>
              <p className="text-sm text-slate-500">Resumo individual de cada motorista</p>
            </div>
            <Switch
              checked={config.resumo_semanal?.enviar_email_motoristas || false}
              onCheckedChange={(v) => updateResumo('enviar_email_motoristas', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enviar WhatsApp aos motoristas</Label>
              <p className="text-sm text-slate-500">Resumo via WhatsApp Business API</p>
            </div>
            <Switch
              checked={config.resumo_semanal?.enviar_whatsapp_motoristas || false}
              onCheckedChange={(v) => updateResumo('enviar_whatsapp_motoristas', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações ao Parceiro
          </CardTitle>
          <CardDescription>Como pretende ser notificado sobre as sincronizações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-blue-600" />
                <span>Notificação no sistema</span>
              </div>
              <Switch
                checked={config.notificacoes?.notificacao_sistema || false}
                onCheckedChange={(v) => updateNotificacoes('notificacao_sistema', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-amber-600" />
                <span>Email</span>
              </div>
              <Switch
                checked={config.notificacoes?.email_parceiro || false}
                onCheckedChange={(v) => updateNotificacoes('email_parceiro', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <span>WhatsApp</span>
              </div>
              <Switch
                checked={config.notificacoes?.whatsapp_parceiro || false}
                onCheckedChange={(v) => updateNotificacoes('whatsapp_parceiro', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Histórico de Sincronizações
              </CardTitle>
              <CardDescription>Últimas {historico.length} sincronizações</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowHistorico(!showHistorico)}>
              {showHistorico ? 'Ocultar' : 'Ver Detalhes'}
            </Button>
          </div>
        </CardHeader>
        {showHistorico && (
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Nenhuma sincronização realizada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fontes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Iniciado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell>
                        {new Date(exec.created_at).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {exec.fontes?.map((f) => (
                            <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(exec.status)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {exec.iniciado_por === 'scheduler' ? 'Automático' : 'Manual'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Botão Guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSaveConfig} disabled={saving} data-testid="btn-guardar-config">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Configuração
        </Button>
      </div>
    </div>
  );
};

export default ConfigSincronizacao;
