import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText,
  Upload,
  Download,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Car,
  Folder,
  Eye,
  Trash2,
  Filter,
  Calendar,
  FileWarning,
  Shield,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const GestaoDocumentos = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard stats
  const [stats, setStats] = useState({
    total_documentos: 0,
    documentos_validos: 0,
    documentos_expirados: 0,
    documentos_a_expirar: 0,
    motoristas_total: 0,
    motoristas_docs_completos: 0,
    veiculos_total: 0,
    veiculos_docs_completos: 0
  });
  
  // Documents lists
  const [documentosExpirados, setDocumentosExpirados] = useState([]);
  const [documentosAExpirar, setDocumentosAExpirar] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  
  // Filters
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cloud storage integration
  const [cloudConnected, setCloudConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all data in parallel
      const [
        motoristasRes,
        veiculosRes,
        cloudStatusRes
      ] = await Promise.all([
        axios.get(`${API}/motoristas`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/vehicles`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/storage-config`, { headers }).catch(() => ({ data: null }))
      ]);

      const motoristasData = motoristasRes.data || [];
      const veiculosData = veiculosRes.data || [];

      setMotoristas(motoristasData);
      setVeiculos(veiculosData);
      // Check if any cloud storage is connected
      setCloudConnected(cloudStatusRes.data?.cloud_connected || cloudStatusRes.data?.terabox_connected || false);

      // Calculate stats
      calculateStats(motoristasData, veiculosData);
      
      // Get expiring/expired documents
      await fetchExpiringDocuments(headers);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (motoristasData, veiculosData) => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let totalDocs = 0;
    let validDocs = 0;
    let expiredDocs = 0;
    let expiringDocs = 0;
    let motoristasCompletos = 0;
    let veiculosCompletos = 0;

    // Check motorista documents
    const motoristaDocTypes = [
      'carta_conducao', 'cartao_cidadao', 'certificado_tvde',
      'registo_criminal', 'comprovativo_iban', 'comprovativo_morada'
    ];

    motoristasData.forEach(m => {
      let docsCompletos = 0;
      motoristaDocTypes.forEach(docType => {
        const doc = m[docType];
        if (doc) {
          totalDocs++;
          const validade = m[`${docType}_validade`];
          if (validade) {
            const dataValidade = new Date(validade);
            if (dataValidade < now) {
              expiredDocs++;
            } else if (dataValidade < in30Days) {
              expiringDocs++;
            } else {
              validDocs++;
            }
          } else {
            validDocs++; // No expiry = valid
          }
          docsCompletos++;
        }
      });
      if (docsCompletos >= 4) motoristasCompletos++; // At least 4 main docs
    });

    // Check vehicle documents
    const veiculoDocTypes = [
      'documento_unico', 'inspecao', 'seguro', 'licenca_tvde'
    ];

    veiculosData.forEach(v => {
      let docsCompletos = 0;
      veiculoDocTypes.forEach(docType => {
        const doc = v[docType];
        if (doc) {
          totalDocs++;
          const validade = v[`${docType}_validade`];
          if (validade) {
            const dataValidade = new Date(validade);
            if (dataValidade < now) {
              expiredDocs++;
            } else if (dataValidade < in30Days) {
              expiringDocs++;
            } else {
              validDocs++;
            }
          } else {
            validDocs++;
          }
          docsCompletos++;
        }
      });
      if (docsCompletos >= 3) veiculosCompletos++;
    });

    setStats({
      total_documentos: totalDocs,
      documentos_validos: validDocs,
      documentos_expirados: expiredDocs,
      documentos_a_expirar: expiringDocs,
      motoristas_total: motoristasData.length,
      motoristas_docs_completos: motoristasCompletos,
      veiculos_total: veiculosData.length,
      veiculos_docs_completos: veiculosCompletos
    });
  };

  const fetchExpiringDocuments = async (headers) => {
    try {
      const diasFiltro = parseInt(filtroPeriodo) || 30;
      
      // Fetch expiring documents from API
      const response = await axios.get(
        `${API}/alertas/documentos-expirar?dias=${diasFiltro}`,
        { headers }
      ).catch(() => ({ data: { expirados: [], a_expirar: [] } }));

      setDocumentosExpirados(response.data?.expirados || []);
      setDocumentosAExpirar(response.data?.a_expirar || []);
    } catch (error) {
      console.error('Error fetching expiring documents:', error);
    }
  };

  const handleSyncCloud = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/storage-config/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Sincronização com Cloud iniciada');
      await fetchData();
    } catch (error) {
      toast.error('Erro ao sincronizar com Cloud');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-PT');
  };

  const getDaysUntilExpiry = (dateStr) => {
    if (!dateStr) return null;
    const now = new Date();
    const expiry = new Date(dateStr);
    const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getExpiryBadge = (dateStr) => {
    const days = getDaysUntilExpiry(dateStr);
    if (days === null) return <Badge variant="outline">Sem validade</Badge>;
    if (days < 0) return <Badge variant="destructive">Expirado há {Math.abs(days)} dias</Badge>;
    if (days <= 7) return <Badge variant="destructive">Expira em {days} dias</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">Expira em {days} dias</Badge>;
    return <Badge variant="secondary">Válido ({days} dias)</Badge>;
  };

  const filteredMotoristas = motoristas.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return m.nome?.toLowerCase().includes(query) || 
           m.email?.toLowerCase().includes(query) ||
           m.nif?.includes(query);
  });

  const filteredVeiculos = veiculos.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return v.matricula?.toLowerCase().includes(query) ||
           v.marca?.toLowerCase().includes(query) ||
           v.modelo?.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="gestao-documentos-page">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Gestão de Documentos
            </h1>
            <p className="text-slate-500 mt-1">
              Gerencie todos os documentos de motoristas e veículos da sua frota
            </p>
          </div>
          <div className="flex gap-2">
            {cloudConnected && (
              <Button 
                variant="outline" 
                onClick={handleSyncCloud}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Cloud
              </Button>
            )}
            <Link to="/armazenamento">
              <Button variant="outline">
                <Folder className="w-4 h-4 mr-2" />
                Configurar Cloud
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Documentos</p>
                  <p className="text-2xl font-bold">{stats.total_documentos}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Válidos</p>
                  <p className="text-2xl font-bold text-green-600">{stats.documentos_validos}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700">A Expirar</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.documentos_a_expirar}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Expirados</p>
                  <p className="text-2xl font-bold text-red-600">{stats.documentos_expirados}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Motoristas ({motoristas.length})
            </TabsTrigger>
            <TabsTrigger value="veiculos" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Veículos ({veiculos.length})
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alertas
              {(stats.documentos_expirados + stats.documentos_a_expirar) > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {stats.documentos_expirados + stats.documentos_a_expirar}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Motoristas Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Documentos de Motoristas
                  </CardTitle>
                  <CardDescription>
                    {stats.motoristas_docs_completos} de {stats.motoristas_total} motoristas com documentação completa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Progresso</span>
                      <span className="text-sm font-medium">
                        {stats.motoristas_total > 0 
                          ? Math.round((stats.motoristas_docs_completos / stats.motoristas_total) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ 
                          width: stats.motoristas_total > 0 
                            ? `${(stats.motoristas_docs_completos / stats.motoristas_total) * 100}%` 
                            : '0%' 
                        }}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => setActiveTab('motoristas')}
                    >
                      Ver Detalhes
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Veículos Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-green-600" />
                    Documentos de Veículos
                  </CardTitle>
                  <CardDescription>
                    {stats.veiculos_docs_completos} de {stats.veiculos_total} veículos com documentação completa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Progresso</span>
                      <span className="text-sm font-medium">
                        {stats.veiculos_total > 0 
                          ? Math.round((stats.veiculos_docs_completos / stats.veiculos_total) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div 
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ 
                          width: stats.veiculos_total > 0 
                            ? `${(stats.veiculos_docs_completos / stats.veiculos_total) * 100}%` 
                            : '0%' 
                        }}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => setActiveTab('veiculos')}
                    >
                      Ver Detalhes
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Alertas Recentes */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Documentos a Expirar (próximos 30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {documentosAExpirar.length > 0 ? (
                    <div className="space-y-2">
                      {documentosAExpirar.slice(0, 5).map((doc, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                        >
                          <div className="flex items-center gap-3">
                            {doc.tipo === 'motorista' ? (
                              <User className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Car className="w-5 h-5 text-orange-600" />
                            )}
                            <div>
                              <p className="font-medium">{doc.nome || doc.matricula}</p>
                              <p className="text-sm text-slate-500">{doc.documento}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {getExpiryBadge(doc.validade)}
                          </div>
                        </div>
                      ))}
                      {documentosAExpirar.length > 5 && (
                        <Button 
                          variant="ghost" 
                          className="w-full"
                          onClick={() => setActiveTab('alertas')}
                        >
                          Ver todos ({documentosAExpirar.length})
                          <ArrowUpRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                      <p>Nenhum documento a expirar nos próximos 30 dias</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Motoristas Tab */}
          <TabsContent value="motoristas">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Documentos por Motorista</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Pesquisar motorista..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Carta Condução</TableHead>
                      <TableHead>Cartão Cidadão</TableHead>
                      <TableHead>Certificado TVDE</TableHead>
                      <TableHead>Registo Criminal</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMotoristas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{m.nome}</p>
                            <p className="text-sm text-slate-500">{m.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {m.carta_conducao ? (
                            getExpiryBadge(m.carta_conducao_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.cartao_cidadao ? (
                            getExpiryBadge(m.cartao_cidadao_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.certificado_tvde ? (
                            getExpiryBadge(m.certificado_tvde_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.registo_criminal ? (
                            getExpiryBadge(m.registo_criminal_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/motorista/${m.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredMotoristas.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum motorista encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Veículos Tab */}
          <TabsContent value="veiculos">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Documentos por Veículo</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Pesquisar veículo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>DUA</TableHead>
                      <TableHead>Inspeção</TableHead>
                      <TableHead>Seguro</TableHead>
                      <TableHead>Licença TVDE</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVeiculos.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{v.matricula}</p>
                            <p className="text-sm text-slate-500">{v.marca} {v.modelo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.documento_unico ? (
                            <Badge variant="secondary">Carregado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.inspecao ? (
                            getExpiryBadge(v.inspecao_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.seguro ? (
                            getExpiryBadge(v.seguro_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.licenca_tvde ? (
                            getExpiryBadge(v.licenca_tvde_validade)
                          ) : (
                            <Badge variant="outline" className="text-slate-400">Em falta</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/veiculo/${v.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredVeiculos.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum veículo encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alertas Tab */}
          <TabsContent value="alertas">
            <div className="space-y-6">
              {/* Filtros */}
              <div className="flex gap-4 items-center">
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="15">Próximos 15 dias</SelectItem>
                    <SelectItem value="30">Próximos 30 dias</SelectItem>
                    <SelectItem value="60">Próximos 60 dias</SelectItem>
                    <SelectItem value="90">Próximos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => fetchData()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {/* Documentos Expirados */}
              {documentosExpirados.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="bg-red-50">
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      Documentos Expirados ({documentosExpirados.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {documentosExpirados.map((doc, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                        >
                          <div className="flex items-center gap-3">
                            {doc.tipo === 'motorista' ? (
                              <User className="w-5 h-5 text-red-600" />
                            ) : (
                              <Car className="w-5 h-5 text-red-600" />
                            )}
                            <div>
                              <p className="font-medium">{doc.nome || doc.matricula}</p>
                              <p className="text-sm text-slate-500">{doc.documento}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getExpiryBadge(doc.validade)}
                            <Link to={doc.tipo === 'motorista' ? `/motorista/${doc.id}` : `/veiculo/${doc.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documentos a Expirar */}
              {documentosAExpirar.length > 0 && (
                <Card className="border-orange-200">
                  <CardHeader className="bg-orange-50">
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <Clock className="w-5 h-5" />
                      Documentos a Expirar ({documentosAExpirar.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {documentosAExpirar.map((doc, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                        >
                          <div className="flex items-center gap-3">
                            {doc.tipo === 'motorista' ? (
                              <User className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Car className="w-5 h-5 text-orange-600" />
                            )}
                            <div>
                              <p className="font-medium">{doc.nome || doc.matricula}</p>
                              <p className="text-sm text-slate-500">{doc.documento}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getExpiryBadge(doc.validade)}
                            <Link to={doc.tipo === 'motorista' ? `/motorista/${doc.id}` : `/veiculo/${doc.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {documentosExpirados.length === 0 && documentosAExpirar.length === 0 && (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-slate-500">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                      <p className="text-lg font-medium">Tudo em ordem!</p>
                      <p>Não há documentos expirados ou a expirar no período selecionado.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default GestaoDocumentos;
