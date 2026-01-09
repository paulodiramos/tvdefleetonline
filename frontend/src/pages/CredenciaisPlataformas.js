import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { 
  Lock, Eye, EyeOff, Save, Shield, CheckCircle, AlertCircle, 
  Loader2, Key, RefreshCw, Zap, Car, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CredenciaisPlataformas = ({ user }) => {
  const [credenciais, setCredenciais] = useState({
    uber: { email: '', password: '', configurado: false },
    bolt: { email: '', password: '', configurado: false },
    viaverde: { username: '', password: '', configurado: false },
    prio: { email: '', password: '', cartao: '', configurado: false },
    gps: { api_key: '', configurado: false }
  });
  const [showPasswords, setShowPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [testingConnection, setTestingConnection] = useState({});

  useEffect(() => {
    fetchCredenciais();
  }, []);

  const fetchCredenciais = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/parceiro/credenciais-plataformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        // Merge with default state (passwords come empty for security)
        const merged = { ...credenciais };
        response.data.forEach(cred => {
          if (merged[cred.plataforma]) {
            merged[cred.plataforma] = {
              ...merged[cred.plataforma],
              ...cred,
              password: '', // Never show password
              configurado: true
            };
          }
        });
        setCredenciais(merged);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (plataforma, field, value) => {
    setCredenciais(prev => ({
      ...prev,
      [plataforma]: { ...prev[plataforma], [field]: value }
    }));
  };

  const handleSaveCredencial = async (plataforma) => {
    setSaving(prev => ({ ...prev, [plataforma]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const cred = credenciais[plataforma];
      
      // Only send if there's actual data
      const payload = {
        plataforma,
        ...cred
      };
      
      // Remove empty password if credential already exists
      if (cred.configurado && !cred.password) {
        delete payload.password;
      }

      await axios.post(
        `${API_URL}/api/parceiro/credenciais-plataformas`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCredenciais(prev => ({
        ...prev,
        [plataforma]: { ...prev[plataforma], configurado: true, password: '' }
      }));
      
      toast.success(`Credenciais ${plataforma} salvas com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast.error('Erro ao salvar credenciais');
    } finally {
      setSaving(prev => ({ ...prev, [plataforma]: false }));
    }
  };

  const handleTestConnection = async (plataforma) => {
    setTestingConnection(prev => ({ ...prev, [plataforma]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/parceiro/testar-conexao/${plataforma}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Conexão ${plataforma} testada com sucesso!`);
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTestingConnection(prev => ({ ...prev, [plataforma]: false }));
    }
  };

  const togglePasswordVisibility = (plataforma) => {
    setShowPasswords(prev => ({ ...prev, [plataforma]: !prev[plataforma] }));
  };

  const renderCredencialCard = (plataforma, nome, icon, fields) => {
    const cred = credenciais[plataforma];
    const isSaving = saving[plataforma];
    const isTesting = testingConnection[plataforma];
    const showPassword = showPasswords[plataforma];

    return (
      <Card key={plataforma} className={cred.configurado ? 'border-green-200' : ''}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <CardTitle className="text-lg">{nome}</CardTitle>
                <CardDescription>
                  {cred.configurado ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" /> Configurado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <AlertCircle className="w-3 h-3" /> Não configurado
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            {cred.configurado && (
              <Badge className="bg-green-100 text-green-700">Ativo</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`${plataforma}-${field.id}`}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={`${plataforma}-${field.id}`}
                  type={field.type === 'password' && !showPassword ? 'password' : 'text'}
                  value={cred[field.id] || ''}
                  onChange={(e) => handleInputChange(plataforma, field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="pr-10"
                />
                {field.type === 'password' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => togglePasswordVisibility(plataforma)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </Button>
                )}
              </div>
              {field.hint && (
                <p className="text-xs text-slate-500">{field.hint}</p>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleSaveCredencial(plataforma)}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A salvar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
            {cred.configurado && (
              <Button
                variant="outline"
                onClick={() => handleTestConnection(plataforma)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Credenciais das Plataformas</h1>
        <p className="text-slate-500">Configure as credenciais de acesso para importação automática</p>
      </div>

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Segurança das suas credenciais</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>As passwords são encriptadas antes de serem armazenadas</li>
                <li>Apenas o sistema de sincronização automática tem acesso</li>
                <li>Pode alterar ou remover as credenciais a qualquer momento</li>
                <li>Recomendamos usar autenticação de dois factores quando disponível</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credential Cards Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {renderCredencialCard(
          'uber',
          'Uber',
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">U</div>,
          [
            { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
            { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' }
          ]
        )}

        {renderCredencialCard(
          'bolt',
          'Bolt',
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">B</div>,
          [
            { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
            { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' }
          ]
        )}

        {renderCredencialCard(
          'viaverde',
          'Via Verde',
          <CreditCard className="w-10 h-10 text-emerald-600" />,
          [
            { id: 'username', label: 'Utilizador', type: 'text', placeholder: 'Nº de cliente ou email' },
            { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••' }
          ]
        )}

        {renderCredencialCard(
          'prio',
          'Prio Energy',
          <Zap className="w-10 h-10 text-blue-500" />,
          [
            { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
            { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
            { id: 'cartao', label: 'Nº Cartão (opcional)', type: 'text', placeholder: 'PTPRIO...' }
          ]
        )}

        {renderCredencialCard(
          'gps',
          'GPS/Trajetos',
          <Car className="w-10 h-10 text-slate-600" />,
          [
            { id: 'api_key', label: 'API Key', type: 'password', placeholder: 'Chave de API do sistema GPS', hint: 'Fornecida pelo seu provedor de GPS' }
          ]
        )}
      </div>

      {/* Help Text */}
      <Card className="bg-slate-50">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Key className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium mb-1">Como funciona a sincronização automática?</p>
              <p>
                Quando as credenciais estão configuradas e a sincronização automática está ativa (configurada pelo administrador), 
                o sistema irá periodicamente fazer login nas plataformas e importar os dados mais recentes automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CredenciaisPlataformas;
