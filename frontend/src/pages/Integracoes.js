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

  const handleSaveMoloni = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/integracoes/moloni`,
        configuracoes.moloni,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configurações Moloni salvas com sucesso!');
      fetchConfiguracoes();
    } catch (error) {
      console.error('Error saving Moloni:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleTestMoloni = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/integracoes/moloni/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message || 'Conexão Moloni testada com sucesso!');
    } catch (error) {
      console.error('Error testing Moloni:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-slate-600 mt-1">Configure integrações com serviços externos</p>
        </div>

        {/* Moloni Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Moloni - Faturação Automática</CardTitle>
                  <CardDescription>Sistema de faturação automática para motoristas</CardDescription>
                </div>
              </div>
              <Badge variant={configuracoes.moloni?.ativo ? "default" : "secondary"}>
                {configuracoes.moloni?.ativo ? <><Check className="w-3 h-3 mr-1" /> Ativo</> : <><X className="w-3 h-3 mr-1" /> Inativo</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Como funciona:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Motoristas podem ativar auto-faturação no seu perfil</li>
                  <li>Será cobrada uma taxa mensal extra de €{configuracoes.moloni?.taxa_mensal_extra || 10}</li>
                  <li>Faturas são emitidas automaticamente via Moloni</li>
                  <li>Faturas enviadas por email ao motorista</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <Label htmlFor="moloni-active" className="flex flex-col space-y-1">
                <span>Ativar Integração Moloni</span>
                <span className="text-xs text-slate-500 font-normal">Permite auto-faturação para motoristas</span>
              </Label>
              <Switch
                id="moloni-active"
                checked={configuracoes.moloni?.ativo || false}
                onCheckedChange={(checked) => 
                  setConfiguracoes({
                    ...configuracoes,
                    moloni: { ...configuracoes.moloni, ativo: checked }
                  })
                }
              />
            </div>

            <Separator />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="moloni-client-id">Client ID *</Label>
                <Input
                  id="moloni-client-id"
                  type="text"
                  value={configuracoes.moloni?.client_id || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, client_id: e.target.value }
                    })
                  }
                  placeholder="Ex: abc123..."
                />
              </div>

              <div>
                <Label htmlFor="moloni-client-secret">Client Secret *</Label>
                <Input
                  id="moloni-client-secret"
                  type="password"
                  value={configuracoes.moloni?.client_secret || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, client_secret: e.target.value }
                    })
                  }
                  placeholder="Ex: xyz789..."
                />
              </div>

              <div>
                <Label htmlFor="moloni-username">Username *</Label>
                <Input
                  id="moloni-username"
                  type="text"
                  value={configuracoes.moloni?.username || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, username: e.target.value }
                    })
                  }
                  placeholder="Seu username Moloni"
                />
              </div>

              <div>
                <Label htmlFor="moloni-password">Password *</Label>
                <Input
                  id="moloni-password"
                  type="password"
                  value={configuracoes.moloni?.password || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, password: e.target.value }
                    })
                  }
                  placeholder="Sua senha Moloni"
                />
              </div>

              <div>
                <Label htmlFor="moloni-company-id">Company ID *</Label>
                <Input
                  id="moloni-company-id"
                  type="text"
                  value={configuracoes.moloni?.company_id || ''}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, company_id: e.target.value }
                    })
                  }
                  placeholder="ID da empresa no Moloni"
                />
              </div>

              <div>
                <Label htmlFor="moloni-taxa">Taxa Mensal Extra (€) *</Label>
                <Input
                  id="moloni-taxa"
                  type="number"
                  step="0.01"
                  value={configuracoes.moloni?.taxa_mensal_extra || 10}
                  onChange={(e) => 
                    setConfiguracoes({
                      ...configuracoes,
                      moloni: { ...configuracoes.moloni, taxa_mensal_extra: parseFloat(e.target.value) }
                    })
                  }
                  placeholder="10.00"
                />
                <p className="text-xs text-slate-500 mt-1">Cobrado mensalmente aos motoristas com auto-faturação</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button onClick={handleSaveMoloni} disabled={loading}>
                Salvar Configurações
              </Button>
              <Button 
                onClick={handleTestMoloni} 
                variant="outline" 
                disabled={loading || !configuracoes.moloni?.ativo}
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
