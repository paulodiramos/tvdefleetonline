import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, Download, Search, Calendar, Building2, 
  Receipt, Truck, User, Filter, Eye, ExternalLink,
  Euro, FileSpreadsheet
} from 'lucide-react';

const ContabilidadePage = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('faturas');
  
  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParceiro, setSelectedParceiro] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  
  // Dados
  const [faturasFornecedores, setFaturasFornecedores] = useState([]);
  const [recibosMotoristas, setRecibosMotoristas] = useState([]);
  const [faturasVeiculos, setFaturasVeiculos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  
  // Estatísticas
  const [stats, setStats] = useState({
    totalFaturas: 0,
    totalRecibos: 0,
    valorFaturas: 0,
    valorRecibos: 0
  });

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, selectedParceiro]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Construir query params
      const params = new URLSearchParams();
      if (dateFrom) params.append('data_inicio', dateFrom);
      if (dateTo) params.append('data_fim', dateTo);
      if (selectedParceiro) params.append('parceiro_id', selectedParceiro);
      
      // Buscar dados em paralelo
      const [parceirosRes, faturasRes, recibosRes, veiculosRes] = await Promise.all([
        axios.get(`${API}/parceiros`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/contabilidade/faturas-fornecedores?${params}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/contabilidade/recibos-motoristas?${params}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/contabilidade/faturas-veiculos?${params}`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setParceiros(parceirosRes.data || []);
      setFaturasFornecedores(faturasRes.data || []);
      setRecibosMotoristas(recibosRes.data || []);
      setFaturasVeiculos(veiculosRes.data || []);
      
      // Calcular estatísticas
      const faturas = faturasRes.data || [];
      const recibos = recibosRes.data || [];
      
      setStats({
        totalFaturas: faturas.length,
        totalRecibos: recibos.length,
        valorFaturas: faturas.reduce((sum, f) => sum + (f.valor || 0), 0),
        valorRecibos: recibos.reduce((sum, r) => sum + (r.valor || 0), 0)
      });
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de contabilidade');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (tipo) => {
    let data = [];
    let filename = '';
    
    switch (tipo) {
      case 'faturas':
        data = faturasFornecedores;
        filename = 'faturas_fornecedores.csv';
        break;
      case 'recibos':
        data = recibosMotoristas;
        filename = 'recibos_motoristas.csv';
        break;
      case 'veiculos':
        data = faturasVeiculos;
        filename = 'faturas_veiculos.csv';
        break;
      default:
        return;
    }
    
    if (data.length === 0) {
      toast.warning('Não há dados para exportar');
      return;
    }
    
    // Criar CSV
    const headers = Object.keys(data[0]).join(';');
    const rows = data.map(item => Object.values(item).map(v => 
      typeof v === 'string' ? `"${v}"` : v
    ).join(';'));
    const csv = [headers, ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Ficheiro ${filename} exportado`);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-PT');
  };

  // Filtrar dados por termo de pesquisa
  const filterBySearch = (items) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(term)
    );
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6" data-testid="contabilidade-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contabilidade</h1>
            <p className="text-slate-500">Gestão de faturas e recibos</p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Faturas</p>
                  <p className="text-2xl font-bold">{stats.totalFaturas}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Valor Faturas</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.valorFaturas)}</p>
                </div>
                <Euro className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Recibos</p>
                  <p className="text-2xl font-bold">{stats.totalRecibos}</p>
                </div>
                <Receipt className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Valor Recibos</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.valorRecibos)}</p>
                </div>
                <Euro className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>Pesquisar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Parceiro</Label>
                <Select value={selectedParceiro} onValueChange={setSelectedParceiro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os parceiros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {parceiros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_empresa || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button variant="outline" onClick={fetchData} className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Aplicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faturas" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Faturas Fornecedores
            </TabsTrigger>
            <TabsTrigger value="recibos" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Recibos Motoristas
            </TabsTrigger>
            <TabsTrigger value="veiculos" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Faturas Veículos
            </TabsTrigger>
          </TabsList>

          {/* Faturas Fornecedores */}
          <TabsContent value="faturas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Faturas de Fornecedores</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('faturas')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">A carregar...</div>
                ) : filterBySearch(faturasFornecedores).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma fatura encontrada</p>
                    <p className="text-sm mt-2">As faturas de manutenção e seguros de veículos aparecerão aqui</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Fatura</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterBySearch(faturasFornecedores).map((fatura, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{fatura.numero || '-'}</TableCell>
                          <TableCell>{fatura.fornecedor || '-'}</TableCell>
                          <TableCell>{formatDate(fatura.data)}</TableCell>
                          <TableCell>{fatura.descricao || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(fatura.valor)}</TableCell>
                          <TableCell>
                            {fatura.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={fatura.url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recibos Motoristas */}
          <TabsContent value="recibos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recibos de Motoristas</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('recibos')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">A carregar...</div>
                ) : filterBySearch(recibosMotoristas).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum recibo encontrado</p>
                    <p className="text-sm mt-2">Os recibos dos motoristas aparecerão aqui</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Nº Recibo</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterBySearch(recibosMotoristas).map((recibo, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{recibo.motorista_nome || '-'}</TableCell>
                          <TableCell>{recibo.numero || '-'}</TableCell>
                          <TableCell>{formatDate(recibo.data)}</TableCell>
                          <TableCell>{recibo.tipo || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(recibo.valor)}</TableCell>
                          <TableCell>
                            {recibo.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={recibo.url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Faturas Veículos */}
          <TabsContent value="veiculos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Faturas de Veículos (Manutenção e Seguros)</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('veiculos')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">A carregar...</div>
                ) : filterBySearch(faturasVeiculos).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma fatura encontrada</p>
                    <p className="text-sm mt-2">As faturas de manutenção e seguros dos veículos aparecerão aqui</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Veículo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nº Fatura</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterBySearch(faturasVeiculos).map((fatura, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{fatura.matricula || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              fatura.tipo === 'seguro' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {fatura.tipo || 'Manutenção'}
                            </span>
                          </TableCell>
                          <TableCell>{fatura.fatura_numero || '-'}</TableCell>
                          <TableCell>{formatDate(fatura.fatura_data)}</TableCell>
                          <TableCell>{fatura.fatura_fornecedor || fatura.fornecedor || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(fatura.valor)}</TableCell>
                          <TableCell>
                            {fatura.fatura_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={fatura.fatura_url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ContabilidadePage;
