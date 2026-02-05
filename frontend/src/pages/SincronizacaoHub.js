import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plug,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Settings,
  ExternalLink,
  Zap,
  Car,
  CreditCard,
  Fuel,
  MapPin
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Definição das integrações API
const API_INTEGRATIONS = [
  {
    id: 'bolt_api',
    name: 'Bolt Fleet API',
    description: 'Sincronização automática de ganhos e viagens via API oficial',
    icon: <Zap className="w-6 h-6 text-green-500" />,
    status: 'active', // active, pending, inactive
    dataTypes: ['Ganhos', 'Viagens', 'Motoristas'],
    configPath: '/admin/credenciais-bolt',
    color: 'green'
  },
  {
    id: 'uber_api',
    name: 'Uber Driver API',
    description: 'Integração com API de pagamentos da Uber (acesso limitado)',
    icon: <Car className="w-6 h-6 text-gray-400" />,
    status: 'pending', // Pendente aprovação
    dataTypes: ['Pagamentos', 'Viagens', 'Perfil'],
    configPath: null,
    color: 'gray',
    note: 'Aguarda aprovação da Uber'
  },
  {
    id: 'verizon_gps',
    name: 'Verizon GPS',
    description: 'Localização e tracking de veículos em tempo real',
    icon: <MapPin className="w-6 h-6 text-gray-400" />,
    status: 'inactive',
    dataTypes: ['Localização', 'Quilometragem', 'Rotas'],
    configPath: null,
    color: 'gray',
    note: 'Em desenvolvimento'
  }
];

// Definição das automações RPA
const RPA_AUTOMATIONS = [
  {
    id: 'uber_rpa',
    name: 'Uber Fleet Portal',
    description: 'Extração automática de relatórios de pagamentos via RPA',
    icon: <Car className="w-6 h-6 text-black" />,
    status: 'warning', // active, warning, error, inactive
    dataTypes: ['Relatórios PDF', 'Pagamentos'],
    configPath: '/parceiro/config-uber',
    designerPath: '/admin/rpa-designer',
    color: 'yellow',
    issue: 'Bug: Botão "Gerar" desativado'
  },
  {
    id: 'viaverde_rpa',
    name: 'Via Verde',
    description: 'Extração automática de extratos e movimentos de portagens',
    icon: <CreditCard className="w-6 h-6 text-green-600" />,
    status: 'warning',
    dataTypes: ['Extratos', 'Portagens', 'Movimentos'],
    configPath: '/admin/rpa-designer',
    designerPath: '/admin/rpa-designer',
    color: 'yellow',
    issue: 'Bug: Filtro de datas não funciona'
  },
  {
    id: 'prio_rpa',
    name: 'Prio Energy',
    description: 'Extração de faturas e consumos de combustível',
    icon: <Fuel className="w-6 h-6 text-orange-500" />,
    status: 'active',
    dataTypes: ['Faturas', 'Consumos', 'Cartões Frota'],
    configPath: '/admin/rpa-designer',
    designerPath: '/admin/rpa-designer',
    color: 'green',
    note: 'Login testado com sucesso'
  }
];

