import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Search, Download, Eye, Calendar, User, Car } from 'lucide-react';

const ListaContratos = ({ user, onLogout, showLayout = true }) => {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    tipoContrato: 'all',
    periodo: 'all' // ultimos_30_dias, ultimos_90_dias, este_ano, all
  });

  useEffect(() => {
    fetchContratos();
  }, []);

  const fetchContratos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContratos(response.data);
    } catch (error) {
      console.error('Error fetching contratos:', error);
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      ativo: 'default',
      terminado: 'secondary',
      pendente: 'outline'
    };
    return variants[status] || 'secondary';
  };

  const filteredContratos = contratos.filter(contrato => {
    const matchesStatus = filters.status === 'all' || contrato.status === filters.status;
    const matchesSearch = !filters.search || 
      contrato.motorista_nome?.toLowerCase().includes(filters.search.toLowerCase()) ||
      contrato.veiculo_matricula?.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesTipo = filters.tipoContrato === 'all' || contrato.tipo_contrato === filters.tipoContrato;
    
    // Filtro de período
    let matchesPeriodo = true;
    if (filters.periodo !== 'all' && contrato.data_inicio) {
      const dataInicio = new Date(contrato.data_inicio);
      const hoje = new Date();
      const diff = hoje - dataInicio;
      const dias = diff / (1000 * 60 * 60 * 24);
      
      switch(filters.periodo) {
        case 'ultimos_30_dias':
          matchesPeriodo = dias <= 30;
          break;
        case 'ultimos_90_dias':
          matchesPeriodo = dias <= 90;
          break;
        case 'este_ano':
          matchesPeriodo = dataInicio.getFullYear() === hoje.getFullYear();
          break;
      }
    }
    
    return matchesStatus && matchesSearch && matchesTipo && matchesPeriodo;
  });

  const content = (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lista de Contratos</h1>
            <p className="text-slate-600 mt-1">
              Visualize e gerencie todos os contratos
            </p>
          </div>
          <Button onClick={() => window.location.href = '/criar-contrato'}>
            <FileText className="w-4 h-4 mr-2" />
            Criar Novo Contrato
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por motorista ou matrícula..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Estados</SelectItem>
                    <SelectItem value="ativo">✅ Ativos</SelectItem>
                    <SelectItem value="terminado">❌ Terminados</SelectItem>
                    <SelectItem value="pendente">⏳ Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={filters.tipoContrato} onValueChange={(value) => setFilters({ ...filters, tipoContrato: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    <SelectItem value="aluguer_sem_caucao">Aluguer S/ Caução</SelectItem>
                    <SelectItem value="aluguer_com_caucao">Aluguer C/ Caução</SelectItem>
                    <SelectItem value="prestacao_servicos">Prestação Serviços</SelectItem>
                    <SelectItem value="parceria">Parceria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-4 mt-4">
              <div>
                <Select value={filters.periodo} onValueChange={(value) => setFilters({ ...filters, periodo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo Período</SelectItem>
                    <SelectItem value="ultimos_30_dias">Últimos 30 dias</SelectItem>
                    <SelectItem value="ultimos_90_dias">Últimos 90 dias</SelectItem>
                    <SelectItem value="este_ano">Este Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <div className="text-sm text-slate-600">
                  Mostrando <strong>{filteredContratos.length}</strong> de <strong>{contratos.length}</strong> contratos
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Contratos */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">A carregar contratos...</p>
          </div>
        ) : filteredContratos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Nenhum contrato encontrado</p>
              <p className="text-slate-500 text-sm mt-2">
                {filters.search || filters.status !== 'all' 
                  ? 'Tente ajustar os filtros' 
                  : 'Crie o primeiro contrato'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredContratos.map((contrato) => (
              <Card key={contrato.id} className="hover:shadow-md transition">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-lg">
                          Contrato #{contrato.numero || contrato.id?.slice(0, 8)}
                        </h3>
                        <Badge variant={getStatusBadge(contrato.status)}>
                          {contrato.status}
                        </Badge>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-slate-500 text-xs">Motorista</p>
                            <p className="font-medium">{contrato.motorista_nome || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Car className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-slate-500 text-xs">Veículo</p>
                            <p className="font-medium">{contrato.veiculo_matricula || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-slate-500 text-xs">Período</p>
                            <p className="font-medium">
                              {contrato.data_inicio ? new Date(contrato.data_inicio).toLocaleDateString('pt-PT') : 'N/A'}
                              {' - '}
                              {contrato.data_fim ? new Date(contrato.data_fim).toLocaleDateString('pt-PT') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {contrato.tipo_contrato && (
                        <div className="mt-3 text-sm">
                          <span className="text-slate-500">Tipo: </span>
                          <span className="font-medium">
                            {contrato.tipo_contrato === 'comissao' ? 'Comissão' : 'Aluguer'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      {contrato.pdf_url && (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resumo */}
        {!loading && filteredContratos.length > 0 && (
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{contratos.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {contratos.filter(c => c.status === 'ativo').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {contratos.filter(c => c.status === 'pendente').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Terminados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-600">
                  {contratos.filter(c => c.status === 'terminado').length}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  );

  return showLayout ? (
    <Layout user={user} onLogout={onLogout}>
      {content}
    </Layout>
  ) : content;
};

export default ListaContratos;
