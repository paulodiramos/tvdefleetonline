import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileText, AlertCircle, Check, X, Loader2 } from 'lucide-react';

const MoloniConfig = ({ motorista_id, isOwnProfile }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    ativo: false,
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    company_id: '',
    custo_mensal_extra: 10.00,
    modulo_disponivel: false
  });

  useEffect(() => {
    fetchConfig();
  }, [motorista_id]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${motorista_id}/moloni-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching Moloni config:', error);
      toast.error('Erro ao carregar configuração Moloni');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/motoristas/${motorista_id}/moloni-config`,
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração Moloni salva com sucesso!');
      fetchConfig();
    } catch (error) {
      console.error('Error saving Moloni config:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/motoristas/${motorista_id}/moloni-config/testar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message || 'Conexão testada com sucesso!');
    } catch (error) {
      console.error('Error testing Moloni:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600 mt-4">A carregar configuração...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <CardTitle>Auto-Faturação Moloni</CardTitle>
            <CardDescription>
              Configure a emissão automática de faturas via Moloni
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert Explicativo ou Aviso de Módulo Indisponível */}
        {!config.modulo_disponivel ? (
          <Alert className="bg-amber-50 border-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <p className="font-semibold mb-2 text-amber-900">⚠️ Módulo não disponível no seu plano</p>
              <div className="text-sm text-amber-800 space-y-2">
                <p>
                  O módulo de Auto-Faturação Moloni não está incluído no seu plano atual.
                </p>
                <p>
                  <strong>Para ativar este módulo:</strong>
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Contacte o administrador ou gestor da plataforma</li>
                  <li>Solicite upgrade para um plano que inclua "moloni_auto_faturacao"</li>
                  <li>Após upgrade, poderá configurar suas credenciais Moloni</li>
                </ul>
                <p className="mt-2 text-xs">
                  Custo estimado do módulo: €{config.custo_mensal_extra}/mês (adicional ao plano)
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Como funciona:</p>
              <ul className="text-sm space-y-1 ml-4 list-disc">
                <li>Ative a auto-faturação para emitir faturas automaticamente ao parceiro</li>
                <li>Custo extra mensal: €{config.custo_mensal_extra}</li>
                <li>Faturas são geradas quando relatórios são emitidos</li>
                <li>Precisa de conta Moloni ativa com API configurada</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Toggle Ativar */}
        <div className={`flex items-center justify-between p-4 rounded-lg ${!config.modulo_disponivel ? 'bg-slate-100 opacity-60' : 'bg-slate-50'}`}>
          <div className="flex-1">
            <Label htmlFor="moloni-active" className="text-base font-semibold">
              Ativar Auto-Faturação
              {!config.modulo_disponivel && (
                <span className="ml-2 text-xs text-amber-600 font-normal">(Requer módulo no plano)</span>
              )}
            </Label>
            <p className="text-sm text-slate-600 mt-1">
              {config.ativo 
                ? `Ativo desde ${config.data_ativacao ? new Date(config.data_ativacao).toLocaleDateString('pt-PT') : 'N/A'}`
                : !config.modulo_disponivel
                  ? 'Módulo não disponível no plano'
                  : 'Sistema desativado'
              }
            </p>
          </div>
          <Switch
            id="moloni-active"
            checked={config.ativo}
            onCheckedChange={(checked) => setConfig({...config, ativo: checked})}
            disabled={!config.modulo_disponivel}
          />
        </div>

        <Separator />

        {/* Campos de Configuração */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800">Credenciais Moloni API</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-id">Client ID *</Label>
              <Input
                id="client-id"
                type="text"
                value={config.client_id}
                onChange={(e) => setConfig({...config, client_id: e.target.value})}
                placeholder="Ex: abc123..."
                disabled={!config.ativo || !config.modulo_disponivel}
              />
            </div>

            <div>
              <Label htmlFor="client-secret">Client Secret *</Label>
              <Input
                id="client-secret"
                type="password"
                value={config.client_secret}
                onChange={(e) => setConfig({...config, client_secret: e.target.value})}
                placeholder={config.client_secret_masked || "Ex: xyz789..."}
                disabled={!config.ativo || !config.modulo_disponivel}
              />
              {config.client_secret_masked && (
                <p className="text-xs text-slate-500 mt-1">
                  Atual: {config.client_secret_masked} (deixe vazio para manter)
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                type="text"
                value={config.username}
                onChange={(e) => setConfig({...config, username: e.target.value})}
                placeholder="Seu username Moloni"
                disabled={!config.ativo || !config.modulo_disponivel}
              />
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => setConfig({...config, password: e.target.value})}
                placeholder="Sua senha Moloni"
                disabled={!config.ativo || !config.modulo_disponivel}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="company-id">Company ID *</Label>
              <Input
                id="company-id"
                type="text"
                value={config.company_id}
                onChange={(e) => setConfig({...config, company_id: e.target.value})}
                placeholder="ID da empresa no Moloni"
                disabled={!config.ativo || !config.modulo_disponivel}
              />
              <p className="text-xs text-slate-500 mt-1">
                Encontre o Company ID no painel Moloni em Configurações &gt; API
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        {config.ativo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">Auto-faturação ativa</span>
            </div>
            <p className="text-sm text-green-700 mt-2">
              Faturas serão geradas automaticamente ao parceiro associado quando relatórios forem emitidos.
            </p>
          </div>
        )}

        {!config.ativo && config.data_ativacao && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800">Auto-faturação desativada</span>
            </div>
            <p className="text-sm text-amber-700 mt-2">
              Sistema estava ativo anteriormente. Ative novamente para retomar a emissão automática.
            </p>
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center space-x-3 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={saving || !config.ativo || !config.modulo_disponivel}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A salvar...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </Button>
          
          <Button 
            onClick={handleTest} 
            variant="outline"
            disabled={testing || !config.ativo || !config.client_id || !config.modulo_disponivel}
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A testar...
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
        </div>

        {/* Aviso */}
        <Alert className="bg-slate-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs text-slate-600">
            <strong>Nota:</strong> As credenciais são armazenadas de forma segura. 
            Certifique-se de que tem permissões de API ativas na sua conta Moloni.
            Para obter credenciais, aceda a <a href="https://www.moloni.pt" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">moloni.pt</a> &gt; Configurações &gt; API.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default MoloniConfig;