const StatusBadge = ({ status }) => {
  const configs = {
    active: { label: 'Ativo', className: 'bg-green-100 text-green-700 border-green-200' },
    pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    warning: { label: 'Com Problemas', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    error: { label: 'Erro', className: 'bg-red-100 text-red-700 border-red-200' },
    inactive: { label: 'Inativo', className: 'bg-gray-100 text-gray-600 border-gray-200' }
  };
  
  const config = configs[status] || configs.inactive;
  
  return (
    <Badge variant="outline" className={config.className}>
      {status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
      {status === 'pending' && <AlertCircle className="w-3 h-3 mr-1" />}
      {status === 'warning' && <AlertCircle className="w-3 h-3 mr-1" />}
      {status === 'error' && <XCircle className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
};

const IntegrationCard = ({ integration, type, onConfigure, onSync }) => {
  const [syncing, setSyncing] = useState(false);
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync?.(integration.id);
      toast.success(`Sincronização ${integration.name} iniciada`);
    } catch (error) {
      toast.error(`Erro ao sincronizar ${integration.name}`);
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <Card className={`relative ${integration.status === 'inactive' ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              {integration.icon}
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {integration.description}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={integration.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Data Types */}
        <div className="flex flex-wrap gap-1 mb-3">
          {integration.dataTypes.map((type, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
              {type}
            </Badge>
          ))}
        </div>
        
        {/* Issue/Note */}
        {(integration.issue || integration.note) && (
          <div className={`text-xs p-2 rounded mb-3 ${
            integration.issue ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {integration.issue || integration.note}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2">
          {integration.configPath && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 text-xs"
              onClick={() => onConfigure(integration.configPath)}
            >
              <Settings className="w-3 h-3 mr-1" />
              Configurar
            </Button>
          )}
          
          {type === 'rpa' && integration.designerPath && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 text-xs"
              onClick={() => onConfigure(integration.designerPath)}
            >
              <Bot className="w-3 h-3 mr-1" />
              Designer
            </Button>
          )}
          
          {integration.status === 'active' && (
            <Button 
              size="sm" 
              className="flex-1 text-xs"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Sincronizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function SincronizacaoHub({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalApis: API_INTEGRATIONS.length,
    activeApis: API_INTEGRATIONS.filter(i => i.status === 'active').length,
    totalRpa: RPA_AUTOMATIONS.length,
    activeRpa: RPA_AUTOMATIONS.filter(i => i.status === 'active').length
  });
  
  const handleConfigure = (path) => {
    navigate(path);
  };
  
  const handleSync = async (integrationId) => {
    const token = localStorage.getItem('token');
    // Implementar lógica de sincronização específica
    console.log('Sync:', integrationId);
  };
  
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Hub de Sincronização</h1>
            <p className="text-sm text-slate-500">
              Gerir integrações API e automações RPA
            </p>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Plug className="w-4 h-4" />
                <span className="text-xs font-medium">APIs</span>
              </div>
              <div className="text-2xl font-bold">{stats.activeApis}/{stats.totalApis}</div>
              <p className="text-xs text-slate-500">Ativas</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">RPA</span>
              </div>
              <div className="text-2xl font-bold">{stats.activeRpa}/{stats.totalRpa}</div>
              <p className="text-xs text-slate-500">Ativas</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Bolt</span>
              </div>
              <div className="text-2xl font-bold">API</div>
              <p className="text-xs text-slate-500">Funcionando</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Problemas</span>
              </div>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-slate-500">Uber RPA, Via Verde</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs: APIs vs RPA */}
        <Tabs defaultValue="apis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="apis" className="flex items-center gap-2">
              <Plug className="w-4 h-4" />
              APIs Diretas
            </TabsTrigger>
            <TabsTrigger value="rpa" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Automação RPA
            </TabsTrigger>
          </TabsList>
          
          {/* APIs Tab */}
          <TabsContent value="apis" className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>APIs Diretas:</strong> Integração via API oficial das plataformas. 
              Mais fiável e rápido, mas requer aprovação/credenciais.
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {API_INTEGRATIONS.map(integration => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  type="api"
                  onConfigure={handleConfigure}
                  onSync={handleSync}
                />
              ))}
            </div>
          </TabsContent>
          
          {/* RPA Tab */}
          <TabsContent value="rpa" className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              <strong>Automação RPA:</strong> Extração automática via browser (Robot Process Automation).
              Funciona sem API, mas pode ser afetado por mudanças no site.
            </div>
            
            <div className="flex justify-end mb-2">
              <Button 
                size="sm"
                onClick={() => navigate('/admin/rpa-designer')}
              >
                <Bot className="w-4 h-4 mr-2" />
                Abrir RPA Designer
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RPA_AUTOMATIONS.map(integration => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  type="rpa"
                  onConfigure={handleConfigure}
                  onSync={handleSync}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/rpa-designer')}>
                <Bot className="w-4 h-4 mr-2" />
                RPA Designer
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/credenciais')}>
                <Settings className="w-4 h-4 mr-2" />
                Credenciais Parceiros
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/integracoes')}>
                <Plug className="w-4 h-4 mr-2" />
                Ifthenpay/Moloni
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/sincronizacao-auto')}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Agendamentos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
