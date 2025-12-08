import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, MessageCircle, Send, CheckCircle, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

const ConfiguracaoComunicacoes = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Email Config
  const [emailConfig, setEmailConfig] = useState({
    provider: 'sendgrid',
    // SendGrid
    api_key: '',
    // SMTP
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_use_tls: true,
    // Common
    sender_email: '',
    sender_name: '',
    enabled: false
  });
  
  // WhatsApp Config
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'baileys',
    enabled: false,
    connected: false
  });
  
  const [emailStatus, setEmailStatus] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch email config
      const emailResponse = await axios.get(`${API}/configuracoes/comunicacoes/email`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (emailResponse.data) {
        setEmailConfig(emailResponse.data);
        setEmailStatus(emailResponse.data.enabled ? 'configured' : 'not_configured');
      }
      
      // Fetch WhatsApp config
      const whatsappResponse = await axios.get(`${API}/configuracoes/comunicacoes/whatsapp`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (whatsappResponse.data) {
        setWhatsappConfig(whatsappResponse.data);
        setWhatsappStatus(whatsappResponse.data.connected ? 'connected' : 'disconnected');
      }
    } catch (error) {
      console.error('Error fetching configurations:', error);
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar configurações');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    
    // Validação baseada no provider
    if (emailConfig.provider === 'sendgrid') {
      if (!emailConfig.api_key || !emailConfig.sender_email) {
        toast.error('Por favor preencha API Key e Email Remetente');
        return;
      }
    } else if (emailConfig.provider === 'smtp') {
      if (!emailConfig.smtp_host || !emailConfig.smtp_user || !emailConfig.smtp_password || !emailConfig.sender_email) {
        toast.error('Por favor preencha todos os campos SMTP obrigatórios');
        return;
      }
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/configuracoes/comunicacoes/email`,
        emailConfig,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Configuração de email salva com sucesso!');
      setEmailStatus('configured');
    } catch (error) {
      console.error('Error saving email config:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailConfig.api_key || !emailConfig.sender_email) {
      toast.error('Por favor configure o email primeiro');
      return;
    }
    
    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/configuracoes/comunicacoes/email/test`,
        { recipient: emailConfig.sender_email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Email de teste enviado com sucesso! Verifique sua caixa de entrada.');
        setEmailStatus('verified');
      } else {
        toast.error('Falha ao enviar email de teste');
        setEmailStatus('error');
      }
    } catch (error) {
      console.error('Error testing email:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar email');
      setEmailStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEmail = async () => {
    try {
      const newStatus = !emailConfig.enabled;
      const token = localStorage.getItem('token');
      
      await axios.patch(
        `${API}/configuracoes/comunicacoes/email`,
        { enabled: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setEmailConfig(prev => ({ ...prev, enabled: newStatus }));
      toast.success(`Email ${newStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling email:', error);
      toast.error('Erro ao alterar status do email');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      configured: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, text: 'Configurado' },
      verified: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Verificado' },
      error: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Erro' },
      not_configured: { color: 'bg-gray-100 text-gray-800', icon: XCircle, text: 'Não Configurado' },
      connected: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Conectado' },
      disconnected: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'Desconectado' }
    };
    
    const config = statusConfig[status] || statusConfig.not_configured;
    const Icon = config.icon;
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1 inline" />
        {config.text}
      </Badge>
    );
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <span>Configuração de Comunicações</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Configure os canais de comunicação para envio de notificações automáticas
          </p>
        </div>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="email" className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email (SendGrid)</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </TabsTrigger>
          </TabsList>

          {/* Email Configuration */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Mail className="w-5 h-5" />
                      <span>Configuração SendGrid</span>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Configure as credenciais do SendGrid para envio de emails
                    </CardDescription>
                  </div>
                  {emailStatus && getStatusBadge(emailStatus)}
                </div>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSaveEmail} className="space-y-6">
                  {/* Provider Selection */}
                  <div>
                    <Label htmlFor="provider">
                      Tipo de Servidor <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="provider"
                      className="w-full p-2 border rounded-md mt-1"
                      value={emailConfig.provider}
                      onChange={(e) => setEmailConfig({...emailConfig, provider: e.target.value})}
                    >
                      <option value="sendgrid">SendGrid (API)</option>
                      <option value="smtp">SMTP (Servidor Próprio)</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      {emailConfig.provider === 'sendgrid' 
                        ? 'API SendGrid - Simples e rápido'
                        : 'SMTP - Use Gmail, Outlook ou servidor próprio'}
                    </p>
                  </div>

                  {/* SendGrid Fields */}
                  {emailConfig.provider === 'sendgrid' && (
                    <div>
                      <Label htmlFor="api_key">
                        API Key SendGrid <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="api_key"
                          type={showApiKey ? "text" : "password"}
                          value={emailConfig.api_key}
                          onChange={(e) => setEmailConfig({...emailConfig, api_key: e.target.value})}
                          placeholder="SG.xxxxxxxxxxxxx"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Obtenha em: Settings → API Keys no dashboard SendGrid
                      </p>
                    </div>
                  )}

                  {/* SMTP Fields */}
                  {emailConfig.provider === 'smtp' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="smtp_host">
                            Servidor SMTP <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="smtp_host"
                            type="text"
                            value={emailConfig.smtp_host}
                            onChange={(e) => setEmailConfig({...emailConfig, smtp_host: e.target.value})}
                            placeholder="smtp.gmail.com"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Ex: smtp.gmail.com, smtp-mail.outlook.com
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="smtp_port">
                            Porta <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="smtp_port"
                            type="number"
                            value={emailConfig.smtp_port}
                            onChange={(e) => setEmailConfig({...emailConfig, smtp_port: parseInt(e.target.value)})}
                            placeholder="587"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            587 (TLS) ou 465 (SSL)
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="smtp_user">
                          Username SMTP <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="smtp_user"
                          type="text"
                          value={emailConfig.smtp_user}
                          onChange={(e) => setEmailConfig({...emailConfig, smtp_user: e.target.value})}
                          placeholder="seu-email@gmail.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="smtp_password">
                          Password SMTP <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="smtp_password"
                            type={showSmtpPassword ? "text" : "password"}
                            value={emailConfig.smtp_password}
                            onChange={(e) => setEmailConfig({...emailConfig, smtp_password: e.target.value})}
                            placeholder="••••••••"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                          >
                            {showSmtpPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Gmail: Use "Senha de App", não a senha normal
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="smtp_use_tls"
                          checked={emailConfig.smtp_use_tls}
                          onChange={(e) => setEmailConfig({...emailConfig, smtp_use_tls: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="smtp_use_tls" className="cursor-pointer">
                          Usar TLS/STARTTLS (recomendado)
                        </Label>
                      </div>
                    </>
                  )}

                  {/* Common Fields */}
                  <div>
                    <Label htmlFor="sender_email">
                      Email Remetente <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="sender_email"
                      type="email"
                      value={emailConfig.sender_email}
                      onChange={(e) => setEmailConfig({...emailConfig, sender_email: e.target.value})}
                      placeholder="noreply@tvdefleet.com"
                    />
                    {emailConfig.provider === 'smtp' && (
                      <p className="text-xs text-slate-500 mt-1">
                        Deve ser o mesmo email configurado no SMTP
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="sender_name">Nome do Remetente</Label>
                    <Input
                      id="sender_name"
                      type="text"
                      value={emailConfig.sender_name}
                      onChange={(e) => setEmailConfig({...emailConfig, sender_name: e.target.value})}
                      placeholder="TVDEFleet Notificações"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? 'Salvando...' : 'Salvar Configuração'}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={testing || !emailConfig.api_key}
                      className="flex-1"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {testing ? 'Testando...' : 'Enviar Email Teste'}
                    </Button>
                  </div>

                  {/* Enable/Disable Toggle */}
                  {emailStatus !== 'not_configured' && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">Status do Serviço</Label>
                          <p className="text-sm text-slate-500">
                            Ativar/desativar envio automático de emails
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant={emailConfig.enabled ? "destructive" : "default"}
                          onClick={handleToggleEmail}
                        >
                          {emailConfig.enabled ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>

                {/* Info Box */}
                {emailConfig.provider === 'sendgrid' ? (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como obter credenciais SendGrid:</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Acesse <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="underline">sendgrid.com</a> e crie uma conta</li>
                      <li>Vá para Settings → API Keys</li>
                      <li>Crie uma nova API key com permissão "Full Access"</li>
                      <li>Verifique seu domínio ou email remetente em Settings → Sender Authentication</li>
                    </ol>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">ℹ️ Configurar SMTP:</h4>
                    
                    <div className="text-sm text-green-800 space-y-3 mt-3">
                      <div>
                        <strong>📧 Gmail:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Host: smtp.gmail.com | Port: 587</li>
                          <li>Ative "Verificação em 2 etapas" na conta Google</li>
                          <li>Gere uma "Senha de App" em: Conta Google → Segurança → Senhas de app</li>
                          <li>Use essa senha (16 caracteres) no campo Password</li>
                        </ul>
                      </div>
                      
                      <div>
                        <strong>📧 Outlook/Hotmail:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Host: smtp-mail.outlook.com | Port: 587</li>
                          <li>Use seu email e senha normais</li>
                        </ul>
                      </div>
                      
                      <div>
                        <strong>🖥️ Servidor Próprio:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Obtenha as credenciais com seu provedor de hospedagem</li>
                          <li>Verifique a porta correta (587 TLS ou 465 SSL)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Configuration */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageCircle className="w-5 h-5" />
                      <span>Configuração WhatsApp</span>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Configure o WhatsApp Business para envio de notificações
                    </CardDescription>
                  </div>
                  {whatsappStatus && getStatusBadge(whatsappStatus)}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Integração WhatsApp em Desenvolvimento
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    A integração com WhatsApp Business API está planeada para uma próxima versão.
                    Será possível enviar notificações urgentes via WhatsApp.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-yellow-800">
                      <strong>Em breve:</strong> Configuração de conta WhatsApp Business, 
                      templates de mensagens aprovados e webhooks para respostas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ConfiguracaoComunicacoes;
