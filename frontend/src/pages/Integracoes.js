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
import { FileText, Check, X, AlertCircle, Mail, MessageSquare, CreditCard } from 'lucide-react';

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
      const response = await axios.get(`${API}/api/integracoes/configuracoes`, {
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
                    await axios.post(`${API}/api/integracoes/terabox`, configuracoes.terabox, {
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
                    const response = await axios.post(`${API}/api/integracoes/terabox/test`, {}, {
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
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>API do WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Pagamentos</CardTitle>
              <CardDescription>Gateways de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Integracoes;
