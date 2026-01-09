import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { 
  Settings, Save, RefreshCw, FileSpreadsheet, Columns, Play, 
  CheckCircle, AlertCircle, Loader2, Fuel, Zap, Car, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Configuração padrão dos campos para cada plataforma
const defaultFieldMappings = {
  uber: {
    nome: 'Uber',
    campos: [
      { id: 'uuid_motorista', label: 'UUID Motorista', coluna: 'UUID do motorista', obrigatorio: true },
      { id: 'nome_motorista', label: 'Nome', coluna: 'Nome próprio do motorista', obrigatorio: true },
      { id: 'apelido_motorista', label: 'Apelido', coluna: 'Apelido do motorista', obrigatorio: false },
      { id: 'pago_total', label: 'Valor Pago', coluna: 'Pago a si', obrigatorio: true },
      { id: 'gorjetas', label: 'Gorjetas', coluna: 'Gorjetas', obrigatorio: false },
      { id: 'viagens', label: 'Nº Viagens', coluna: 'Viagens', obrigatorio: false }
    ]
  },
  bolt: {
    nome: 'Bolt',
    campos: [
      { id: 'nome_motorista', label: 'Nome Motorista', coluna: 'Motorista', obrigatorio: true },
      { id: 'email', label: 'Email', coluna: 'Email', obrigatorio: false },
      { id: 'ganhos_brutos', label: 'Ganhos Brutos', coluna: 'Ganhos brutos (total)|€', obrigatorio: false },
      { id: 'ganhos_liquidos', label: 'Ganhos Líquidos', coluna: 'Ganhos líquidos (total)|€', obrigatorio: true },
      { id: 'comissoes', label: 'Comissões', coluna: 'Comissões|€', obrigatorio: false },
      { id: 'bonus', label: 'Bónus', coluna: 'Bónus|€', obrigatorio: false }
    ]
  },
  viaverde: {
    nome: 'Via Verde',
    campos: [
      { id: 'matricula', label: 'Matrícula', coluna: 'License Plate', obrigatorio: true },
      { id: 'obu', label: 'OBU', coluna: 'OBU', obrigatorio: false },
      { id: 'data', label: 'Data Entrada', coluna: 'Entry Date', obrigatorio: true },
      { id: 'valor', label: 'Valor Líquido', coluna: 'Liquid Value', obrigatorio: true },
      { id: 'market_description', label: 'Tipo (portagens/parques)', coluna: 'Market Description', obrigatorio: true },
      { id: 'entrada', label: 'Ponto Entrada', coluna: 'Entry Point', obrigatorio: false },
      { id: 'saida', label: 'Ponto Saída', coluna: 'Exit Point', obrigatorio: false }
    ]
  },
  combustivel: {
    nome: 'Combustível',
    campos: [
      { id: 'data', label: 'Data', coluna: 'DATA', obrigatorio: true },
      { id: 'hora', label: 'Hora', coluna: 'HORA', obrigatorio: false },
      { id: 'cartao', label: 'Nº Cartão', coluna: 'CARTÃO', obrigatorio: false },
      { id: 'desc_cartao', label: 'Desc. Cartão/Matrícula', coluna: 'DESC. CARTÃO', obrigatorio: true },
      { id: 'valor_liquido', label: 'Valor Líquido', coluna: 'VALOR LÍQUIDO', obrigatorio: true },
      { id: 'iva', label: 'IVA', coluna: 'IVA', obrigatorio: false },
      { id: 'total', label: 'Total', coluna: 'TOTAL', obrigatorio: false },
      { id: 'litros', label: 'Litros', coluna: 'LITROS', obrigatorio: false }
    ]
  },
  eletrico: {
    nome: 'Carregamentos Elétricos',
    campos: [
      { id: 'data', label: 'Data', coluna: 'StartDate', obrigatorio: true },
      { id: 'cartao', label: 'Código Cartão', coluna: 'CardCode', obrigatorio: true },
      { id: 'matricula', label: 'Matrícula', coluna: 'MobileRegistration', obrigatorio: false },
      { id: 'energia', label: 'Energia (kWh)', coluna: 'Energy', obrigatorio: false },
      { id: 'duracao', label: 'Duração', coluna: 'TotalDuration', obrigatorio: false },
      { id: 'valor', label: 'Valor Total', coluna: 'TotalValueWithTaxes', obrigatorio: true },
      { id: 'posto', label: 'ID Posto', coluna: 'IdChargingStation', obrigatorio: false }
    ]
  },
  gps: {
    nome: 'GPS/Trajetos',
    campos: [
      { id: 'matricula', label: 'Matrícula', coluna: 'matricula', obrigatorio: true },
      { id: 'data', label: 'Data', coluna: 'data', obrigatorio: true },
      { id: 'km', label: 'Quilómetros', coluna: 'km', obrigatorio: true },
      { id: 'origem', label: 'Origem', coluna: 'origem', obrigatorio: false },
      { id: 'destino', label: 'Destino', coluna: 'destino', obrigatorio: false }
    ]
  }
};

const ConfiguracaoMapeamento = ({ user }) => {
  const [activeTab, setActiveTab] = useState('uber');
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSyncConfig, setAutoSyncConfig] = useState({
    uber: { enabled: false, frequencia: 'diario' },
    bolt: { enabled: false, frequencia: 'diario' },
    viaverde: { enabled: false, frequencia: 'semanal' },
    prio: { enabled: false, frequencia: 'semanal' },
    gps: { enabled: false, frequencia: 'diario' }
  });

  useEffect(() => {
    fetchMappings();
    fetchAutoSyncConfig();
  }, []);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/configuracao/mapeamento-campos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && Object.keys(response.data).length > 0) {
        setMappings(response.data);
      } else {
        // Use default mappings
        const defaults = {};
        Object.keys(defaultFieldMappings).forEach(plat => {
          defaults[plat] = defaultFieldMappings[plat].campos.map(c => ({
            ...c,
            colunaAtual: c.coluna
          }));
        });
        setMappings(defaults);
      }
    } catch (error) {
      console.error('Erro ao carregar mapeamentos:', error);
      // Use default mappings on error
      const defaults = {};
      Object.keys(defaultFieldMappings).forEach(plat => {
        defaults[plat] = defaultFieldMappings[plat].campos.map(c => ({
          ...c,
          colunaAtual: c.coluna
        }));
      });
      setMappings(defaults);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoSyncConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/configuracao/sincronizacao-auto`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setAutoSyncConfig(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Erro ao carregar config sync:', error);
    }
  };

  const handleMappingChange = (plataforma, campoId, novaColuna) => {
    setMappings(prev => ({
      ...prev,
      [plataforma]: prev[plataforma]?.map(campo =>
        campo.id === campoId ? { ...campo, colunaAtual: novaColuna } : campo
      ) || defaultFieldMappings[plataforma].campos.map(c => ({
        ...c,
        colunaAtual: c.id === campoId ? novaColuna : c.coluna
      }))
    }));
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/configuracao/mapeamento-campos`,
        mappings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mapeamentos salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      toast.error('Erro ao salvar mapeamentos');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSyncChange = (plataforma, field, value) => {
    setAutoSyncConfig(prev => ({
      ...prev,
      [plataforma]: { ...prev[plataforma], [field]: value }
    }));
  };

  const handleSaveAutoSync = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/configuracao/sincronizacao-auto`,
        autoSyncConfig,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuração de sincronização salva!');
    } catch (error) {
      console.error('Erro ao salvar config sync:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const renderMappingTable = (plataforma) => {
    const config = defaultFieldMappings[plataforma];
    const currentMappings = mappings[plataforma] || config.campos.map(c => ({ ...c, colunaAtual: c.coluna }));

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Columns className="w-5 h-5" />
            Mapeamento de Campos - {config.nome}
          </CardTitle>
          <CardDescription>
            Configure quais colunas do ficheiro correspondem a cada campo do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo do Sistema</TableHead>
                <TableHead>Coluna no Ficheiro</TableHead>
                <TableHead>Obrigatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentMappings.map((campo) => (
                <TableRow key={campo.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{campo.label}</span>
                      <p className="text-xs text-slate-500">{campo.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={campo.colunaAtual || campo.coluna}
                      onChange={(e) => handleMappingChange(plataforma, campo.id, e.target.value)}
                      placeholder="Nome da coluna"
                      className="max-w-[250px]"
                    />
                  </TableCell>
                  <TableCell>
                    {campo.obrigatorio ? (
                      <Badge className="bg-red-100 text-red-700">Obrigatório</Badge>
                    ) : (
                      <Badge variant="outline">Opcional</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveMappings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A salvar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Mapeamento
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAutoSyncConfig = () => {
    const plataformas = [
      { id: 'uber', nome: 'Uber', icon: <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white text-xs font-bold">U</div> },
      { id: 'bolt', nome: 'Bolt', icon: <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">B</div> },
      { id: 'viaverde', nome: 'Via Verde', icon: <CreditCard className="w-6 h-6 text-emerald-600" /> },
      { id: 'prio', nome: 'Prio Energy', icon: <Zap className="w-6 h-6 text-blue-500" /> },
      { id: 'gps', nome: 'GPS/Trajetos', icon: <Car className="w-6 h-6 text-slate-600" /> }
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sincronização Automática
          </CardTitle>
          <CardDescription>
            Configure a importação automática de dados das plataformas.
            As credenciais são configuradas pelo parceiro nas suas definições de conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plataformas.map((plat) => (
              <div key={plat.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {plat.icon}
                  <div>
                    <p className="font-medium">{plat.nome}</p>
                    <p className="text-sm text-slate-500">
                      {autoSyncConfig[plat.id]?.enabled ? 'Ativo' : 'Desativado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Select
                    value={autoSyncConfig[plat.id]?.frequencia || 'diario'}
                    onValueChange={(value) => handleAutoSyncChange(plat.id, 'frequencia', value)}
                    disabled={!autoSyncConfig[plat.id]?.enabled}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch
                    checked={autoSyncConfig[plat.id]?.enabled || false}
                    onCheckedChange={(checked) => handleAutoSyncChange(plat.id, 'enabled', checked)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Nota:</p>
                <p>As credenciais de acesso às plataformas (login/password) são configuradas por cada parceiro nas suas definições de conta, de forma encriptada e segura.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveAutoSync} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A salvar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuração de Importação</h1>
        <p className="text-slate-500">Configure o mapeamento de campos e sincronização automática</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="uber">Uber</TabsTrigger>
          <TabsTrigger value="bolt">Bolt</TabsTrigger>
          <TabsTrigger value="viaverde">Via Verde</TabsTrigger>
          <TabsTrigger value="combustivel">Combustível</TabsTrigger>
          <TabsTrigger value="eletrico">Elétrico</TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
          <TabsTrigger value="sync">Sync Auto</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="uber">{renderMappingTable('uber')}</TabsContent>
          <TabsContent value="bolt">{renderMappingTable('bolt')}</TabsContent>
          <TabsContent value="viaverde">{renderMappingTable('viaverde')}</TabsContent>
          <TabsContent value="combustivel">{renderMappingTable('combustivel')}</TabsContent>
          <TabsContent value="eletrico">{renderMappingTable('eletrico')}</TabsContent>
          <TabsContent value="gps">{renderMappingTable('gps')}</TabsContent>
          <TabsContent value="sync">{renderAutoSyncConfig()}</TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ConfiguracaoMapeamento;
