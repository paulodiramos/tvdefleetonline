import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, Lock, Eye, EyeOff, Save, Shield, CheckCircle, AlertCircle, 
  Loader2, Key, RefreshCw, Zap, Car, CreditCard, Smartphone, Plus, Trash2,
  Fuel, MapPin
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CredenciaisPlataformas = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('plataformas');
  
  // Credenciais das plataformas fixas
  const [credenciais, setCredenciais] = useState({
    uber: { email: '', phone: '', otp_code: '', configurado: false },
    bolt: { email: '', password: '', configurado: false },
    viaverde: { username: '', password: '', configurado: false }
  });
  
  // Fornecedores de combustível (variáveis)
  const [combustiveis, setCombustiveis] = useState([
    { id: 'prio', nome: 'Prio Energy', email: '', password: '', cartao: '', configurado: false, principal: true }
  ]);
  
  // Fornecedores GPS (variáveis)
  const [gps, setGps] = useState([
    { id: 'verifon', nome: 'Verifon', api_key: '', username: '', password: '', configurado: false, principal: true },
    { id: 'radius', nome: 'Radius', api_key: '', username: '', password: '', configurado: false, principal: false }
  ]);
  
  // Lista de fornecedores disponíveis (configurados pelo admin)
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState({
    combustivel: ['prio', 'galp', 'bp', 'repsol', 'cepsa'],
    gps: ['verifon', 'radius', 'frotcom', 'webfleet', 'masternaut']
  });
  
  const [showPasswords, setShowPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [testingConnection, setTestingConnection] = useState({});

  useEffect(() => {
    fetchCredenciais();
    fetchFornecedoresDisponiveis();
  }, []);

  const fetchCredenciais = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/parceiro/credenciais-plataformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        // Merge with default state
        const merged = { ...credenciais };
        const combList = [...combustiveis];
        const gpsList = [...gps];
        
        response.data.forEach(cred => {
          if (cred.tipo === 'plataforma' && merged[cred.plataforma]) {
            merged[cred.plataforma] = {
              ...merged[cred.plataforma],
              ...cred,
              password: '',
              configurado: true
            };
          } else if (cred.tipo === 'combustivel') {
            const idx = combList.findIndex(c => c.id === cred.fornecedor_id);
            if (idx >= 0) {
              combList[idx] = { ...combList[idx], ...cred, password: '', configurado: true };
            } else {
              combList.push({ ...cred, id: cred.fornecedor_id, password: '', configurado: true });
            }
          } else if (cred.tipo === 'gps') {
            const idx = gpsList.findIndex(g => g.id === cred.fornecedor_id);
            if (idx >= 0) {
              gpsList[idx] = { ...gpsList[idx], ...cred, password: '', api_key: '', configurado: true };
            } else {
              gpsList.push({ ...cred, id: cred.fornecedor_id, password: '', api_key: '', configurado: true });
            }
          }
        });
        
        setCredenciais(merged);
        setCombustiveis(combList);
        setGps(gpsList);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFornecedoresDisponiveis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/admin/fornecedores-disponiveis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setFornecedoresDisponiveis(response.data);
      }
    } catch (error) {
      // Use default list if API not available
      console.log('Using default fornecedores list');
    }
  };

  const handleInputChange = (tipo, id, field, value) => {
    if (tipo === 'plataforma') {
      setCredenciais(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: value }
      }));
    } else if (tipo === 'combustivel') {
      setCombustiveis(prev => prev.map(c => 
        c.id === id ? { ...c, [field]: value } : c
      ));
    } else if (tipo === 'gps') {
      setGps(prev => prev.map(g => 
        g.id === id ? { ...g, [field]: value } : g
      ));
    }
  };

  const handleSaveCredencial = async (tipo, id) => {
    const saveKey = `${tipo}-${id}`;
    setSaving(prev => ({ ...prev, [saveKey]: true }));
    
    try {
      const token = localStorage.getItem('token');
      let payload = { tipo };
      
      if (tipo === 'plataforma') {
        const cred = credenciais[id];
        payload = { ...payload, plataforma: id, ...cred };
        if (cred.configurado && !cred.password && !cred.otp_code) {
          delete payload.password;
          delete payload.otp_code;
        }
      } else if (tipo === 'combustivel') {
        const cred = combustiveis.find(c => c.id === id);
        payload = { ...payload, fornecedor_id: id, ...cred };
        if (cred.configurado && !cred.password) {
          delete payload.password;
        }
      } else if (tipo === 'gps') {
        const cred = gps.find(g => g.id === id);
        payload = { ...payload, fornecedor_id: id, ...cred };
        if (cred.configurado && !cred.password && !cred.api_key) {
          delete payload.password;
          delete payload.api_key;
        }
      }

      await axios.post(
        `${API_URL}/api/parceiro/credenciais-plataformas`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      if (tipo === 'plataforma') {
        setCredenciais(prev => ({
          ...prev,
          [id]: { ...prev[id], configurado: true, password: '', otp_code: '' }
        }));
      } else if (tipo === 'combustivel') {
        setCombustiveis(prev => prev.map(c => 
          c.id === id ? { ...c, configurado: true, password: '' } : c
        ));
      } else if (tipo === 'gps') {
        setGps(prev => prev.map(g => 
          g.id === id ? { ...g, configurado: true, password: '', api_key: '' } : g
        ));
      }
      
      toast.success(`Credenciais guardadas com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast.error('Erro ao guardar credenciais');
    } finally {
      setSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleTestConnection = async (tipo, id) => {
    const testKey = `${tipo}-${id}`;
    setTestingConnection(prev => ({ ...prev, [testKey]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/parceiro/testar-conexao/${tipo}/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Conexão testada com sucesso!`);
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTestingConnection(prev => ({ ...prev, [testKey]: false }));
    }
  };

  const togglePasswordVisibility = (key) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addFornecedor = (tipo) => {
    if (tipo === 'combustivel') {
      const newId = `comb_${Date.now()}`;
      setCombustiveis(prev => [...prev, {
        id: newId,
        nome: '',
        email: '',
        password: '',
        cartao: '',
        configurado: false,
        principal: false,
        isNew: true
      }]);
    } else if (tipo === 'gps') {
      const newId = `gps_${Date.now()}`;
      setGps(prev => [...prev, {
        id: newId,
        nome: '',
        api_key: '',
        username: '',
        password: '',
        configurado: false,
        principal: false,
        isNew: true
      }]);
    }
  };

  const removeFornecedor = (tipo, id) => {
    if (tipo === 'combustivel') {
      setCombustiveis(prev => prev.filter(c => c.id !== id));
    } else if (tipo === 'gps') {
      setGps(prev => prev.filter(g => g.id !== id));
    }
  };

  // Render plataforma card (Uber, Bolt, Via Verde)
  const renderPlataformaCard = (plataforma, nome, icon, fields, description) => {
    const cred = credenciais[plataforma];
    const saveKey = `plataforma-${plataforma}`;
    const isSaving = saving[saveKey];
    const isTesting = testingConnection[saveKey];

    return (
      <Card key={plataforma} className={cred.configurado ? 'border-green-200 bg-green-50/30' : ''}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <CardTitle className="text-lg">{nome}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {description}
                </CardDescription>
              </div>
            </div>
            {cred.configurado ? (
              <Badge className="bg-green-100 text-green-700 border-green-300">
                <CheckCircle className="w-3 h-3 mr-1" /> Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500">
                <AlertCircle className="w-3 h-3 mr-1" /> Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`${plataforma}-${field.id}`} className="text-sm font-medium">
                {field.label}
              </Label>
              <div className="relative">
                <Input
                  id={`${plataforma}-${field.id}`}
                  type={field.type === 'password' && !showPasswords[`${plataforma}-${field.id}`] ? 'password' : 'text'}
                  value={cred[field.id] || ''}
                  onChange={(e) => handleInputChange('plataforma', plataforma, field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="pr-10"
                />
                {field.type === 'password' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => togglePasswordVisibility(`${plataforma}-${field.id}`)}
                  >
                    {showPasswords[`${plataforma}-${field.id}`] ? (
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
              onClick={() => handleSaveCredencial('plataforma', plataforma)}
              disabled={isSaving}
              className="flex-1"
              data-testid={`save-${plataforma}-btn`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
            {cred.configurado && (
              <Button
                variant="outline"
                onClick={() => handleTestConnection('plataforma', plataforma)}
                disabled={isTesting}
                data-testid={`test-${plataforma}-btn`}
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

  // Render fornecedor card (Combustível ou GPS)
  const renderFornecedorCard = (tipo, fornecedor, fields) => {
    const saveKey = `${tipo}-${fornecedor.id}`;
    const isSaving = saving[saveKey];
    const isTesting = testingConnection[saveKey];

    return (
      <Card key={fornecedor.id} className={fornecedor.configurado ? 'border-green-200 bg-green-50/30' : ''}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tipo === 'combustivel' ? (
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Fuel className="w-5 h-5 text-orange-600" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
              )}
              <div>
                {fornecedor.isNew ? (
                  <Input
                    value={fornecedor.nome}
                    onChange={(e) => handleInputChange(tipo, fornecedor.id, 'nome', e.target.value)}
                    placeholder="Nome do fornecedor"
                    className="h-8 text-base font-semibold"
                  />
                ) : (
                  <CardTitle className="text-lg">{fornecedor.nome}</CardTitle>
                )}
                {fornecedor.principal && (
                  <Badge variant="secondary" className="text-xs mt-1">Principal</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fornecedor.configurado ? (
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" /> Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500">
                  <AlertCircle className="w-3 h-3 mr-1" /> Pendente
                </Badge>
              )}
              {!fornecedor.principal && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeFornecedor(tipo, fornecedor.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`${fornecedor.id}-${field.id}`} className="text-sm font-medium">
                {field.label}
              </Label>
              <div className="relative">
                <Input
                  id={`${fornecedor.id}-${field.id}`}
                  type={field.type === 'password' && !showPasswords[`${fornecedor.id}-${field.id}`] ? 'password' : 'text'}
                  value={fornecedor[field.id] || ''}
                  onChange={(e) => handleInputChange(tipo, fornecedor.id, field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="pr-10"
                />
                {field.type === 'password' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => togglePasswordVisibility(`${fornecedor.id}-${field.id}`)}
                  >
                    {showPasswords[`${fornecedor.id}-${field.id}`] ? (
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
              onClick={() => handleSaveCredencial(tipo, fornecedor.id)}
              disabled={isSaving}
              className="flex-1"
              data-testid={`save-${fornecedor.id}-btn`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
            {fornecedor.configurado && (
              <Button
                variant="outline"
                onClick={() => handleTestConnection(tipo, fornecedor.id)}
                disabled={isTesting}
                data-testid={`test-${fornecedor.id}-btn`}
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
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="credenciais-plataformas-page">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full hover:bg-slate-100"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Credenciais das Plataformas</h1>
            <p className="text-slate-500 text-sm">Configure as credenciais de acesso para importação automática</p>
          </div>
        </div>

        {/* Security Notice */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Segurança das suas credenciais</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                  <li>As passwords são encriptadas antes de serem armazenadas</li>
                  <li>Apenas o sistema de sincronização automática tem acesso</li>
                  <li>Pode alterar ou remover as credenciais a qualquer momento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="plataformas" className="flex items-center gap-2" data-testid="tab-plataformas">
              <Car className="w-4 h-4" />
              Plataformas
            </TabsTrigger>
            <TabsTrigger value="combustivel" className="flex items-center gap-2" data-testid="tab-combustivel">
              <Fuel className="w-4 h-4" />
              Combustível
            </TabsTrigger>
            <TabsTrigger value="gps" className="flex items-center gap-2" data-testid="tab-gps">
              <MapPin className="w-4 h-4" />
              GPS
            </TabsTrigger>
          </TabsList>

          {/* Plataformas Tab - Fixed: Uber, Bolt, Via Verde */}
          <TabsContent value="plataformas" className="space-y-4">
            <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Uber - with SMS OTP */}
              {renderPlataformaCard(
                'uber',
                'Uber',
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">U</div>,
                [
                  { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
                  { id: 'phone', label: 'Telemóvel', type: 'tel', placeholder: '+351 912 345 678', hint: 'Número para receber código SMS' },
                  { id: 'otp_code', label: 'Código SMS (1x)', type: 'text', placeholder: '123456', hint: 'Código enviado por SMS para autenticação inicial' }
                ],
                'Autenticação com código SMS enviado para o telemóvel'
              )}

              {/* Bolt */}
              {renderPlataformaCard(
                'bolt',
                'Bolt',
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">B</div>,
                [
                  { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
                  { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' }
                ],
                'Credenciais de acesso à plataforma Bolt'
              )}

              {/* Via Verde */}
              {renderPlataformaCard(
                'viaverde',
                'Via Verde',
                <CreditCard className="w-10 h-10 text-emerald-600" />,
                [
                  { id: 'username', label: 'Utilizador', type: 'text', placeholder: 'Nº de cliente ou email' },
                  { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' }
                ],
                'Credenciais de acesso ao portal Via Verde'
              )}
            </div>
          </TabsContent>

          {/* Combustível Tab - Variable providers */}
          <TabsContent value="combustivel" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-600">
                Configure os fornecedores de combustível utilizados pela sua frota
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFornecedor('combustivel')}
                className="flex items-center gap-2"
                data-testid="add-combustivel-btn"
              >
                <Plus className="w-4 h-4" />
                Adicionar Fornecedor
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {combustiveis.map(fornecedor => 
                renderFornecedorCard('combustivel', fornecedor, [
                  { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
                  { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' },
                  { id: 'cartao', label: 'Nº Cartão (opcional)', type: 'text', placeholder: 'Número do cartão de frota' }
                ])
              )}
            </div>
          </TabsContent>

          {/* GPS Tab - Variable providers */}
          <TabsContent value="gps" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-600">
                Configure os sistemas GPS/Trajetos utilizados pela sua frota
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFornecedor('gps')}
                className="flex items-center gap-2"
                data-testid="add-gps-btn"
              >
                <Plus className="w-4 h-4" />
                Adicionar Sistema GPS
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {gps.map(fornecedor => 
                renderFornecedorCard('gps', fornecedor, [
                  { id: 'username', label: 'Utilizador', type: 'text', placeholder: 'Username ou email' },
                  { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', hint: 'Deixe vazio para manter a password atual' },
                  { id: 'api_key', label: 'API Key (opcional)', type: 'password', placeholder: 'Chave de API', hint: 'Fornecida pelo provedor GPS' }
                ])
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Help Text */}
        <Card className="bg-slate-50">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Key className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium mb-1">Como funciona a sincronização automática?</p>
                <p className="text-xs">
                  Quando as credenciais estão configuradas e a sincronização automática está ativa, 
                  o sistema irá periodicamente fazer login nas plataformas e importar os dados mais recentes automaticamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CredenciaisPlataformas;
