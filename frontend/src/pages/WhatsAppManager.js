import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageCircle, QrCode, RefreshCw, Loader2, CheckCircle, XCircle, 
  Send, Users, History, Settings, LogOut, Smartphone, AlertTriangle,
  FileText, Bell, Calendar
} from 'lucide-react';

const WhatsAppManager = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [polling, setPolling] = useState(false);
  const [motoristas, setMotoristas] = useState([]);
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [alertsConfig, setAlertsConfig] = useState(null);
  
  // Message form state
  const [selectedMotoristas, setSelectedMotoristas] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Individual message state
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [individualPhone, setIndividualPhone] = useState('');
  const [individualMessage, setIndividualMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setStatus(data);
      return data;
    } catch (error) {
      console.error('Error fetching status:', error);
      setStatus({ connected: false, ready: false, error: 'Erro ao verificar estado' });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQrCode = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/qr`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.qrCode) {
        setQrData(data.qrCode);
      } else if (data.connected) {
        setQrData(null);
        setPolling(false);
        fetchStatus();
      }
      return data;
    } catch (error) {
      console.error('Error fetching QR:', error);
      return null;
    }
  }, [fetchStatus]);

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const motoristasComTelefone = (data.motoristas || data).filter(
          m => m.whatsapp || m.phone
        );
        setMotoristas(motoristasComTelefone);
      }
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/history?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchAlertsConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/alerts-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlertsConfig(data);
      }
    } catch (error) {
      console.error('Error fetching alerts config:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMotoristas();
    fetchHistory();
    fetchTemplates();
    fetchAlertsConfig();
  }, [fetchStatus]);

  // Polling for QR code
  useEffect(() => {
    let interval;
    if (polling) {
      interval = setInterval(async () => {
        const statusData = await fetchStatus();
        if (statusData?.ready) {
          setPolling(false);
          setQrData(null);
          toast.success('WhatsApp conectado com sucesso!');
        } else if (!statusData?.ready) {
          await fetchQrCode();
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, fetchStatus, fetchQrCode]);

  const handleConnect = async () => {
    setPolling(true);
    await fetchQrCode();
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/whatsapp-web/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('WhatsApp desconectado');
      setStatus({ connected: false, ready: false });
      setQrData(null);
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  const handleRestart = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/whatsapp-web/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.info('A reiniciar sessão...');
      setTimeout(() => {
        setPolling(true);
        fetchQrCode();
      }, 3000);
    } catch (error) {
      toast.error('Erro ao reiniciar');
    }
  };

  const handleSendMessage = async () => {
    if (selectedMotoristas.length === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }
    if (!messageText.trim()) {
      toast.error('Escreva uma mensagem');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      
      if (selectedMotoristas.length === 1) {
        // Send to single motorista
        const motorista = motoristas.find(m => m.id === selectedMotoristas[0]);
        const response = await fetch(`${API}/whatsapp-web/send-to-motorista/${selectedMotoristas[0]}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: messageText })
        });
        const result = await response.json();
        
        if (result.success) {
          toast.success(`Mensagem enviada para ${motorista?.nome || 'motorista'}`);
          setMessageText('');
          setSelectedMotoristas([]);
          fetchHistory();
        } else {
          toast.error(result.error || 'Erro ao enviar');
        }
      } else {
        // Send to multiple
        const recipients = selectedMotoristas.map(id => {
          const m = motoristas.find(mot => mot.id === id);
          return {
            phone: m?.whatsapp || m?.phone,
            name: m?.nome,
            motorista_id: id
          };
        });

        const response = await fetch(`${API}/whatsapp-web/send-bulk`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipients, message: messageText })
        });
        const result = await response.json();
        
        toast.success(`Enviadas ${result.sent}/${result.total} mensagens`);
        setMessageText('');
        setSelectedMotoristas([]);
        fetchHistory();
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleSendToAll = async () => {
    if (!messageText.trim()) {
      toast.error('Escreva uma mensagem');
      return;
    }

    if (!confirm(`Enviar mensagem para ${motoristas.length} motoristas?`)) {
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/send-to-all-motoristas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageText })
      });
      const result = await response.json();
      
      toast.success(`Enviadas ${result.sent}/${result.total} mensagens`);
      setMessageText('');
      fetchHistory();
    } catch (error) {
      toast.error('Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
  };

  const handleSendIndividual = async () => {
    if (!individualPhone.trim() || !individualMessage.trim()) {
      toast.error('Preencha o telefone e a mensagem');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-web/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: individualPhone, message: individualMessage })
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Mensagem enviada!');
        setShowIndividualModal(false);
        setIndividualPhone('');
        setIndividualMessage('');
        fetchHistory();
      } else {
        toast.error(result.error || 'Erro ao enviar');
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleSaveAlertsConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/whatsapp-web/alerts-config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertsConfig)
      });
      toast.success('Configurações guardadas');
    } catch (error) {
      toast.error('Erro ao guardar configurações');
    }
  };

  const useTemplate = (template) => {
    setMessageText(template.mensagem);
    setShowTemplates(false);
  };

  const toggleMotoristaSelecion = (id) => {
    setSelectedMotoristas(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  const selectAllMotoristas = () => {
    if (selectedMotoristas.length === motoristas.length) {
      setSelectedMotoristas([]);
    } else {
      setSelectedMotoristas(motoristas.map(m => m.id));
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-600" />
              WhatsApp
            </h1>
            <p className="text-slate-600">Envie mensagens e alertas aos motoristas</p>
          </div>
          <div className="flex gap-2">
            {status?.ready && (
              <>
                <Button variant="outline" onClick={handleRestart}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reiniciar
                </Button>
                <Button variant="destructive" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Connection Status Card */}
        <Card className={`mb-6 ${status?.ready ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {status?.ready ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">WhatsApp Conectado</p>
                      <p className="text-sm text-green-700">
                        {status.clientInfo?.pushname || 'Sessão ativa'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-800">WhatsApp Desconectado</p>
                      <p className="text-sm text-amber-700">
                        {status?.error || 'Escaneie o QR code para conectar'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {!status?.ready && (
                <Button 
                  onClick={handleConnect} 
                  disabled={polling}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {polling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      A conectar...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 mr-2" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* QR Code Display */}
            {qrData && (
              <div className="mt-6 flex flex-col items-center p-6 bg-white rounded-lg border">
                <p className="text-sm text-slate-600 mb-4">
                  Abra o WhatsApp no telemóvel → Definições → Dispositivos ligados → Ligar um dispositivo
                </p>
                <img src={qrData} alt="QR Code WhatsApp" className="w-64 h-64" />
                <p className="text-xs text-slate-500 mt-4">O QR code atualiza automaticamente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content - Only show when connected */}
        {status?.ready && (
          <Tabs defaultValue="enviar" className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="enviar" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar
              </TabsTrigger>
              <TabsTrigger value="motoristas" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Motoristas
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Config
              </TabsTrigger>
            </TabsList>

            {/* Send Message Tab */}
            <TabsContent value="enviar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Message Composer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      Compor Mensagem
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Mensagem</Label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowTemplates(true)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Templates
                        </Button>
                      </div>
                      <Textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Escreva a sua mensagem... Use {nome} para personalizar"
                        rows={6}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {messageText.length}/1000 caracteres
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSendMessage}
                        disabled={sending || selectedMotoristas.length === 0}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar ({selectedMotoristas.length})
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowIndividualModal(true)}
                      >
                        <Smartphone className="w-4 h-4" />
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleSendToAll}
                      disabled={sending || motoristas.length === 0}
                      className="w-full"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Enviar a Todos ({motoristas.length})
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Select Motoristas */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Destinatários
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={selectAllMotoristas}>
                        {selectedMotoristas.length === motoristas.length ? 'Limpar' : 'Todos'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {motoristas.map(motorista => (
                        <div
                          key={motorista.id}
                          onClick={() => toggleMotoristaSelecion(motorista.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedMotoristas.includes(motorista.id)
                              ? 'bg-green-50 border-green-300'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{motorista.nome}</p>
                              <p className="text-sm text-slate-500">
                                {motorista.whatsapp || motorista.phone}
                              </p>
                            </div>
                            {selectedMotoristas.includes(motorista.id) && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        </div>
                      ))}
                      {motoristas.length === 0 && (
                        <p className="text-center text-slate-500 py-8">
                          Nenhum motorista com WhatsApp
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Motoristas Tab */}
            <TabsContent value="motoristas">
              <Card>
                <CardHeader>
                  <CardTitle>Motoristas com WhatsApp</CardTitle>
                  <CardDescription>
                    {motoristas.length} motoristas com número de telefone registado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>WhatsApp/Telefone</TableHead>
                        <TableHead>Última Mensagem</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {motoristas.map(motorista => (
                        <TableRow key={motorista.id}>
                          <TableCell className="font-medium">{motorista.nome}</TableCell>
                          <TableCell>{motorista.whatsapp || motorista.phone}</TableCell>
                          <TableCell className="text-slate-500">-</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedMotoristas([motorista.id]);
                                setShowIndividualModal(true);
                                setIndividualPhone(motorista.whatsapp || motorista.phone);
                              }}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="historico">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Histórico de Mensagens</CardTitle>
                    <Button variant="outline" size="sm" onClick={fetchHistory}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((log, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">
                            {new Date(log.data).toLocaleString('pt-PT')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.tipo}</Badge>
                          </TableCell>
                          <TableCell>{log.motorista_nome || log.telefone}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.mensagem}
                          </TableCell>
                          <TableCell>
                            {log.status === 'enviado' ? (
                              <Badge className="bg-green-100 text-green-800">Enviado</Badge>
                            ) : (
                              <Badge variant="destructive">Erro</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {history.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                            Nenhuma mensagem enviada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Alertas Automáticos
                  </CardTitle>
                  <CardDescription>
                    Configure quais alertas são enviados automaticamente por WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {alertsConfig && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Alertas de Documentos</Label>
                            <p className="text-sm text-slate-500">
                              Notificar quando documentos estão a expirar
                            </p>
                          </div>
                          <Switch
                            checked={alertsConfig.alertas_documentos}
                            onCheckedChange={(checked) => 
                              setAlertsConfig(prev => ({...prev, alertas_documentos: checked}))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Alertas de Manutenção</Label>
                            <p className="text-sm text-slate-500">
                              Notificar sobre manutenções agendadas
                            </p>
                          </div>
                          <Switch
                            checked={alertsConfig.alertas_manutencao}
                            onCheckedChange={(checked) => 
                              setAlertsConfig(prev => ({...prev, alertas_manutencao: checked}))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Alertas de Vencimentos</Label>
                            <p className="text-sm text-slate-500">
                              Seguros, inspeções, extintores
                            </p>
                          </div>
                          <Switch
                            checked={alertsConfig.alertas_vencimentos}
                            onCheckedChange={(checked) => 
                              setAlertsConfig(prev => ({...prev, alertas_vencimentos: checked}))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Relatório Semanal</Label>
                            <p className="text-sm text-slate-500">
                              Enviar resumo semanal aos motoristas
                            </p>
                          </div>
                          <Switch
                            checked={alertsConfig.relatorio_semanal}
                            onCheckedChange={(checked) => 
                              setAlertsConfig(prev => ({...prev, relatorio_semanal: checked}))
                            }
                          />
                        </div>

                        <div className="pt-4 border-t">
                          <Label>Dias de Antecedência</Label>
                          <p className="text-sm text-slate-500 mb-2">
                            Quantos dias antes enviar alertas de vencimento
                          </p>
                          <Select
                            value={String(alertsConfig.dias_antecedencia)}
                            onValueChange={(value) => 
                              setAlertsConfig(prev => ({...prev, dias_antecedencia: parseInt(value)}))
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3 dias</SelectItem>
                              <SelectItem value="5">5 dias</SelectItem>
                              <SelectItem value="7">7 dias</SelectItem>
                              <SelectItem value="14">14 dias</SelectItem>
                              <SelectItem value="30">30 dias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button onClick={handleSaveAlertsConfig} className="w-full">
                        Guardar Configurações
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Templates Modal */}
        <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Templates de Mensagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => useTemplate(template)}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  <p className="font-medium mb-1">{template.nome}</p>
                  <p className="text-sm text-slate-600">{template.mensagem}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Individual Message Modal */}
        <Dialog open={showIndividualModal} onOpenChange={setShowIndividualModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Mensagem Individual</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Número de Telefone</Label>
                <Input
                  value={individualPhone}
                  onChange={(e) => setIndividualPhone(e.target.value)}
                  placeholder="912345678"
                />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea
                  value={individualMessage}
                  onChange={(e) => setIndividualMessage(e.target.value)}
                  placeholder="Escreva a mensagem..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowIndividualModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendIndividual} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default WhatsAppManager;
