import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileText, Check, X, AlertCircle, Mail, MessageSquare, CreditCard, Cloud } from 'lucide-react';

const Integracoes = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [configuracoes, setConfiguracoes] = useState({
    moloni: {
      ativo: false,
      client_id: '',
      client_secret: '',
      username: '',
      password: '',
      company_id: '',
      taxa_mensal_extra: 10.00
    }
  });

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/integracoes/configuracoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.moloni) {
        setConfiguracoes(response.data);
      }
    } catch (error) {
      console.error('Error fetching configuracoes:', error);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-slate-600 mt-1">Configure integrações com serviços externos</p>
        </div>

        {/* Terabox Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Terabox - Armazenamento em Cloud</CardTitle>
                  <CardDescription>Guardar documentos e fotos em Terabox</CardDescription>
                </div>
              </div>
              <Badge variant={configuracoes.terabox?.ativo ? "default" : "secondary"}>
                {configuracoes.terabox?.ativo ? <><Check className="w-3 h-3 mr-1" /> Ativo</> : <><X className="w-3 h-3 mr-1" /> Inativo</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Como funciona:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Todos os documentos de motoristas são guardados no Terabox</li>
                  <li>Fotos de veículos são automaticamente sincronizadas</li>
                  <li>Backup seguro em cloud</li>
                  <li>Acesso através de API do Terabox</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <Label htmlFor="terabox-active" className="flex flex-col space-y-1">
                <span>Ativar Integração Terabox</span>
                <span className="text-xs text-slate-500 font-normal">Guardar documentos em cloud</span>
              </Label>
              <Switch
                id="terabox-active"
                checked={configuracoes.terabox?.ativo || false}
                onCheckedChange={(checked) => 
                  setConfiguracoes({
                    ...configuracoes,
                    terabox: { ...configuracoes.terabox, ativo: checked }
                  })
                }
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label htmlFor="terabox-api-key">API Key *</Label>
                <Input
                  id="terabox-api-key"
                  type="password"
                  value={configuracoes.terabox?.api_key || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      terabox: { ...configuracoes.terabox, api_key: e.target.value }
                    })
                  }
                  placeholder="Insira a API Key do Terabox"
                />
                <p className="text-xs text-slate-500 mt-1">Obtenha após login em terabox.com</p>
              </div>

              <div>
                <Label htmlFor="terabox-folder">Pasta de Destino</Label>
                <Input
                  id="terabox-folder"
                  type="text"
                  value={configuracoes.terabox?.folder || '/TVDEFleet'}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      terabox: { ...configuracoes.terabox, folder: e.target.value }
                    })
                  }
                  placeholder="/TVDEFleet"
                />
                <p className="text-xs text-slate-500 mt-1">Pasta raiz onde os documentos serão guardados</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    await axios.post(`${API}/integracoes/terabox`, configuracoes.terabox, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    toast.success('Configurações Terabox salvas com sucesso!');
                    fetchConfiguracoes();
                  } catch (error) {
                    console.error('Error saving Terabox:', error);
                    toast.error(error.response?.data?.detail || 'Erro ao salvar configurações');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                Salvar Configurações
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    const response = await axios.post(`${API}/integracoes/terabox/test`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    toast.success(response.data.message || 'Conexão Terabox testada com sucesso!');
                  } catch (error) {
                    console.error('Error testing Terabox:', error);
                    toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
                  } finally {
                    setLoading(false);
                  }
                }}
                variant="outline" 
                disabled={loading || !configuracoes.terabox?.ativo}
              >
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Business API Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>WhatsApp Business API</CardTitle>
                  <CardDescription>Enviar relatórios e notificações via WhatsApp</CardDescription>
                </div>
              </div>
              <Badge variant={configuracoes.whatsapp?.ativo ? "default" : "secondary"}>
                {configuracoes.whatsapp?.ativo ? <><Check className="w-3 h-3 mr-1" /> Ativo</> : <><X className="w-3 h-3 mr-1" /> Inativo</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Funcionalidades disponíveis:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Envio de relatórios semanais para motoristas</li>
                  <li>Notificações de alteração de status</li>
                  <li>Comunicação de vistorias agendadas</li>
                  <li>Envio em massa para múltiplos motoristas</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-active" className="flex flex-col space-y-1">
                <span>Ativar WhatsApp Business</span>
                <span className="text-xs text-slate-500 font-normal">Enviar mensagens via WhatsApp</span>
              </Label>
              <Switch
                id="whatsapp-active"
                checked={configuracoes.whatsapp?.ativo || false}
                onCheckedChange={(checked) => 
                  setConfiguracoes({
                    ...configuracoes,
                    whatsapp: { ...configuracoes.whatsapp, ativo: checked }
                  })
                }
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsapp-phone-id">Phone Number ID *</Label>
                <Input
                  id="whatsapp-phone-id"
                  type="text"
                  value={configuracoes.whatsapp?.phone_number_id || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      whatsapp: { ...configuracoes.whatsapp, phone_number_id: e.target.value }
                    })
                  }
                  placeholder="Ex: 123456789012345"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Encontre em: Meta Business → WhatsApp → Configuração da API
                </p>
              </div>

              <div>
                <Label htmlFor="whatsapp-token">Access Token *</Label>
                <Input
                  id="whatsapp-token"
                  type="password"
                  value={configuracoes.whatsapp?.access_token || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      whatsapp: { ...configuracoes.whatsapp, access_token: e.target.value }
                    })
                  }
                  placeholder="Token de acesso permanente"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Token permanente gerado no Meta Business Suite
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">📘 Como configurar:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal ml-4">
                <li>Aceda a <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">business.facebook.com</a></li>
                <li>Crie uma conta Meta Business e adicione WhatsApp Business</li>
                <li>Em "Configuração da API", copie o Phone Number ID</li>
                <li>Gere um token de acesso permanente</li>
              </ol>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    await axios.post(`${API}/whatsapp/config`, configuracoes.whatsapp, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    toast.success('Configurações WhatsApp salvas com sucesso!');
                    fetchConfiguracoes();
                  } catch (error) {
                    console.error('Error saving WhatsApp:', error);
                    toast.error(error.response?.data?.detail || 'Erro ao salvar configurações');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                Salvar Configurações
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    const response = await axios.get(`${API}/whatsapp/stats`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    toast.success(`WhatsApp OK! ${response.data.total_enviados} mensagens enviadas.`);
                  } catch (error) {
                    console.error('Error testing WhatsApp:', error);
                    toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
                  } finally {
                    setLoading(false);
                  }
                }}
                variant="outline" 
                disabled={loading || !configuracoes.whatsapp?.ativo}
              >
                Ver Estatísticas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Outras Integrações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>Configure servidor SMTP</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Configurado via variáveis de ambiente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Moloni</CardTitle>
              <CardDescription>Faturação automática</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em desenvolvimento</p>
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
};

export default Integracoes;
