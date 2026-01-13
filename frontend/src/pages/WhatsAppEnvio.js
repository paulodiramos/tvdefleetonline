import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  MessageCircle,
  Send,
  Users,
  User,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Phone,
  Settings,
  History
} from 'lucide-react';

const TEMPLATES_MENSAGEM = [
  {
    id: 'relatorio_semanal',
    nome: 'Relatório Semanal',
    icon: FileText,
    descricao: 'Enviar resumo dos ganhos da semana',
    variaveis: ['nome_motorista', 'periodo', 'total_ganhos', 'total_despesas', 'liquido']
  },
  {
    id: 'documento_expirando',
    nome: 'Documento a Expirar',
    icon: AlertCircle,
    descricao: 'Alertar sobre documento próximo do vencimento',
    variaveis: ['nome_motorista', 'tipo_documento', 'data_expiracao', 'dias_restantes']
  },
  {
    id: 'boas_vindas',
    nome: 'Boas-vindas',
    icon: User,
    descricao: 'Mensagem de boas-vindas para novos motoristas',
    variaveis: ['nome_motorista', 'nome_parceiro']
  },
  {
    id: 'personalizado',
    nome: 'Mensagem Personalizada',
    icon: MessageCircle,
    descricao: 'Escrever mensagem livre',
    variaveis: []
  }
];

