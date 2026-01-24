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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  ArrowLeft, Mail, Lock, Server, Send, Eye, EyeOff, 
  Car, Shield, Save, Loader2, TestTube, CheckCircle, AlertCircle,
  MessageCircle, Phone, ExternalLink, HelpCircle, Key, Copy, Check, ShieldCheck,
  HardDrive, FolderOpen, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Componente de Guia para Gmail 2FA App Password
const GmailAppPasswordGuide = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [open, setOpen] = useState(false);
  
  const steps = [
    {
      number: 1,
      title: "Aceder às Configurações Google",
      description: "Clique no botão abaixo para aceder diretamente à página de Senhas de Aplicação da sua conta Google.",
      icon: <ExternalLink className="w-8 h-8" />,
      action: (
        <Button 
          onClick={() => window.open('https://myaccount.google.com/apppasswords', '_blank')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Abrir Configurações Google
        </Button>
      ),
      note: "Pode ser necessário fazer login na sua conta Google"
    },
    {
      number: 2,
      title: "Selecionar Aplicação",
      description: "Na página que abriu, em 'Selecionar aplicação', escolha 'Correio' ou 'Mail'.",
      icon: <Mail className="w-8 h-8" />,
      tip: "Se não aparecer esta opção, verifique se tem a verificação em 2 passos ativada"
    },
    {
      number: 3,
      title: "Selecionar Dispositivo",
      description: "Em 'Selecionar dispositivo', escolha 'Outro (nome personalizado)' e escreva 'TVDEFleet'.",
      icon: <Server className="w-8 h-8" />,
      tip: "Pode usar qualquer nome que o ajude a identificar esta aplicação"
    },
    {
      number: 4,
      title: "Gerar Senha",
      description: "Clique no botão 'Gerar'. O Google vai criar uma senha de 16 caracteres (exemplo: abcd efgh ijkl mnop).",
      icon: <Key className="w-8 h-8" />,
      important: "IMPORTANTE: Esta senha só aparece uma vez! Copie-a antes de fechar."
    },
    {
      number: 5,
      title: "Usar a Senha",
      description: "Copie a senha gerada (sem espaços) e cole no campo 'Password' da configuração SMTP. NÃO use a sua password normal do Gmail.",
      icon: <Copy className="w-8 h-8" />,
      action: (
        <Button 
          onClick={() => {
            setOpen(false);
            toast.success('Agora cole a senha de aplicação no campo Password!');
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="w-4 h-4 mr-2" />
          Já copiei, fechar guia
        </Button>
      )
    }
  ];

  const currentStepData = steps[currentStep - 1];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50">
          <HelpCircle className="w-4 h-4 mr-2" />
          Como criar Senha de Aplicação?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-6 h-6 text-amber-600" />
            Gmail: Criar Senha de Aplicação (2FA)
          </DialogTitle>
          <DialogDescription>
            Quando tem autenticação de 2 fatores, o Gmail exige uma senha especial
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-2">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  currentStep === step.number 
                    ? 'bg-amber-500 text-white scale-110' 
                    : currentStep > step.number 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-6 h-1 mx-1 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="bg-slate-50 rounded-xl p-6 min-h-[220px]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              {currentStepData.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">
                Passo {currentStepData.number}: {currentStepData.title}
              </h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                {currentStepData.description}
              </p>
              
              {currentStepData.tip && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-blue-800 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Dica:</strong> {currentStepData.tip}</span>
                  </p>
                </div>
              )}
              
              {currentStepData.note && (
                <p className="text-slate-500 text-sm mb-4">
                  ℹ️ {currentStepData.note}
                </p>
              )}
              
              {currentStepData.important && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-800 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{currentStepData.important}</span>
                  </p>
                </div>
              )}
              
              {currentStepData.action && (
                <div className="mt-4">
                  {currentStepData.action}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual Aid for Step 4 */}
        {currentStep === 4 && (
          <div className="bg-white border-2 border-dashed border-amber-300 rounded-lg p-4 mt-4 text-center">
            <p className="text-slate-500 mb-2">A senha gerada terá este formato:</p>
            <div className="font-mono text-2xl tracking-widest bg-amber-50 p-3 rounded">
              <span className="text-amber-600">abcd</span>
              <span className="text-slate-400 mx-1"> </span>
              <span className="text-amber-600">efgh</span>
              <span className="text-slate-400 mx-1"> </span>
              <span className="text-amber-600">ijkl</span>
              <span className="text-slate-400 mx-1"> </span>
              <span className="text-amber-600">mnop</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Copie sem os espaços: abcdefghijklmnop</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            ← Anterior
          </Button>
          
          <div className="flex gap-2">
            {currentStep < steps.length && (
              <Button 
                onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                className="bg-amber-500 hover:bg-amber-600"
              >
                Próximo →
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
    viaverde: false,
    terabox: false,
    whatsapp: false
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
  
  // Configuração de WhatsApp Cloud API
  const [configWhatsApp, setConfigWhatsApp] = useState({
    phone_number_id: '',
    access_token: '',
    business_account_id: '',
    ativo: false
  });
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  
  // Configuração de Terabox
  const [configTerabox, setConfigTerabox] = useState({
    cookie: '',
    pasta_raiz: '/TVDEFleet',
    ativo: false,
    sincronizar_documentos: true,
    sincronizar_relatorios: true,
    sincronizar_vistorias: true
  });
  const [teraboxStatus, setTeraboxStatus] = useState(null);
  const [testingTerabox, setTestingTerabox] = useState(false);
  
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
      
      // Buscar configurações de WhatsApp Cloud API
      try {
        const whatsappRes = await axios.get(`${API}/api/whatsapp/config`, { headers });
        if (whatsappRes.data) {
          setConfigWhatsApp(prev => ({ 
            ...prev, 
            phone_number_id: whatsappRes.data.phone_number_id || '',
            business_account_id: whatsappRes.data.business_account_id || '',
            ativo: whatsappRes.data.ativo || false
          }));
          if (whatsappRes.data.access_token_configured) {
            setWhatsappStatus({ configured: true });
          }
        }
      } catch (e) { /* ignore */ }
      
      // Buscar configurações de Terabox
      try {
        const teraboxRes = await axios.get(`${API}/api/terabox/credentials`, { headers });
        if (teraboxRes.data) {
          setConfigTerabox(prev => ({ ...prev, ...teraboxRes.data }));
          if (teraboxRes.data.cookie) {
            setTeraboxStatus({ conectado: true });
          }
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

  const handleSaveTerabox = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/terabox/credentials`,
        configTerabox,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração de Terabox guardada!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTestarTerabox = async () => {
    try {
      setTestingTerabox(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/api/terabox/cloud/test-connection`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setTeraboxStatus({ conectado: true, info: res.data });
        toast.success('Conexão Terabox verificada com sucesso!');
      } else {
        setTeraboxStatus({ conectado: false, erro: res.data.message });
        toast.error(res.data.message || 'Falha na conexão');
      }
    } catch (error) {
      setTeraboxStatus({ conectado: false, erro: error.response?.data?.detail });
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTestingTerabox(false);
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
        `${API}/api/whatsapp/config`,
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
      setTestingWhatsApp(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/whatsapp/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setWhatsappStatus({ 
          configured: true, 
          phone: response.data.phone_number,
          name: response.data.verified_name
        });
        toast.success(`Conectado! Número: ${response.data.phone_number}`);
      }
    } catch (error) {
      setWhatsappStatus({ configured: false, error: error.response?.data?.detail });
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTestingWhatsApp(false);
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
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="terabox" className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Terabox
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
                    <div className="flex items-center justify-between">
                      <Label>Password</Label>
                      {(configEmail.smtp_host?.toLowerCase().includes('gmail') || 
                        configEmail.smtp_usuario?.toLowerCase().includes('gmail')) && (
                        <GmailAppPasswordGuide />
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showPasswords.smtp ? 'text' : 'password'}
                        placeholder={configEmail.smtp_host?.toLowerCase().includes('gmail') ? "Cole a Senha de Aplicação aqui" : "••••••••"}
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

                {/* Alerta Gmail 2FA */}
                {(configEmail.smtp_host?.toLowerCase().includes('gmail') || 
                  configEmail.smtp_usuario?.toLowerCase().includes('gmail')) && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Gmail com Verificação em 2 Passos?</strong>
                      <p className="text-sm mt-1">
                        Se a sua conta Gmail tem autenticação de 2 fatores ativada, precisa usar uma 
                        <strong> Senha de Aplicação</strong> em vez da sua password normal.
                      </p>
                      <div className="mt-2">
                        <GmailAppPasswordGuide />
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

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

          {/* Tab WhatsApp Cloud API */}
          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  WhatsApp Business Cloud API
                </CardTitle>
                <CardDescription>
                  Configure a API oficial da Meta para enviar mensagens aos motoristas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    {whatsappStatus?.configured ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="font-medium text-green-800">
                      {whatsappStatus?.configured 
                        ? `Conectado: ${whatsappStatus.phone || 'Verificado'}`
                        : 'WhatsApp Não Configurado'}
                    </span>
                  </div>
                  <Switch
                    checked={configWhatsApp.ativo}
                    onCheckedChange={(checked) => setConfigWhatsApp(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>

                {/* Guia de Configuração */}
                <Alert className="bg-blue-50 border-blue-200">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Como configurar (grátis até 1000 msgs/mês):</strong>
                    <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                      <li>
                        Aceda a{' '}
                        <a 
                          href="https://developers.facebook.com/apps" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 underline font-medium"
                        >
                          developers.facebook.com/apps
                        </a>
                      </li>
                      <li>Clique "Criar Aplicação" → Selecione "Empresa" → "WhatsApp"</li>
                      <li>No painel do WhatsApp, copie o <strong>Phone Number ID</strong></li>
                      <li>Gere um <strong>Access Token</strong> permanente</li>
                      <li>Cole os valores abaixo e clique "Testar Conexão"</li>
                    </ol>
                    <div className="mt-3 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
                        className="text-blue-600 border-blue-300"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Abrir Meta Developers
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open('https://developers.facebook.com/docs/whatsapp/cloud-api/get-started', '_blank')}
                        className="text-blue-600 border-blue-300"
                      >
                        <HelpCircle className="w-3 h-3 mr-1" />
                        Documentação
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Campos de Configuração */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number ID *</Label>
                    <Input
                      placeholder="Ex: 123456789012345"
                      value={configWhatsApp.phone_number_id}
                      onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    />
                    <p className="text-xs text-slate-500">Encontre em: WhatsApp → API Setup → Phone Number ID</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Access Token *</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.whatsapp ? 'text' : 'password'}
                        placeholder="Cole o Access Token aqui"
                        value={configWhatsApp.access_token}
                        onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, access_token: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPasswords(prev => ({ ...prev, whatsapp: !prev.whatsapp }))}
                      >
                        {showPasswords.whatsapp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">Gere um token permanente em: Business Settings → System Users</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Business Account ID (opcional)</Label>
                    <Input
                      placeholder="Ex: 123456789012345"
                      value={configWhatsApp.business_account_id}
                      onChange={(e) => setConfigWhatsApp(prev => ({ ...prev, business_account_id: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSaveWhatsApp} 
                    disabled={saving} 
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleTestarWhatsApp} 
                    disabled={testingWhatsApp || !configWhatsApp.phone_number_id || !configWhatsApp.access_token}
                  >
                    {testingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TestTube className="w-4 h-4 mr-2" />}
                    Testar Conexão
                  </Button>
                </div>

                {/* Info sobre custos */}
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                  <strong>💡 Sobre custos:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    <li>1000 conversas grátis por mês</li>
                    <li>Depois: ~€0.04 por conversa</li>
                    <li>Sem necessidade de telemóvel ligado 24/7</li>
                    <li>100% fiável e oficial da Meta</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Terabox */}
          <TabsContent value="terabox" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-blue-600" />
                  Configuração de Terabox
                </CardTitle>
                <CardDescription>
                  Configure o armazenamento em nuvem Terabox para guardar documentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    {teraboxStatus?.conectado ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="font-medium text-blue-800">
                      {teraboxStatus?.conectado ? 'Terabox Conectado' : 'Terabox Não Configurado'}
                    </span>
                  </div>
                  <Switch
                    checked={configTerabox.ativo}
                    onCheckedChange={(checked) => setConfigTerabox(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>

                <Alert>
                  <HelpCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Como obter o Cookie do Terabox:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Aceda a <a href="https://www.terabox.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">terabox.com</a> e faça login</li>
                      <li>Abra as Ferramentas de Desenvolvedor (F12)</li>
                      <li>Vá ao separador &quot;Application&quot; ou &quot;Storage&quot;</li>
                      <li>Procure por &quot;Cookies&quot; → &quot;terabox.com&quot;</li>
                      <li>Copie o valor do cookie &quot;ndus&quot; ou &quot;BDUSS&quot;</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Cookie de Autenticação</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type={showPasswords.terabox ? "text" : "password"}
                      placeholder="ndus=xxx ou BDUSS=xxx"
                      value={configTerabox.cookie}
                      onChange={(e) => setConfigTerabox(prev => ({ ...prev, cookie: e.target.value }))}
                      className="pl-10 pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, terabox: !prev.terabox }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.terabox ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pasta Raiz no Terabox</Label>
                  <div className="relative">
                    <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="/TVDEFleet"
                      value={configTerabox.pasta_raiz}
                      onChange={(e) => setConfigTerabox(prev => ({ ...prev, pasta_raiz: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-slate-500">Pasta onde os documentos serão guardados</p>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-sm">Sincronização Automática</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Documentos dos motoristas</Label>
                      <Switch
                        checked={configTerabox.sincronizar_documentos}
                        onCheckedChange={(checked) => setConfigTerabox(prev => ({ ...prev, sincronizar_documentos: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Relatórios semanais</Label>
                      <Switch
                        checked={configTerabox.sincronizar_relatorios}
                        onCheckedChange={(checked) => setConfigTerabox(prev => ({ ...prev, sincronizar_relatorios: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Vistorias e fichas</Label>
                      <Switch
                        checked={configTerabox.sincronizar_vistorias}
                        onCheckedChange={(checked) => setConfigTerabox(prev => ({ ...prev, sincronizar_vistorias: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveTerabox} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={handleTestarTerabox} disabled={testingTerabox || !configTerabox.cookie}>
                    {testingTerabox ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Testar Conexão
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
