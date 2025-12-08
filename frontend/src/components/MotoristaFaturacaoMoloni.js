import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  FileText, Save, Eye, EyeOff, AlertCircle, CheckCircle, 
  RefreshCw, Info, Lock 
} from 'lucide-react';

const MotoristaFaturacaoMoloni = ({ motoristaData, onUpdate }) => {
  const [config, setConfig] = useState({
    ativo: false,
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    company_id: '',
    custo_mensal_extra: 10.00
  });
  
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [moduloDisponivel, setModuloDisponivel] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [motoristaData]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/motoristas/${motoristaData.id}/moloni-config`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setConfig(response.data);
      setModuloDisponivel(response.data.modulo_disponivel || false);
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
        `${API}/motoristas/${motoristaData.id}/moloni-config`,
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Configuração Moloni guardada com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving Moloni config:', error);
      const errorMsg = error.response?.data?.detail || 'Erro ao guardar configuração Moloni';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/motoristas/${motoristaData.id}/moloni-config/testar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Conexão com Moloni testada com sucesso!');
      } else {
        toast.error(response.data.message || 'Falha ao testar conexão com Moloni');
      }
    } catch (error) {
      console.error('Error testing Moloni connection:', error);
      toast.error('Erro ao testar conexão Moloni');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!moduloDisponivel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="w-6 h-6 text-amber-600" />
            <span>Auto-Faturação Moloni</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Módulo não disponível no seu plano atual</p>
              <p className="text-sm text-slate-600">
                O módulo de auto-faturação Moloni não está incluído no seu plano. 
                Contacte o administrador para fazer upgrade do plano e aceder a esta funcionalidade.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Configuração Auto-Faturação Moloni</span>
            </CardTitle>
            <Badge variant={config.ativo ? "success" : "secondary"}>
              {config.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <p className="text-sm">
                Configure suas credenciais Moloni para ativar a auto-faturação. 
                Quando ativo, o sistema gerará automaticamente faturas Moloni ao emitir recibos.
              </p>
              <p className="text-sm mt-2">
                <strong>Custo adicional:</strong> €{config.custo_mensal_extra}/mês
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Config Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credenciais Moloni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ativo Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="moloni-ativo"
              checked={config.ativo}
              onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="moloni-ativo" className="cursor-pointer">
              Ativar auto-faturação Moloni
            </Label>
          </div>

          {/* Client ID */}
          <div>
            <Label>Client ID *</Label>
            <Input
              type="text"
              value={config.client_id}
              onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
              placeholder="Digite o Client ID da API Moloni"
              disabled={!config.ativo}
            />
          </div>

          {/* Client Secret */}
          <div>
            <Label>Client Secret *</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={config.client_secret}
                onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                placeholder={config.client_secret_masked || "Digite o Client Secret"}
                disabled={!config.ativo}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Username */}
          <div>
            <Label>Username (Email Moloni) *</Label>
            <Input
              type="email"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="seu@email.com"
              disabled={!config.ativo}
            />
          </div>

          {/* Password */}
          <div>
            <Label>Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="Digite a senha da conta Moloni"
                disabled={!config.ativo}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Company ID */}
          <div>
            <Label>Company ID *</Label>
            <Input
              type="text"
              value={config.company_id}
              onChange={(e) => setConfig({ ...config, company_id: e.target.value })}
              placeholder="ID da empresa no Moloni"
              disabled={!config.ativo}
            />
            <p className="text-xs text-slate-500 mt-1">
              Encontre o Company ID nas configurações da sua conta Moloni
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={!config.ativo || testing || !config.client_id || !config.username}
              className="flex-1"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testando...' : 'Testar Conexão'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Configuração'}
            </Button>
          </div>

          {/* Info */}
          <Alert className="mt-4">
            <Info className="w-4 h-4" />
            <AlertDescription>
              <p className="text-sm font-semibold mb-1">Como obter as credenciais:</p>
              <ol className="text-xs text-slate-600 space-y-1 ml-4 list-decimal">
                <li>Aceda à sua conta Moloni</li>
                <li>Vá para Configurações → API → Developers</li>
                <li>Crie uma nova aplicação ou use uma existente</li>
                <li>Copie o Client ID e Client Secret</li>
                <li>Use o seu email e senha de login do Moloni</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default MotoristaFaturacaoMoloni;
