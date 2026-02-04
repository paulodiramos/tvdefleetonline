import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  ClipboardCheck, Eye, CheckCircle, XCircle, Clock, Car, User, 
  Calendar, Fuel, Gauge, AlertTriangle, FileText, Image, Bot,
  ChevronLeft, ChevronRight, Search, Filter, Download
} from 'lucide-react';

const VistoriasMobile = ({ user, onLogout }) => {
  const [vistorias, setVistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVistoria, setSelectedVistoria] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    fetchVistorias();
  }, [activeTab]);

  const fetchVistorias = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let endpoint = '/vistorias/pendentes/lista';
      
      if (activeTab === 'todas') {
        endpoint = '/vistorias/todas';
      } else if (activeTab === 'aprovadas') {
        endpoint = '/vistorias/aprovadas';
      } else if (activeTab === 'rejeitadas') {
        endpoint = '/vistorias/rejeitadas';
      }
      
      const response = await axios.get(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVistorias(response.data.vistorias || []);
    } catch (error) {
      console.error('Erro ao carregar vistorias:', error);
      // Tentar endpoint alternativo para pendentes
      if (activeTab === 'pendentes') {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/vistorias/pendentes/lista`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setVistorias(response.data.vistorias || []);
        } catch (e) {
          setVistorias([]);
        }
      } else {
        setVistorias([]);
      }
    }
    setLoading(false);
  };

  const fetchVistoriaDetalhe = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vistorias/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedVistoria(response.data);
      setShowDetailDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar detalhes da vistoria');
    }
  };

  const aprovarVistoria = async (id) => {
    setProcessando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vistorias/${id}/aprovar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vistoria aprovada com sucesso');
      setShowDetailDialog(false);
      fetchVistorias();
    } catch (error) {
      toast.error('Erro ao aprovar vistoria');
    }
    setProcessando(false);
  };

  const rejeitarVistoria = async (id) => {
    if (!motivoRejeicao.trim()) {
      toast.error('Indique o motivo da rejeição');
      return;
    }
    setProcessando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vistorias/${id}/rejeitar`, { motivo: motivoRejeicao }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vistoria rejeitada');
      setShowDetailDialog(false);
      setMotivoRejeicao('');
      fetchVistorias();
    } catch (error) {
      toast.error('Erro ao rejeitar vistoria');
    }
    setProcessando(false);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pendente: { variant: 'warning', label: 'Pendente', icon: Clock },
      aprovada: { variant: 'success', label: 'Aprovada', icon: CheckCircle },
      rejeitada: { variant: 'destructive', label: 'Rejeitada', icon: XCircle }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTipoBadge = (tipo) => {
    return tipo === 'entrada' ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        📥 Entrada
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
        📤 Saída
      </Badge>
    );
  };

  const filteredVistorias = vistorias.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.motorista_nome?.toLowerCase().includes(term) ||
      v.veiculo_matricula?.toLowerCase().includes(term)
    );
  });

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
              Vistorias Móveis
            </h1>
            <p className="text-gray-600 mt-1">
              Vistorias realizadas pelos motoristas através da app móvel
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {vistorias.filter(v => v.status === 'pendente').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Aprovadas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {vistorias.filter(v => v.status === 'aprovada').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Rejeitadas</p>
                  <p className="text-2xl font-bold text-red-800">
                    {vistorias.filter(v => v.status === 'rejeitada').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Total</p>
                  <p className="text-2xl font-bold text-blue-800">{vistorias.length}</p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Pesquisar por motorista ou matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList>
                  <TabsTrigger value="pendentes" className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Pendentes
                  </TabsTrigger>
                  <TabsTrigger value="aprovadas" className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Aprovadas
                  </TabsTrigger>
                  <TabsTrigger value="rejeitadas" className="flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> Rejeitadas
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Vistorias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vistorias ({filteredVistorias.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredVistorias.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma vistoria encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVistorias.map((vistoria) => (
                  <div
                    key={vistoria.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => fetchVistoriaDetalhe(vistoria.id)}
                    data-testid={`vistoria-item-${vistoria.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-lg shadow-sm">
                        <ClipboardCheck className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{vistoria.motorista_nome || 'Motorista'}</span>
                          {getTipoBadge(vistoria.tipo)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Car className="h-4 w-4" />
                            {vistoria.veiculo_matricula || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {vistoria.data}
                          </span>
                          <span className="flex items-center gap-1">
                            <Gauge className="h-4 w-4" />
                            {vistoria.km?.toLocaleString()} km
                          </span>
                          {vistoria.total_danos > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <AlertTriangle className="h-4 w-4" />
                              {vistoria.total_danos} danos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(vistoria.status)}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Detalhes da Vistoria
              </DialogTitle>
              <DialogDescription>
                Vistoria realizada através da app móvel
              </DialogDescription>
            </DialogHeader>

            {selectedVistoria && (
              <div className="space-y-6">
                {/* Info Principal */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Tipo</p>
                      <div className="mt-1">{getTipoBadge(selectedVistoria.tipo)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedVistoria.status)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Quilometragem</p>
                      <p className="text-xl font-bold">{selectedVistoria.km?.toLocaleString()} km</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Combustível</p>
                      <p className="text-xl font-bold">{selectedVistoria.nivel_combustivel}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Motorista e Veículo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" /> Motorista
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedVistoria.motorista_nome || 'N/A'}</p>
                      <p className="text-sm text-gray-500">{selectedVistoria.motorista_telefone}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Car className="h-4 w-4" /> Veículo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedVistoria.veiculo_matricula || 'N/A'}</p>
                      {selectedVistoria.matricula_ocr && (
                        <p className="text-sm text-gray-500">
                          OCR: {selectedVistoria.matricula_ocr.matricula} 
                          ({selectedVistoria.matricula_ocr.confianca})
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Análise IA */}
                {selectedVistoria.analise_ia && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                        <Bot className="h-4 w-4" /> Análise por IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedVistoria.analise_ia.danos_detetados?.length > 0 ? (
                        <div>
                          <p className="font-medium text-purple-800 mb-2">
                            Danos detetados automaticamente ({selectedVistoria.analise_ia.danos_detetados.length}):
                          </p>
                          <div className="space-y-2">
                            {selectedVistoria.analise_ia.danos_detetados.map((dano, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-purple-100">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {dano.tipo}
                                  </Badge>
                                  <Badge variant={dano.gravidade === 'grave' ? 'destructive' : dano.gravidade === 'moderado' ? 'warning' : 'secondary'}>
                                    {dano.gravidade}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{dano.localizacao}</p>
                                <p className="text-sm">{dano.descricao}</p>
                                <p className="text-xs text-gray-400 mt-1">Foto: {dano.foto_origem}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-green-700">✅ Nenhum dano detetado automaticamente</p>
                      )}
                      {selectedVistoria.matricula_ocr?.matricula && (
                        <div className="p-2 bg-white rounded border border-purple-100">
                          <p className="text-sm text-gray-600">Matrícula lida (OCR):</p>
                          <p className="font-mono font-bold">{selectedVistoria.matricula_ocr.matricula}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            Confiança: {selectedVistoria.matricula_ocr.confianca}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Comparação com Vistoria Anterior */}
                {selectedVistoria.comparacao_anterior && !selectedVistoria.comparacao_anterior.erro && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                        <FileText className="h-4 w-4" /> Comparação com Vistoria Anterior
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedVistoria.comparacao_anterior.resumo}</p>
                      {selectedVistoria.comparacao_anterior.novos_danos?.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium text-red-600">Novos danos:</p>
                          <ul className="list-disc list-inside text-sm">
                            {selectedVistoria.comparacao_anterior.novos_danos.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedVistoria.comparacao_anterior.alertas?.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-100 rounded">
                          <p className="font-medium text-yellow-700">⚠️ Alertas:</p>
                          <ul className="list-disc list-inside text-sm text-yellow-800">
                            {selectedVistoria.comparacao_anterior.alertas.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Danos Marcados Manualmente */}
                {selectedVistoria.danos?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" /> 
                        Danos Marcados pelo Motorista ({selectedVistoria.danos.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedVistoria.danos.map((dano, idx) => (
                          <div key={idx} className="p-2 bg-orange-50 rounded border border-orange-200">
                            <Badge>{dano.tipo}</Badge>
                            <p className="text-sm mt-1">{dano.descricao || 'Sem descrição'}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Fotos */}
                {selectedVistoria.fotos && Object.keys(selectedVistoria.fotos).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Image className="h-4 w-4" /> 
                        Fotografias ({Object.keys(selectedVistoria.fotos).length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(selectedVistoria.fotos).map(([tipo, foto]) => (
                          <div key={tipo} className="space-y-1">
                            <p className="text-xs text-gray-500 capitalize">{tipo.replace('_', ' ')}</p>
                            <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                              <img
                                src={`${API}${foto.url}`}
                                alt={tipo}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = '/placeholder-image.png'; }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Observações */}
                {selectedVistoria.observacoes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700">{selectedVistoria.observacoes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Assinatura */}
                {selectedVistoria.assinatura_url && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Assinatura Digital</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-48 h-24 bg-gray-50 rounded border">
                        <img
                          src={`${API}${selectedVistoria.assinatura_url}`}
                          alt="Assinatura"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Ações */}
                {selectedVistoria.status === 'pendente' && (
                  <Card className="border-2 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => aprovarVistoria(selectedVistoria.id)}
                          disabled={processando}
                          data-testid="aprovar-vistoria-btn"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar Vistoria
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Motivo da rejeição (obrigatório)"
                          value={motivoRejeicao}
                          onChange={(e) => setMotivoRejeicao(e.target.value)}
                        />
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => rejeitarVistoria(selectedVistoria.id)}
                          disabled={processando || !motivoRejeicao.trim()}
                          data-testid="rejeitar-vistoria-btn"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rejeitar Vistoria
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Info de Rejeição */}
                {selectedVistoria.status === 'rejeitada' && selectedVistoria.motivo_rejeicao && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-700">Motivo da Rejeição</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-red-800">{selectedVistoria.motivo_rejeicao}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Rejeitada em: {selectedVistoria.rejeitada_em}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Info de Aprovação */}
                {selectedVistoria.status === 'aprovada' && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-700">Vistoria Aprovada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-500">
                        Aprovada em: {selectedVistoria.aprovada_em}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default VistoriasMobile;
