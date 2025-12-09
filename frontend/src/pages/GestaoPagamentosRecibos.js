import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  FileText, 
  Euro, 
  Eye, 
  CheckCircle, 
  Clock, 
  Send,
  Filter,
  Download,
  AlertCircle
} from 'lucide-react';

const GestaoPagamentosRecibos = ({ user, onLogout }) => {
  const [registos, setRegistos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [filtrosParceiro, setFiltrosParceiro] = useState('todos');
  const [tipoFiltroData, setTipoFiltroData] = useState('semana'); // 'semana' ou 'datas'
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtrosDataInicio, setFiltrosDataInicio] = useState('');
  const [filtrosDataFim, setFiltrosDataFim] = useState('');
  const [filtrosEstado, setFiltrosEstado] = useState('all');
  
  // Modal
  const [reciboSelecionado, setReciboSelecionado] = useState(null);
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [registoPagamento, setRegistoPagamento] = useState(null);
  
  // Formulário de pagamento
  const [metodoPagamento, setMetodoPagamento] = useState('transferencia');
  const [valorPagamento, setValorPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const estadosDisponiveis = [
    { value: 'all', label: 'Todos', color: 'bg-slate-100 text-slate-800' },
    { value: 'pendente_recibo', label: 'Pendente de Recibo', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'recibo_enviado', label: 'Recibo Enviado', color: 'bg-purple-100 text-purple-800' },
    { value: 'verificar_recibo', label: 'Verificar Recibo', color: 'bg-orange-100 text-orange-800' },
    { value: 'aprovado', label: 'Aprovado', color: 'bg-green-100 text-green-800' },
    { value: 'pagamento_pendente', label: 'Pagamento Pendente', color: 'bg-blue-100 text-blue-800' },
    { value: 'pagamento_processando', label: 'Processando', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'liquidado', label: 'Liquidado', color: 'bg-emerald-100 text-emerald-800' }
  ];

  useEffect(() => {
    // Set default week (current week)
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const semana = getWeekNumber(hoje);
    setFiltroSemana(`${ano}-W${String(semana).padStart(2, '0')}`);
    
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    }
    fetchRegistos();
  }, []);

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getWeekDates = (weekString) => {
    if (!weekString) return { inicio: null, fim: null };
    
    const [year, week] = weekString.split('-W');
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const inicio = new Date(ISOweekStart);
    const fim = new Date(ISOweekStart);
    fim.setDate(fim.getDate() + 6);
    
    return {
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0]
    };
  };

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchRegistos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = {};
      if (filtrosParceiro && filtrosParceiro !== 'todos') params.parceiro_id = filtrosParceiro;
      
      // Usar semana ou datas conforme selecionado
      if (tipoFiltroData === 'semana' && filtroSemana) {
        const { inicio, fim } = getWeekDates(filtroSemana);
        if (inicio) params.data_inicio = inicio;
        if (fim) params.data_fim = fim;
      } else if (tipoFiltroData === 'datas') {
        if (filtrosDataInicio) params.data_inicio = filtrosDataInicio;
        if (filtrosDataFim) params.data_fim = filtrosDataFim;
      }
      
      if (filtrosEstado !== 'all') params.estado = filtrosEstado;
      
      const response = await axios.get(`${API}/pagamentos-recibos`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setRegistos(response.data);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registos');
    } finally {
      setLoading(false);
    }
  };

  const handleVerRecibo = async (registro) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/pagamentos-recibos/${registro.id}/recibo`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReciboSelecionado(response.data);
      setShowReciboModal(true);
    } catch (error) {
      console.error('Error fetching receipt:', error);
      toast.error('Erro ao carregar recibo');
    }
  };

  const handleAbrirPagamento = (registro) => {
    setRegistoPagamento(registro);
    setValorPagamento(registro.valor_total || '');
    setShowPagamentoModal(true);
  };

  const handleRealizarPagamento = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/pagamentos-recibos/${registoPagamento.id}/pagamento`,
        {
          metodo_pagamento: metodoPagamento,
          valor: parseFloat(valorPagamento),
          observacoes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Pagamento registado com sucesso!');
      setShowPagamentoModal(false);
      setMetodoPagamento('transferencia');
      setValorPagamento('');
      setObservacoes('');
      setRegistoPagamento(null);
      fetchRegistos();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao processar pagamento');
    }
  };

  const handleAlterarEstado = async (registoId, novoEstado) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/pagamentos-recibos/${registoId}/estado`,
        { estado: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Estado atualizado!');
      fetchRegistos();
    } catch (error) {
      console.error('Error updating state:', error);
      toast.error('Erro ao atualizar estado');
    }
  };

  const handleEnviarRelatorio = async (registoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/pagamentos-recibos/${registoId}/enviar-relatorio`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Relatório enviado!');
      fetchRegistos();
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Erro ao enviar relatório');
    }
  };

  const getEstadoBadge = (estado) => {
    const estadoInfo = estadosDisponiveis.find(e => e.value === estado);
    if (!estadoInfo) return null;
    return (
      <Badge className={`${estadoInfo.color} border-0`}>
        {estadoInfo.label}
      </Badge>
    );
  };

  const getParceiro = (parceiroId) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    return parceiro?.nome_empresa || parceiro?.email || 'N/A';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Pagamentos e Recibos</h1>
          <p className="text-slate-600 mt-1">
            Sistema unificado de relatórios, recibos e pagamentos
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <CardTitle>Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {(user.role === 'admin' || user.role === 'gestao') && (
                <div>
                  <Label>Parceiro</Label>
                  <Select value={filtrosParceiro} onValueChange={setFiltrosParceiro}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Parceiros</SelectItem>
                      {parceiros.map((parceiro) => (
                        <SelectItem key={parceiro.id} value={parceiro.id}>
                          {parceiro.nome_empresa || parceiro.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label>Filtrar por</Label>
                <Select value={tipoFiltroData} onValueChange={setTipoFiltroData}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Semana</SelectItem>
                    <SelectItem value="datas">Datas Específicas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {tipoFiltroData === 'semana' ? (
                <div>
                  <Label>Semana</Label>
                  <Input
                    type="week"
                    value={filtroSemana}
                    onChange={(e) => setFiltroSemana(e.target.value)}
                    className="mt-2"
                  />
                  {filtroSemana && (
                    <p className="text-xs text-slate-500 mt-1">
                      {getWeekDates(filtroSemana).inicio} a {getWeekDates(filtroSemana).fim}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filtrosDataInicio}
                      onChange={(e) => setFiltrosDataInicio(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filtrosDataFim}
                      onChange={(e) => setFiltrosDataFim(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
              
              <div>
                <Label>Estado</Label>
                <Select value={filtrosEstado} onValueChange={setFiltrosEstado}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {estadosDisponiveis.map((estado) => (
                      <SelectItem key={estado.value} value={estado.value}>
                        {estado.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button onClick={fetchRegistos}>
                <Filter className="w-4 h-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Registos */}
        <Card>
          <CardHeader>
            <CardTitle>Registos de Pagamentos ({registos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">A carregar...</p>
              </div>
            ) : registos.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhum registo encontrado</p>
                <p className="text-slate-500 text-sm mt-2">
                  Ajuste os filtros para ver mais resultados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Parceiro
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Semana
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Recibo
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {registos.map((registro) => (
                      <tr key={registro.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {getParceiro(registro.parceiro_id)}
                          </p>
                          <p className="text-xs text-slate-500">{registro.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-700">
                            {new Date(registro.data_inicio).toLocaleDateString('pt-PT')} - {new Date(registro.data_fim).toLocaleDateString('pt-PT')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            €{registro.valor_total?.toFixed(2) || '0.00'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Select 
                            value={registro.estado} 
                            onValueChange={(value) => handleAlterarEstado(registro.id, value)}
                          >
                            <SelectTrigger className="w-auto h-8">
                              <SelectValue>
                                {getEstadoBadge(registro.estado)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {estadosDisponiveis.filter(e => e.value !== 'all').map((estado) => (
                                <SelectItem key={estado.value} value={estado.value}>
                                  <span className={`px-2 py-1 rounded text-xs ${estado.color}`}>
                                    {estado.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          {registro.recibo_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerRecibo(registro)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Sem recibo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEnviarRelatorio(registro.id)}
                              disabled={registro.relatorio_enviado}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {registro.relatorio_enviado ? 'Enviado' : 'Enviar'}
                            </Button>
                            
                            {registro.estado !== 'liquidado' && (
                              <Button
                                size="sm"
                                onClick={() => handleAbrirPagamento(registro)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Euro className="w-4 h-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                            
                            {registro.estado === 'liquidado' && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Ver Recibo */}
        <Dialog open={showReciboModal} onOpenChange={setShowReciboModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Recibo</DialogTitle>
            </DialogHeader>
            {reciboSelecionado && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Número:</p>
                      <p className="font-semibold">{reciboSelecionado.numero_recibo}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Data:</p>
                      <p className="font-semibold">
                        {new Date(reciboSelecionado.data_emissao).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Valor:</p>
                      <p className="font-semibold text-lg">
                        €{reciboSelecionado.valor?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Status:</p>
                      <Badge className="bg-green-100 text-green-800">
                        {reciboSelecionado.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {reciboSelecionado.pdf_url && (
                  <Button className="w-full" asChild>
                    <a href={reciboSelecionado.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      Descarregar PDF
                    </a>
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Realizar Pagamento */}
        <Dialog open={showPagamentoModal} onOpenChange={setShowPagamentoModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Realizar Pagamento</DialogTitle>
            </DialogHeader>
            {registoPagamento && (
              <form onSubmit={handleRealizarPagamento} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Parceiro:</p>
                  <p className="font-semibold">{getParceiro(registoPagamento.parceiro_id)}</p>
                  <p className="text-sm text-slate-600 mt-2">Período:</p>
                  <p className="font-semibold">
                    {new Date(registoPagamento.data_inicio).toLocaleDateString('pt-PT')} - {new Date(registoPagamento.data_fim).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                
                <div>
                  <Label>Método de Pagamento *</Label>
                  <Select value={metodoPagamento} onValueChange={setMetodoPagamento} required>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                      <SelectItem value="multibanco">Multibanco</SelectItem>
                      <SelectItem value="mbway">MB WAY</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Valor (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorPagamento}
                    onChange={(e) => setValorPagamento(e.target.value)}
                    placeholder="0.00"
                    required
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Observações</Label>
                  <Input
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Notas sobre o pagamento (opcional)"
                    className="mt-2"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPagamentoModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Pagamento
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoPagamentosRecibos;
