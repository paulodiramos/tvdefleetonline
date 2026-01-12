import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  ArrowLeft, Mail, Lock, Server, Send, Eye, EyeOff, 
  Car, Shield, Save, Loader2, TestTube, CheckCircle, AlertCircle,
  MessageCircle, Phone, ExternalLink
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ConfiguracoesParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('email');
  
  // Estado para mostrar/esconder passwords
  const [showPasswords, setShowPasswords] = useState({
    smtp: false,
    uber: false,
    bolt: false,
    viaverde: false
  });
  
  // Configuração de Email
  const [configEmail, setConfigEmail] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_usuario: '',
    smtp_password: '',
    email_remetente: '',
    nome_remetente: '',
    usar_tls: true,
    ativo: false
  });
  
  // Configuração de WhatsApp
  const [configWhatsApp, setConfigWhatsApp] = useState({
    telefone: '',
    nome_exibicao: '',
    mensagem_boas_vindas: '',
    mensagem_relatorio: '',
    ativo: false,
    enviar_relatorios_semanais: true,
    enviar_alertas_documentos: true,
    enviar_alertas_veiculos: true
  });
  
  // Credenciais de Plataformas
  const [credenciais, setCredenciais] = useState({
    uber_email: '',
    uber_telefone: '',
    uber_password: '',
    bolt_email: '',
    bolt_password: '',
    viaverde_usuario: '',
    viaverde_password: ''
  });

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Buscar configurações de email
      try {
        const emailRes = await axios.get(`${API}/api/parceiros/${user.id}/config-email`, { headers });
        if (emailRes.data) {
          setConfigEmail(prev => ({ ...prev, ...emailRes.data }));
        }
      } catch (e) { /* ignore */ }
      
      // Buscar configurações de WhatsApp
      try {
        const whatsappRes = await axios.get(`${API}/api/parceiros/${user.id}/config-whatsapp`, { headers });
        if (whatsappRes.data) {
          setConfigWhatsApp(prev => ({ ...prev, ...whatsappRes.data }));
        }
      } catch (e) { /* ignore */ }
      
      // Buscar credenciais de plataformas
      try {
        const credsRes = await axios.get(`${API}/api/parceiros/${user.id}/credenciais-plataformas`, { headers });
        if (credsRes.data) {
          setCredenciais(prev => ({ ...prev, ...credsRes.data }));
        }
      } catch (e) { /* ignore */ }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/parceiros/${user.id}/config-email`,
        configEmail,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração de email guardada!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTestarEmail = async () => {
    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/parceiros/${user.id}/config-email/testar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message || 'Email de teste enviado!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar email de teste');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/parceiros/${user.id}/config-whatsapp`,
        configWhatsApp,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração de WhatsApp guardada!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTestarWhatsApp = async () => {
    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/parceiros/${user.id}/whatsapp/enviar-teste`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.whatsapp_link) {
        window.open(response.data.whatsapp_link, '_blank');
        toast.success('Link WhatsApp aberto!');
      } else {
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao testar WhatsApp');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCredenciais = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/parceiros/${user.id}/credenciais-plataformas`,
        credenciais,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Credenciais guardadas!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar credenciais');
    } finally {
      setSaving(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
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
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
            <p className="text-sm text-slate-500">Email, WhatsApp e credenciais</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="credenciais" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Plataformas
            </TabsTrigger>
          </TabsList>

          {/* Tab Email SMTP */}
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Configuração de Email SMTP
                </CardTitle>
                <CardDescription>
                  Configure o seu servidor de email para enviar relatórios aos motoristas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {configEmail.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="font-medium">
                      {configEmail.ativo ? 'Email SMTP Ativo' : 'Email SMTP Inativo'}
                    </span>
                  </div>
                  <Switch
                    checked={configEmail.ativo}
                    onCheckedChange={(checked) => setConfigEmail(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Servidor SMTP</Label>
                    <Input
                      placeholder="smtp.gmail.com"
                      value={configEmail.smtp_host}
                      onChange={(e) => setConfigEmail(prev => ({ ...prev, smtp_host: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input
                      type="number"
                      placeholder="587"
                      value={configEmail.smtp_port}
                      onChange={(e) => setConfigEmail(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Utilizador/Email</Label>
                    <Input
                      placeholder="seu@email.com"
                      value={configEmail.smtp_usuario}
                      onChange={(e) => setConfigEmail(prev => ({ ...prev, smtp_usuario: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.smtp ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={configEmail.smtp_password}
                        onChange={(e) => setConfigEmail(prev => ({ ...prev, smtp_password: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => togglePasswordVisibility('smtp')}
                      >
                        {showPasswords.smtp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Remetente</Label>
                    <Input
                      placeholder="A Sua Empresa"
                      value={configEmail.nome_remetente}
                      onChange={(e) => setConfigEmail(prev => ({ ...prev, nome_remetente: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Remetente</Label>
                    <Input
                      placeholder="noreply@empresa.com"
                      value={configEmail.email_remetente}
                      onChange={(e) => setConfigEmail(prev => ({ ...prev, email_remetente: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={configEmail.usar_tls}
                    onCheckedChange={(checked) => setConfigEmail(prev => ({ ...prev, usar_tls: checked }))}
                  />
                  <Label>Usar TLS (recomendado)</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveEmail} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={handleTestarEmail} disabled={testing || !configEmail.smtp_host}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TestTube className="w-4 h-4 mr-2" />}
                    Testar Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  Configuração de WhatsApp
                </CardTitle>
                <CardDescription>
                  Configure o WhatsApp para enviar mensagens aos motoristas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    {configWhatsApp.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="font-medium text-green-800">
                      {configWhatsApp.ativo ? 'WhatsApp Ativo' : 'WhatsApp Inativo'}
                    </span>
                  </div>
                  <Switch
                    checked={configWhatsApp.ativo}
                    onCheckedChange={(checked) => setConfigWhatsApp(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número de WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="+351 9XX XXX XXX"
                        value={configWhatsApp.telefone}
                        onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, telefone: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-slate-500">Inclua o código do país (+351)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome de Exibição</Label>
                    <Input
                      placeholder="Nome da sua empresa"
                      value={configWhatsApp.nome_exibicao}
                      onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, nome_exibicao: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem de Boas-Vindas (opcional)</Label>
                  <Textarea
                    placeholder="Olá! Bem-vindo à nossa frota. Este é o canal de comunicação oficial..."
                    value={configWhatsApp.mensagem_boas_vindas}
                    onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, mensagem_boas_vindas: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Template de Relatório Semanal (opcional)</Label>
                  <Textarea
                    placeholder="Olá {nome}! Segue o seu relatório semanal..."
                    value={configWhatsApp.mensagem_relatorio}
                    onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, mensagem_relatorio: e.target.value }))}
                    rows={3}
                  />
                  <p className="text-xs text-slate-500">Use {'{nome}'}, {'{semana}'}, {'{total}'} para variáveis</p>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-sm">Notificações Automáticas</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Relatórios semanais</Label>
                      <Switch
                        checked={configWhatsApp.enviar_relatorios_semanais}
                        onCheckedChange={(checked) => setConfigWhatsApp(prev => ({ ...prev, enviar_relatorios_semanais: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Alertas de documentos</Label>
                      <Switch
                        checked={configWhatsApp.enviar_alertas_documentos}
                        onCheckedChange={(checked) => setConfigWhatsApp(prev => ({ ...prev, enviar_alertas_documentos: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Alertas de veículos</Label>
                      <Switch
                        checked={configWhatsApp.enviar_alertas_veiculos}
                        onCheckedChange={(checked) => setConfigWhatsApp(prev => ({ ...prev, enviar_alertas_veiculos: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveWhatsApp} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={handleTestarWhatsApp} disabled={testing || !configWhatsApp.telefone}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Testar WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Credenciais Plataformas */}
          <TabsContent value="credenciais" className="space-y-4">
            {/* Uber */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">U</span>
                  </div>
                  Uber
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      placeholder="email@uber.com"
                      value={credenciais.uber_email}
                      onChange={(e) => setCredenciais(prev => ({ ...prev, uber_email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telemóvel</Label>
                    <Input
                      placeholder="+351 9XX XXX XXX"
                      value={credenciais.uber_telefone}
                      onChange={(e) => setCredenciais(prev => ({ ...prev, uber_telefone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.uber ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={credenciais.uber_password}
                        onChange={(e) => setCredenciais(prev => ({ ...prev, uber_password: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => togglePasswordVisibility('uber')}
                      >
                        {showPasswords.uber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bolt */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">B</span>
                  </div>
                  Bolt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      placeholder="email@bolt.eu"
                      value={credenciais.bolt_email}
                      onChange={(e) => setCredenciais(prev => ({ ...prev, bolt_email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.bolt ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={credenciais.bolt_password}
                        onChange={(e) => setCredenciais(prev => ({ ...prev, bolt_password: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => togglePasswordVisibility('bolt')}
                      >
                        {showPasswords.bolt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Via Verde */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">VV</span>
                  </div>
                  Via Verde
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Utilizador</Label>
                    <Input
                      placeholder="username"
                      value={credenciais.viaverde_usuario}
                      onChange={(e) => setCredenciais(prev => ({ ...prev, viaverde_usuario: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.viaverde ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={credenciais.viaverde_password}
                        onChange={(e) => setCredenciais(prev => ({ ...prev, viaverde_password: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => togglePasswordVisibility('viaverde')}
                      >
                        {showPasswords.viaverde ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveCredenciais} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Credenciais
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ConfiguracoesParceiro;
