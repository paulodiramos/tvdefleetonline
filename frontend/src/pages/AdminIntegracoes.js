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
  ArrowLeft,
  CreditCard,
  FileText,
  Key,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Building,
  Smartphone,
  Banknote
} from 'lucide-react';

const AdminIntegracoes = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Configurações
  const [ifthenpayConfig, setIfthenpayConfig] = useState({
    backoffice_key: '',
    gateway_key: '',
    anti_phishing_key: '',
    mbway_key: '',
    multibanco_key: '',
    multibanco_entidade: '',
    multibanco_subentidade: '',
    cartao_key: '',
    sandbox_mode: true,
    status: 'inativa'
  });
  
  const [moloniConfig, setMoloniConfig] = useState({
    client_id: '',
    client_secret: '',
    company_id: '',
    sandbox_mode: true,
    status: 'inativa'
  });
  
  // Mostrar/esconder passwords
  const [showKeys, setShowKeys] = useState({
    backoffice_key: false,
    anti_phishing_key: false,
    client_secret: false
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/integracoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { ifthenpay, moloni } = response.data;
      
      // Preencher form com valores existentes (mascarados ou vazios)
      setIfthenpayConfig(prev => ({
        ...prev,
        sandbox_mode: ifthenpay?.sandbox_mode ?? true,
        status: ifthenpay?.status || 'inativa',
        multibanco_entidade: ifthenpay?.multibanco_entidade || '',
        multibanco_subentidade: ifthenpay?.multibanco_subentidade || '',
        // Manter campos vazios - user deve preencher novamente se quiser alterar
        tem_backoffice_key: ifthenpay?.tem_backoffice_key,
        tem_anti_phishing_key: ifthenpay?.tem_anti_phishing_key,
        tem_mbway_key: ifthenpay?.tem_mbway_key,
        tem_multibanco_key: ifthenpay?.tem_multibanco_key,
        tem_cartao_key: ifthenpay?.tem_cartao_key,
      }));
      
      setMoloniConfig(prev => ({
        ...prev,
        sandbox_mode: moloni?.sandbox_mode ?? true,
        status: moloni?.status || 'inativa',
        company_id: moloni?.company_id || '',
        tem_client_id: moloni?.tem_client_id,
        tem_client_secret: moloni?.tem_client_secret,
      }));
      
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveIfthenpay = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Enviar apenas campos preenchidos
      const data = {
        sandbox_mode: ifthenpayConfig.sandbox_mode
      };
      
      if (ifthenpayConfig.backoffice_key) data.backoffice_key = ifthenpayConfig.backoffice_key;
      if (ifthenpayConfig.gateway_key) data.gateway_key = ifthenpayConfig.gateway_key;
      if (ifthenpayConfig.anti_phishing_key) data.anti_phishing_key = ifthenpayConfig.anti_phishing_key;
      if (ifthenpayConfig.mbway_key) data.mbway_key = ifthenpayConfig.mbway_key;
      if (ifthenpayConfig.multibanco_key) data.multibanco_key = ifthenpayConfig.multibanco_key;
      if (ifthenpayConfig.multibanco_entidade) data.multibanco_entidade = ifthenpayConfig.multibanco_entidade;
      if (ifthenpayConfig.multibanco_subentidade) data.multibanco_subentidade = ifthenpayConfig.multibanco_subentidade;
      if (ifthenpayConfig.cartao_key) data.cartao_key = ifthenpayConfig.cartao_key;
      
      await axios.put(`${API}/admin/integracoes/ifthenpay`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Configuração Ifthenpay guardada');
      fetchConfig();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleTestIfthenpay = async () => {
    setTesting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/integracoes/ifthenpay/testar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        toast.success(response.data.mensagem);
      } else {
        toast.error(response.data.mensagem);
      }
      fetchConfig();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao testar');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveMoloni = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      const data = {
        sandbox_mode: moloniConfig.sandbox_mode
      };
      
      if (moloniConfig.client_id) data.client_id = moloniConfig.client_id;
      if (moloniConfig.client_secret) data.client_secret = moloniConfig.client_secret;
      if (moloniConfig.company_id) data.company_id = moloniConfig.company_id;
      
      await axios.put(`${API}/admin/integracoes/moloni`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Configuração Moloni guardada');
      fetchConfig();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMoloni = async () => {
    setTesting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/integracoes/moloni/testar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        toast.success(response.data.mensagem);
      } else {
        toast.error(response.data.mensagem);
      }
      fetchConfig();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao testar');
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativa':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Ativa</Badge>;
      case 'erro':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'pendente':
        return <Badge className="bg-amber-100 text-amber-700"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="outline">Inativa</Badge>;
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Integrações
              </h1>
              <p className="text-slate-600">Configurar gateways de pagamento e faturação</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ifthenpay" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ifthenpay" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Ifthenpay
            </TabsTrigger>
            <TabsTrigger value="moloni" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Moloni
            </TabsTrigger>
          </TabsList>

          {/* IFTHENPAY */}
          <TabsContent value="ifthenpay">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      Ifthenpay - Gateway de Pagamentos
                    </CardTitle>
                    <CardDescription>
                      Multibanco, MB WAY, Cartão de Crédito
                    </CardDescription>
                  </div>
                  {getStatusBadge(ifthenpayConfig.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Modo Sandbox */}
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <Label className="text-amber-800 font-medium">Modo Sandbox (Testes)</Label>
                    <p className="text-sm text-amber-600">Ativar para usar ambiente de testes</p>
                  </div>
                  <Switch
                    checked={ifthenpayConfig.sandbox_mode}
                    onCheckedChange={(checked) => setIfthenpayConfig(prev => ({ ...prev, sandbox_mode: checked }))}
                  />
                </div>

                {/* Backoffice Key */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Backoffice Key *
                    {ifthenpayConfig.tem_backoffice_key && (
                      <Badge variant="outline" className="text-xs text-green-600">Configurada</Badge>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.backoffice_key ? "text" : "password"}
                      placeholder="1111-2222-3333-4444"
                      value={ifthenpayConfig.backoffice_key}
                      onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, backoffice_key: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKeys(prev => ({ ...prev, backoffice_key: !prev.backoffice_key }))}
                    >
                      {showKeys.backoffice_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Chave principal fornecida pela Ifthenpay</p>
                </div>

                {/* Anti-Phishing Key */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Anti-Phishing Key
                    {ifthenpayConfig.tem_anti_phishing_key && (
                      <Badge variant="outline" className="text-xs text-green-600">Configurada</Badge>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.anti_phishing_key ? "text" : "password"}
                      placeholder="Mínimo 50 caracteres"
                      value={ifthenpayConfig.anti_phishing_key}
                      onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, anti_phishing_key: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKeys(prev => ({ ...prev, anti_phishing_key: !prev.anti_phishing_key }))}
                    >
                      {showKeys.anti_phishing_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Chave para validar webhooks de pagamento</p>
                </div>

                {/* Métodos de Pagamento */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Chaves por Método de Pagamento
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Multibanco */}
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                      <Label className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-green-600" />
                        Multibanco Key
                        {ifthenpayConfig.tem_multibanco_key && (
                          <Badge variant="outline" className="text-xs text-green-600">OK</Badge>
                        )}
                      </Label>
                      <Input
                        placeholder="ITP-000000"
                        value={ifthenpayConfig.multibanco_key}
                        onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, multibanco_key: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Entidade</Label>
                          <Input
                            placeholder="12345"
                            value={ifthenpayConfig.multibanco_entidade}
                            onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, multibanco_entidade: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Subentidade</Label>
                          <Input
                            placeholder="123"
                            value={ifthenpayConfig.multibanco_subentidade}
                            onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, multibanco_subentidade: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* MB WAY */}
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                      <Label className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-red-500" />
                        MB WAY Key
                        {ifthenpayConfig.tem_mbway_key && (
                          <Badge variant="outline" className="text-xs text-green-600">OK</Badge>
                        )}
                      </Label>
                      <Input
                        placeholder="ITP-000000"
                        value={ifthenpayConfig.mbway_key}
                        onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, mbway_key: e.target.value }))}
                      />
                    </div>

                    {/* Cartão */}
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                      <Label className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        Cartão de Crédito Key
                        {ifthenpayConfig.tem_cartao_key && (
                          <Badge variant="outline" className="text-xs text-green-600">OK</Badge>
                        )}
                      </Label>
                      <Input
                        placeholder="ITP-000000"
                        value={ifthenpayConfig.cartao_key}
                        onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, cartao_key: e.target.value }))}
                      />
                    </div>

                    {/* Gateway Key */}
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                      <Label className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-purple-600" />
                        Gateway Key (Checkout)
                      </Label>
                      <Input
                        placeholder="AAAA-999999"
                        value={ifthenpayConfig.gateway_key}
                        onChange={(e) => setIfthenpayConfig(prev => ({ ...prev, gateway_key: e.target.value }))}
                      />
                      <p className="text-xs text-slate-500">Página de checkout genérica</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between border-t pt-4">
                <Button variant="outline" onClick={handleTestIfthenpay} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Testar Conexão
                </Button>
                <Button onClick={handleSaveIfthenpay} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Configuração
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* MOLONI */}
          <TabsContent value="moloni">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      Moloni - Faturação
                    </CardTitle>
                    <CardDescription>
                      Emissão automática de faturas
                    </CardDescription>
                  </div>
                  {getStatusBadge(moloniConfig.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Modo Sandbox */}
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <Label className="text-amber-800 font-medium">Modo Sandbox (Testes)</Label>
                    <p className="text-sm text-amber-600">Ativar para usar ambiente de testes</p>
                  </div>
                  <Switch
                    checked={moloniConfig.sandbox_mode}
                    onCheckedChange={(checked) => setMoloniConfig(prev => ({ ...prev, sandbox_mode: checked }))}
                  />
                </div>

                {/* Instruções */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2">Como obter credenciais Moloni:</h4>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Aceda ao <a href="https://www.moloni.pt" target="_blank" rel="noopener noreferrer" className="underline">painel Moloni</a></li>
                    <li>Vá a Definições → Programadores → Clientes API</li>
                    <li>Crie um novo cliente API</li>
                    <li>Copie o Client ID e Client Secret</li>
                    <li>O Company ID aparece no URL do Moloni após login</li>
                  </ol>
                </div>

                {/* Client ID */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Client ID *
                    {moloniConfig.tem_client_id && (
                      <Badge variant="outline" className="text-xs text-green-600">Configurado</Badge>
                    )}
                  </Label>
                  <Input
                    placeholder="Seu Client ID do Moloni"
                    value={moloniConfig.client_id}
                    onChange={(e) => setMoloniConfig(prev => ({ ...prev, client_id: e.target.value }))}
                  />
                </div>

                {/* Client Secret */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Client Secret *
                    {moloniConfig.tem_client_secret && (
                      <Badge variant="outline" className="text-xs text-green-600">Configurado</Badge>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.client_secret ? "text" : "password"}
                      placeholder="Seu Client Secret do Moloni"
                      value={moloniConfig.client_secret}
                      onChange={(e) => setMoloniConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKeys(prev => ({ ...prev, client_secret: !prev.client_secret }))}
                    >
                      {showKeys.client_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Company ID */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Company ID *
                  </Label>
                  <Input
                    placeholder="ID da empresa no Moloni"
                    value={moloniConfig.company_id}
                    onChange={(e) => setMoloniConfig(prev => ({ ...prev, company_id: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500">Identificador da empresa nas chamadas à API</p>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between border-t pt-4">
                <Button variant="outline" onClick={handleTestMoloni} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Testar Conexão
                </Button>
                <Button onClick={handleSaveMoloni} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Configuração
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminIntegracoes;