const WhatsAppEnvio = ({ user, onLogout }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [selectedMotoristas, setSelectedMotoristas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [configWhatsApp, setConfigWhatsApp] = useState(null);
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [activeTab, setActiveTab] = useState('enviar');
  
  // Form state
  const [templateId, setTemplateId] = useState('personalizado');
  const [mensagem, setMensagem] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [resultados, setResultados] = useState([]);

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only motoristas with WhatsApp/phone
      const motoristasComTelefone = response.data.filter(m => m.whatsapp || m.phone);
      setMotoristas(motoristasComTelefone);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigWhatsApp = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${user.parceiro_id || user.id}/config-whatsapp`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigWhatsApp(response.data);
      if (!response.data?.ativo) {
        setShowConfigAlert(true);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp config:', error);
      setShowConfigAlert(true);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${user.parceiro_id || user.id}/whatsapp-historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(response.data || []);
    } catch (error) {
      console.error('Error fetching historico:', error);
    }
  };

  useEffect(() => {
    fetchMotoristas();
    fetchConfigWhatsApp();
    fetchHistorico();
  }, []);

  const handleSelectAll = () => {
    if (selectedMotoristas.length === filteredMotoristas.length) {
      setSelectedMotoristas([]);
    } else {
      setSelectedMotoristas(filteredMotoristas.map(m => m.id));
    }
  };

  const handleSelectMotorista = (motoristaId) => {
    setSelectedMotoristas(prev => 
      prev.includes(motoristaId)
        ? prev.filter(id => id !== motoristaId)
        : [...prev, motoristaId]
    );
  };

  const handleTemplateChange = (templateId) => {
    setTemplateId(templateId);
    
    // Set default message based on template
    const template = TEMPLATES_MENSAGEM.find(t => t.id === templateId);
    if (template && templateId !== 'personalizado') {
      switch (templateId) {
        case 'relatorio_semanal':
          setMensagem(`📊 *Relatório Semanal TVDEFleet*

Olá {nome_motorista}! 👋

Aqui está o seu resumo do período *{periodo}*:

💰 *Ganhos Brutos:* €{total_ganhos}
📉 *Despesas:* €{total_despesas}
✅ *Valor Líquido:* €{liquido}

Aceda à plataforma para ver o relatório completo.

_TVDEFleet - Gestão de Frotas TVDE_`);
          break;
        case 'documento_expirando':
          setMensagem(`⚠️ *Documento a Expirar*

Olá {nome_motorista}! 👋

O seu documento *{tipo_documento}* expira em *{dias_restantes} dias* ({data_expiracao}).

Por favor, renove o documento o mais rapidamente possível.

📱 Aceda à plataforma TVDEFleet para submeter o novo documento.

_TVDEFleet - Gestão de Frotas TVDE_`);
          break;
        case 'boas_vindas':
          setMensagem(`👋 *Bem-vindo à TVDEFleet!*

Olá {nome_motorista}!

O seu registo com *{nome_parceiro}* foi concluído com sucesso.

Através desta plataforma poderá:
✅ Consultar os seus ganhos semanais
📄 Submeter documentos
📊 Acompanhar relatórios

Se tiver alguma dúvida, contacte o seu parceiro.

_TVDEFleet - Gestão de Frotas TVDE_`);
          break;
        default:
          break;
      }
    } else {
      setMensagem('');
    }
  };

  const handleEnviar = async () => {
    if (selectedMotoristas.length === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    if (!mensagem.trim()) {
      toast.error('Escreva uma mensagem');
      return;
    }

    setSending(true);
    setResultados([]);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/parceiros/${user.parceiro_id || user.id}/whatsapp/enviar-motoristas`,
        {
          motorista_ids: selectedMotoristas,
          mensagem: mensagem,
          template_id: templateId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setResultados(response.data.resultados || []);
      
      const successCount = response.data.resultados?.filter(r => r.success).length || 0;
      const failCount = (response.data.resultados?.length || 0) - successCount;

      if (successCount > 0) {
        toast.success(`${successCount} mensagem(ns) enviada(s) com sucesso`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} mensagem(ns) falharam`);
      }

      // Refresh historico
      fetchHistorico();
      setShowPreview(true);

    } catch (error) {
      console.error('Error sending:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
  };

  const filteredMotoristas = motoristas.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone?.includes(searchQuery) ||
    m.whatsapp?.includes(searchQuery)
  );

  const getApiModeLabel = () => {
    if (!configWhatsApp?.ativo) return { label: 'Não Configurado', color: 'bg-red-500' };
    if (configWhatsApp?.access_token && configWhatsApp?.phone_number_id) {
      return { label: 'API Cloud', color: 'bg-green-500' };
    }
    return { label: 'Link wa.me', color: 'bg-yellow-500' };
  };

  const modeInfo = getApiModeLabel();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="whatsapp-envio-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">WhatsApp Business</h1>
              <p className="text-slate-600">Enviar mensagens aos motoristas via WhatsApp</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className={`${modeInfo.color} text-white`}>
              {modeInfo.label}
            </Badge>
            <Button variant="outline" asChild>
              <a href="/configuracoes-parceiro?tab=whatsapp">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
              </a>
            </Button>
          </div>
        </div>

        {/* Config Alert */}
        {showConfigAlert && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800">WhatsApp não configurado</p>
                <p className="text-sm text-yellow-600">
                  Configure as credenciais do WhatsApp Business para envio direto. 
                  Sem configuração, serão gerados links wa.me para envio manual.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/configuracoes-parceiro?tab=whatsapp">Configurar Agora</a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="enviar">
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensagem
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Select Motoristas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Selecionar Destinatários
                  </CardTitle>
                  <CardDescription>
                    {selectedMotoristas.length} de {filteredMotoristas.length} selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Pesquisar motoristas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedMotoristas.length === filteredMotoristas.length ? 'Desmarcar' : 'Selecionar'} Todos
                    </Button>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {loading ? (
                      <div className="text-center py-8 text-slate-500">A carregar...</div>
                    ) : filteredMotoristas.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        Nenhum motorista com telefone/WhatsApp
                      </div>
                    ) : (
                      filteredMotoristas.map(motorista => (
                        <div
                          key={motorista.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedMotoristas.includes(motorista.id) 
                              ? 'border-green-500 bg-green-50' 
                              : 'hover:bg-slate-50'
                          }`}
                          onClick={() => handleSelectMotorista(motorista.id)}
                        >
                          <Checkbox
                            checked={selectedMotoristas.includes(motorista.id)}
                            onCheckedChange={() => handleSelectMotorista(motorista.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{motorista.name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Phone className="w-3 h-3" />
                              {motorista.whatsapp || motorista.phone}
                            </div>
                          </div>
                          {motorista.whatsapp && (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              WhatsApp
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Compose Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Compor Mensagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select value={templateId} onValueChange={handleTemplateChange}>
                      <SelectTrigger data-testid="template-select">
                        <SelectValue placeholder="Selecionar template" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATES_MENSAGEM.map(template => {
                          const Icon = template.icon;
                          return (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {template.nome}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {templateId !== 'personalizado' && (
                      <p className="text-xs text-slate-500">
                        Variáveis: {TEMPLATES_MENSAGEM.find(t => t.id === templateId)?.variaveis.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mensagem">Mensagem</Label>
                    <Textarea
                      id="mensagem"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Escreva a sua mensagem..."
                      rows={10}
                      className="font-mono text-sm"
                      data-testid="mensagem-textarea"
                    />
                    <p className="text-xs text-slate-500">
                      {mensagem.length} caracteres • Use *texto* para negrito
                    </p>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleEnviar}
                    disabled={sending || selectedMotoristas.length === 0 || !mensagem.trim()}
                    data-testid="enviar-btn"
                  >
                    {sending ? (
                      <>A enviar...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar para {selectedMotoristas.length} motorista(s)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Results Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Resultados do Envio</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {resultados.map((resultado, index) => {
                    const motorista = motoristas.find(m => m.id === resultado.motorista_id);
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          resultado.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {resultado.success ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">{motorista?.name || resultado.motorista_id}</p>
                            <p className="text-xs text-slate-500">
                              {resultado.mode === 'web_link' ? 'Link gerado' : 'Enviado via API'}
                            </p>
                          </div>
                        </div>
                        {resultado.link && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={resultado.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Abrir
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Mensagens</CardTitle>
                <CardDescription>Últimas mensagens enviadas via WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">Nenhuma mensagem enviada ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historico.map((item, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          item.status === 'sent' ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                          {item.status === 'sent' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <ExternalLink className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{item.to_phone}</p>
                            <p className="text-xs text-slate-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {new Date(item.sent_at).toLocaleString('pt-PT')}
                            </p>
                          </div>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {item.message}
                          </p>
                          <Badge variant="outline" className="mt-2">
                            {item.api_mode === 'cloud_api' ? 'API Cloud' : 'Link wa.me'}
                          </Badge>
                        </div>
                      </div>
                    ))}
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

export default WhatsAppEnvio;
