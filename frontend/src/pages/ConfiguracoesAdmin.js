import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Shield, Save, Key } from 'lucide-react';

const ConfiguracoesAdmin = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configData, setConfigData] = useState({
    condicoes_gerais: '',
    politica_privacidade: '',
    email_comunicacoes: '',
    whatsapp_comunicacoes: '',
    ifthenpay_entity: '',
    ifthenpay_subentity: '',
    ifthenpay_api_key: '',
    moloni_client_id: '',
    moloni_client_secret: '',
    moloni_company_id: ''
  });
  const [originalData, setOriginalData] = useState({
    condicoes_gerais: '',
    politica_privacidade: '',
    email_comunicacoes: '',
    whatsapp_comunicacoes: '',
    ifthenpay_entity: '',
    ifthenpay_subentity: '',
    ifthenpay_api_key: '',
    moloni_client_id: '',
    moloni_client_secret: '',
    moloni_company_id: ''
  });

  useEffect(() => {
    fetchConfigData();
  }, []);

  const fetchConfigData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/config/textos-legais`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigData({
        condicoes_gerais: response.data.condicoes_gerais || '',
        politica_privacidade: response.data.politica_privacidade || '',
        email_comunicacoes: response.data.email_comunicacoes || '',
        whatsapp_comunicacoes: response.data.whatsapp_comunicacoes || '',
        ifthenpay_entity: response.data.ifthenpay_entity || '',
        ifthenpay_subentity: response.data.ifthenpay_subentity || '',
        ifthenpay_api_key: response.data.ifthenpay_api_key || '',
        moloni_client_id: response.data.moloni_client_id || '',
        moloni_client_secret: response.data.moloni_client_secret || '',
        moloni_company_id: response.data.moloni_company_id || ''
      });
      setOriginalData({
        condicoes_gerais: response.data.condicoes_gerais || '',
        politica_privacidade: response.data.politica_privacidade || '',
        email_comunicacoes: response.data.email_comunicacoes || '',
        whatsapp_comunicacoes: response.data.whatsapp_comunicacoes || '',
        ifthenpay_entity: response.data.ifthenpay_entity || '',
        ifthenpay_subentity: response.data.ifthenpay_subentity || '',
        ifthenpay_api_key: response.data.ifthenpay_api_key || '',
        moloni_client_id: response.data.moloni_client_id || '',
        moloni_client_secret: response.data.moloni_client_secret || '',
        moloni_company_id: response.data.moloni_company_id || ''
      });
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTerms = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/textos-legais`,
        { condicoes_gerais: configData.condicoes_gerais },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ ...originalData, condicoes_gerais: configData.condicoes_gerais });
      toast.success('Termos e Condições guardados com sucesso!');
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error('Erro ao guardar Termos e Condições');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/textos-legais`,
        { politica_privacidade: configData.politica_privacidade },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ ...originalData, politica_privacidade: configData.politica_privacidade });
      toast.success('Política de Privacidade guardada com sucesso!');
    } catch (error) {
      console.error('Error saving privacy:', error);
      toast.error('Erro ao guardar Política de Privacidade');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTerms = () => {
    setConfigData({ ...configData, condicoes_gerais: originalData.condicoes_gerais });
    toast.info('Alterações descartadas');
  };

  const handleCancelPrivacy = () => {
    setConfigData({ ...configData, politica_privacidade: originalData.politica_privacidade });
    toast.info('Alterações descartadas');
  };

  const handleSaveComunicacoes = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/comunicacoes`,
        { 
          email_comunicacoes: configData.email_comunicacoes,
          whatsapp_comunicacoes: configData.whatsapp_comunicacoes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ 
        ...originalData, 
        email_comunicacoes: configData.email_comunicacoes,
        whatsapp_comunicacoes: configData.whatsapp_comunicacoes
      });
      toast.success('Configurações de comunicação guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving comunicacoes:', error);
      toast.error('Erro ao guardar configurações de comunicação');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegracoes = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/integracoes`,
        { 
          ifthenpay_entity: configData.ifthenpay_entity,
          ifthenpay_subentity: configData.ifthenpay_subentity,
          ifthenpay_api_key: configData.ifthenpay_api_key,
          moloni_client_id: configData.moloni_client_id,
          moloni_client_secret: configData.moloni_client_secret,
          moloni_company_id: configData.moloni_company_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ 
        ...originalData, 
        ifthenpay_entity: configData.ifthenpay_entity,
        ifthenpay_subentity: configData.ifthenpay_subentity,
        ifthenpay_api_key: configData.ifthenpay_api_key,
        moloni_client_id: configData.moloni_client_id,
        moloni_client_secret: configData.moloni_client_secret,
        moloni_company_id: configData.moloni_company_id
      });
      toast.success('Credenciais de integração guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving integracoes:', error);
      toast.error('Erro ao guardar credenciais de integração');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-screen">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Shield className="w-6 h-6" />
                <span>Acesso Negado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Apenas administradores podem aceder a esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <span>Configurações do Sistema</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Gerir textos legais e configurações gerais do sistema
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="terms" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="terms" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Termos e Condições</span>
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Política de Privacidade</span>
                </TabsTrigger>
                <TabsTrigger value="comunicacoes" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Comunicações</span>
                </TabsTrigger>
                <TabsTrigger value="integracoes" className="flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <span>Integrações</span>
                </TabsTrigger>
              </TabsList>

              {/* Terms and Conditions Tab */}
              <TabsContent value="terms" className="space-y-4">
                <div>
                  <Label htmlFor="condicoes_gerais" className="text-lg font-semibold">
                    Termos e Condições Gerais
                  </Label>
                  <p className="text-sm text-slate-600 mb-3">
                    Defina os termos e condições que serão exibidos na plataforma
                  </p>
                  <textarea
                    id="condicoes_gerais"
                    className="w-full p-4 border rounded-md min-h-[400px] text-sm"
                    placeholder="Escreva aqui os Termos e Condições Gerais..."
                    value={configData.condicoes_gerais}
                    onChange={(e) => setConfigData({ ...configData, condicoes_gerais: e.target.value })}
                    disabled={loading || saving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelTerms}
                    disabled={loading || saving || configData.condicoes_gerais === originalData.condicoes_gerais}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSaveTerms}
                    disabled={loading || saving || configData.condicoes_gerais === originalData.condicoes_gerais}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Termos</span>
                  </Button>
                </div>
              </TabsContent>

              {/* Privacy Policy Tab */}
              <TabsContent value="privacy" className="space-y-4">
                <div>
                  <Label htmlFor="politica_privacidade" className="text-lg font-semibold">
                    Política de Privacidade
                  </Label>
                  <p className="text-sm text-slate-600 mb-3">
                    Defina a política de privacidade que será exibida na plataforma
                  </p>
                  <textarea
                    id="politica_privacidade"
                    className="w-full p-4 border rounded-md min-h-[400px] text-sm"
                    placeholder="Escreva aqui a Política de Privacidade..."
                    value={configData.politica_privacidade}
                    onChange={(e) => setConfigData({ ...configData, politica_privacidade: e.target.value })}
                    disabled={loading || saving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPrivacy}
                    disabled={loading || saving || configData.politica_privacidade === originalData.politica_privacidade}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSavePrivacy}
                    disabled={loading || saving || configData.politica_privacidade === originalData.politica_privacidade}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Política</span>
                  </Button>
                </div>
              </TabsContent>

              {/* Comunicações Tab */}
              <TabsContent value="comunicacoes" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email_comunicacoes" className="text-lg font-semibold">
                      Email para Comunicações
                    </Label>
                    <p className="text-sm text-slate-600 mb-3">
                      Este email será usado para enviar relatórios semanais e notificações aos motoristas e parceiros
                    </p>
                    <input
                      id="email_comunicacoes"
                      type="email"
                      className="w-full p-3 border rounded-md text-sm"
                      placeholder="comunicacoes@empresa.com"
                      value={configData.email_comunicacoes}
                      onChange={(e) => setConfigData({ ...configData, email_comunicacoes: e.target.value })}
                      disabled={loading || saving}
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsapp_comunicacoes" className="text-lg font-semibold">
                      WhatsApp para Comunicações
                    </Label>
                    <p className="text-sm text-slate-600 mb-3">
                      Número de telefone (com código do país) para enviar mensagens via WhatsApp
                    </p>
                    <input
                      id="whatsapp_comunicacoes"
                      type="tel"
                      className="w-full p-3 border rounded-md text-sm"
                      placeholder="+351912345678"
                      value={configData.whatsapp_comunicacoes}
                      onChange={(e) => setConfigData({ ...configData, whatsapp_comunicacoes: e.target.value })}
                      disabled={loading || saving}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Formato: +[código país][número] (ex: +351912345678)
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfigData({ 
                      ...configData, 
                      email_comunicacoes: originalData.email_comunicacoes,
                      whatsapp_comunicacoes: originalData.whatsapp_comunicacoes
                    })}
                    disabled={loading || saving || 
                      (configData.email_comunicacoes === originalData.email_comunicacoes && 
                       configData.whatsapp_comunicacoes === originalData.whatsapp_comunicacoes)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSaveComunicacoes}
                    disabled={loading || saving || 
                      (configData.email_comunicacoes === originalData.email_comunicacoes && 
                       configData.whatsapp_comunicacoes === originalData.whatsapp_comunicacoes)}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Comunicações</span>
                  </Button>
                </div>
              </TabsContent>

              {/* Integrações Tab */}
              <TabsContent value="integracoes" className="space-y-6">
                {/* IFThenPay Section */}
                <div className="border-b pb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
                    <Key className="w-5 h-5 text-blue-600" />
                    <span>IFThenPay (Gateway de Pagamentos)</span>
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ifthenpay_entity" className="text-sm font-semibold">
                        Entidade
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        Código da entidade Multibanco fornecido pelo IFThenPay
                      </p>
                      <input
                        id="ifthenpay_entity"
                        type="text"
                        className="w-full p-3 border rounded-md text-sm"
                        placeholder="Ex: 10559"
                        value={configData.ifthenpay_entity}
                        onChange={(e) => setConfigData({ ...configData, ifthenpay_entity: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>

                    <div>
                      <Label htmlFor="ifthenpay_subentity" className="text-sm font-semibold">
                        Sub-Entidade
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        Código da sub-entidade (se aplicável)
                      </p>
                      <input
                        id="ifthenpay_subentity"
                        type="text"
                        className="w-full p-3 border rounded-md text-sm"
                        placeholder="Ex: 999"
                        value={configData.ifthenpay_subentity}
                        onChange={(e) => setConfigData({ ...configData, ifthenpay_subentity: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>

                    <div>
                      <Label htmlFor="ifthenpay_api_key" className="text-sm font-semibold">
                        API Key
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        Chave de API para autenticação (disponível no backoffice IFThenPay)
                      </p>
                      <input
                        id="ifthenpay_api_key"
                        type="password"
                        className="w-full p-3 border rounded-md text-sm font-mono"
                        placeholder="Insira a API Key do IFThenPay"
                        value={configData.ifthenpay_api_key}
                        onChange={(e) => setConfigData({ ...configData, ifthenpay_api_key: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Moloni Section */}
                <div className="pb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span>Moloni (Emissão de Faturas)</span>
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="moloni_client_id" className="text-sm font-semibold">
                        Client ID
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        Identificador do cliente na API Moloni
                      </p>
                      <input
                        id="moloni_client_id"
                        type="text"
                        className="w-full p-3 border rounded-md text-sm font-mono"
                        placeholder="Insira o Client ID do Moloni"
                        value={configData.moloni_client_id}
                        onChange={(e) => setConfigData({ ...configData, moloni_client_id: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>

                    <div>
                      <Label htmlFor="moloni_client_secret" className="text-sm font-semibold">
                        Client Secret
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        Chave secreta de autenticação na API Moloni
                      </p>
                      <input
                        id="moloni_client_secret"
                        type="password"
                        className="w-full p-3 border rounded-md text-sm font-mono"
                        placeholder="Insira o Client Secret do Moloni"
                        value={configData.moloni_client_secret}
                        onChange={(e) => setConfigData({ ...configData, moloni_client_secret: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>

                    <div>
                      <Label htmlFor="moloni_company_id" className="text-sm font-semibold">
                        Company ID
                      </Label>
                      <p className="text-xs text-slate-600 mb-2">
                        ID da empresa no sistema Moloni
                      </p>
                      <input
                        id="moloni_company_id"
                        type="text"
                        className="w-full p-3 border rounded-md text-sm"
                        placeholder="Ex: 123456"
                        value={configData.moloni_company_id}
                        onChange={(e) => setConfigData({ ...configData, moloni_company_id: e.target.value })}
                        disabled={loading || saving}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ Nota:</strong> Estas credenciais são necessárias para ativar as integrações de pagamentos e faturação. 
                    Pode obter estas informações nos respetivos backoffices do IFThenPay e Moloni.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfigData({ 
                      ...configData, 
                      ifthenpay_entity: originalData.ifthenpay_entity,
                      ifthenpay_subentity: originalData.ifthenpay_subentity,
                      ifthenpay_api_key: originalData.ifthenpay_api_key,
                      moloni_client_id: originalData.moloni_client_id,
                      moloni_client_secret: originalData.moloni_client_secret,
                      moloni_company_id: originalData.moloni_company_id
                    })}
                    disabled={loading || saving || 
                      (configData.ifthenpay_entity === originalData.ifthenpay_entity && 
                       configData.ifthenpay_subentity === originalData.ifthenpay_subentity &&
                       configData.ifthenpay_api_key === originalData.ifthenpay_api_key &&
                       configData.moloni_client_id === originalData.moloni_client_id &&
                       configData.moloni_client_secret === originalData.moloni_client_secret &&
                       configData.moloni_company_id === originalData.moloni_company_id)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSaveIntegracoes}
                    disabled={loading || saving || 
                      (configData.ifthenpay_entity === originalData.ifthenpay_entity && 
                       configData.ifthenpay_subentity === originalData.ifthenpay_subentity &&
                       configData.ifthenpay_api_key === originalData.ifthenpay_api_key &&
                       configData.moloni_client_id === originalData.moloni_client_id &&
                       configData.moloni_client_secret === originalData.moloni_client_secret &&
                       configData.moloni_company_id === originalData.moloni_company_id)}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Credenciais</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracoesAdmin;
