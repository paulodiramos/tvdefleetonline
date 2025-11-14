import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus, Eye, Download, Check, X, Calendar, User, Car, Building } from 'lucide-react';

const Contratos = ({ user, onLogout }) => {
  const [contratos, setContratos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);

  const [formData, setFormData] = useState({
    parceiro_id: '',
    motorista_id: '',
    vehicle_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    tipo_contrato: 'comissao',
    valor_semanal: 230,
    comissao_percentual: 20,
    caucao_total: 300,
    caucao_lavagem: 90,
    tem_caucao: true,
    caucao_parcelada: false,
    caucao_parcelas: 4,
    caucao_texto: '',
    tem_epoca: false,
    data_inicio_epoca_alta: '',
    data_fim_epoca_alta: '',
    valor_epoca_alta: 300,
    texto_epoca_alta: '',
    data_inicio_epoca_baixa: '',
    data_fim_epoca_baixa: '',
    valor_epoca_baixa: 200,
    texto_epoca_baixa: '',
    condicoes_veiculo: '',
    template_texto: ''
  });

  useEffect(() => {
    fetchContratos();
    fetchParceiros();
    fetchMotoristas();
    fetchVeiculos();
  }, []);

  const fetchContratos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContratos(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching contratos:', error);
      toast.error('Erro ao carregar contratos');
      setLoading(false);
    }
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

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(response.data);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const fetchVeiculos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculos(response.data);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
    }
  };

  const handleCreateContrato = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/contratos/gerar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contrato criado com sucesso!');
      setShowCreateDialog(false);
      setFormData({
        parceiro_id: '',
        motorista_id: '',
        vehicle_id: '',
        data_inicio: new Date().toISOString().split('T')[0],
        tipo_contrato: 'comissao',
        valor_semanal: 230,
        comissao_percentual: 20,
        caucao_total: 300,
        caucao_lavagem: 90,
        tem_caucao: true,
        caucao_parcelada: false,
        caucao_parcelas: 4,
        caucao_texto: '',
        tem_epoca: false,
        data_inicio_epoca_alta: '',
        data_fim_epoca_alta: '',
        valor_epoca_alta: 300,
        texto_epoca_alta: '',
        data_inicio_epoca_baixa: '',
        data_fim_epoca_baixa: '',
        valor_epoca_baixa: 200,
        texto_epoca_baixa: '',
        condicoes_veiculo: '',
        template_texto: ''
      });
      fetchContratos();
    } catch (error) {
      console.error('Error creating contrato:', error);
      const errorMsg = error.response?.data?.detail;
      if (Array.isArray(errorMsg)) {
        toast.error(errorMsg.map(e => e.msg || e).join(', '));
      } else if (typeof errorMsg === 'string') {
        toast.error(errorMsg);
      } else {
        toast.error('Erro ao criar contrato');
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'rascunho': 'bg-gray-100 text-gray-700',
      'ativo': 'bg-green-100 text-green-700',
      'terminado': 'bg-red-100 text-red-700'
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'rascunho': 'Rascunho',
      'ativo': 'Ativo',
      'terminado': 'Terminado'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Carregando contratos...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestão de Contratos</h1>
            <p className="text-slate-600">Contratos TVDE entre Parceiros, Motoristas e Veículos</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Contrato
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-800">{contratos.length}</p>
                </div>
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Ativos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {contratos.filter(c => c.status === 'ativo').length}
                  </p>
                </div>
                <Check className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Rascunhos</p>
                  <p className="text-3xl font-bold text-gray-600">
                    {contratos.filter(c => c.status === 'rascunho').length}
                  </p>
                </div>
                <X className="w-10 h-10 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            {contratos.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nenhum contrato encontrado</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                >
                  Criar Primeiro Contrato
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {contratos.map((contrato) => (
                  <Card key={contrato.id} className="hover:shadow-md transition">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold">
                              Contrato {contrato.referencia}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(contrato.status)}`}>
                              {getStatusLabel(contrato.status)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                            <div className="flex items-center space-x-2">
                              <Building className="w-4 h-4 text-slate-500" />
                              <div>
                                <p className="text-slate-500">Parceiro</p>
                                <p className="font-medium">{contrato.parceiro_nome}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-slate-500" />
                              <div>
                                <p className="text-slate-500">Motorista</p>
                                <p className="font-medium">{contrato.motorista_nome}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Car className="w-4 h-4 text-slate-500" />
                              <div>
                                <p className="text-slate-500">Veículo</p>
                                <p className="font-medium">{contrato.vehicle_matricula}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-slate-600">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Início: {new Date(contrato.data_inicio).toLocaleDateString('pt-PT')}</span>
                            </div>
                            <div>
                              <span className="font-medium">€{contrato.valor_semanal}</span> /semana
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedContrato(contrato);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Contrato</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateContrato} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Parceiro *</Label>
                  <Select
                    value={formData.parceiro_id}
                    onValueChange={(value) => setFormData({...formData, parceiro_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={parceiros.length === 0 ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {parceiros.length === 0 ? (
                        <div className="p-2 text-sm text-slate-500">Nenhum parceiro disponível</div>
                      ) : (
                        parceiros.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome_empresa || p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Motorista *</Label>
                  <Select
                    value={formData.motorista_id}
                    onValueChange={(value) => setFormData({...formData, motorista_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={motoristas.length === 0 ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.length === 0 ? (
                        <div className="p-2 text-sm text-slate-500">Nenhum motorista disponível</div>
                      ) : (
                        motoristas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Veículo *</Label>
                  <Select
                    value={formData.vehicle_id}
                    onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={veiculos.length === 0 ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {veiculos.length === 0 ? (
                        <div className="p-2 text-sm text-slate-500">Nenhum veículo disponível</div>
                      ) : (
                        veiculos.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.matricula} - {v.marca} {v.modelo}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data de Início *</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label>Tipo de Contrato *</Label>
                  <Select
                    value={formData.tipo_contrato}
                    onValueChange={(value) => setFormData({...formData, tipo_contrato: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comissao">Comissão</SelectItem>
                      <SelectItem value="aluguer_sem_caucao">Aluguer Sem Caução</SelectItem>
                      <SelectItem value="aluguer_epocas_sem_caucao">Aluguer com Épocas Sem Caução</SelectItem>
                      <SelectItem value="aluguer_com_caucao">Aluguer Com Caução</SelectItem>
                      <SelectItem value="aluguer_caucao_epocas">Aluguer Com Caução e Épocas</SelectItem>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="motorista_privado">Motorista Privado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo de Comissão (apenas para tipo comissão) */}
                {formData.tipo_contrato === 'comissao' && (
                  <div>
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.comissao_percentual}
                      onChange={(e) => setFormData({...formData, comissao_percentual: parseFloat(e.target.value)})}
                    />
                  </div>
                )}
              </div>

              {/* Campos de Caução - Mostrar apenas para tipos com caução */}
              {(formData.tipo_contrato === 'aluguer_com_caucao' || formData.tipo_contrato === 'aluguer_caucao_epocas') && (
              <div className="space-y-4 p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
                <h3 className="font-semibold text-amber-900 flex items-center space-x-2">
                  <span>💰</span>
                  <span>Configuração de Caução</span>
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Caução Total (€) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.caucao_total}
                      onChange={(e) => setFormData({...formData, caucao_total: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Caução Lavagem (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.caucao_lavagem}
                      onChange={(e) => setFormData({...formData, caucao_lavagem: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="border-t border-amber-200 pt-3">
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="caucao_parcelada"
                      checked={formData.caucao_parcelada}
                      onChange={(e) => setFormData({...formData, caucao_parcelada: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="caucao_parcelada" className="font-semibold text-amber-900">
                      Parcelar Caução em X Vezes (Semanas)
                    </Label>
                  </div>

                  {formData.caucao_parcelada && (
                    <div className="bg-white p-3 rounded border border-amber-200">
                      <Label>Número de Parcelas (Semanas) *</Label>
                      <Input
                        type="number"
                        min="2"
                        max="52"
                        value={formData.caucao_parcelas}
                        onChange={(e) => setFormData({...formData, caucao_parcelas: parseInt(e.target.value)})}
                        placeholder="Ex: 4 semanas"
                        className="mt-1"
                      />
                      <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
                        <p className="font-semibold text-amber-900">Resumo do Parcelamento:</p>
                        <p className="text-amber-800">
                          • {formData.caucao_parcelas || 0} parcelas de <span className="font-bold">€{(formData.caucao_total / (formData.caucao_parcelas || 1)).toFixed(2)}</span> por semana
                        </p>
                        <p className="text-amber-800">
                          • Total: <span className="font-bold">€{formData.caucao_total.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Campos de Aluguer com Épocas - Opcional */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tem_epoca"
                    checked={formData.tem_epoca}
                    onChange={(e) => setFormData({...formData, tem_epoca: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="tem_epoca" className="font-semibold text-blue-900 flex items-center space-x-2 cursor-pointer">
                    <span>📅</span>
                    <span>Contrato com Épocas (Alta e Baixa)</span>
                  </Label>
                </div>

                {formData.tem_epoca && (
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-200">
                      <div className="col-span-2">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">Época Alta</h4>
                      </div>
                      <div>
                        <Label>Data Início Época Alta *</Label>
                        <Input
                          type="date"
                          value={formData.data_inicio_epoca_alta}
                          onChange={(e) => setFormData({...formData, data_inicio_epoca_alta: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Data Fim Época Alta *</Label>
                        <Input
                          type="date"
                          value={formData.data_fim_epoca_alta}
                          onChange={(e) => setFormData({...formData, data_fim_epoca_alta: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Valor Semanal Época Alta (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.valor_epoca_alta}
                          onChange={(e) => setFormData({...formData, valor_epoca_alta: parseFloat(e.target.value)})}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Observações/Descrição Época Alta</Label>
                        <textarea
                          className="w-full p-2 border rounded-md min-h-[60px] text-sm"
                          placeholder="Ex: Verão - Maior demanda turística, festivais, eventos..."
                          value={formData.texto_epoca_alta}
                          onChange={(e) => setFormData({...formData, texto_epoca_alta: e.target.value})}
                        />
                      </div>

                      <div className="col-span-2 border-t border-blue-200 pt-3">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">Época Baixa</h4>
                      </div>
                      <div>
                        <Label>Data Início Época Baixa *</Label>
                        <Input
                          type="date"
                          value={formData.data_inicio_epoca_baixa}
                          onChange={(e) => setFormData({...formData, data_inicio_epoca_baixa: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Data Fim Época Baixa *</Label>
                        <Input
                          type="date"
                          value={formData.data_fim_epoca_baixa}
                          onChange={(e) => setFormData({...formData, data_fim_epoca_baixa: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Valor Semanal Época Baixa (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.valor_epoca_baixa}
                          onChange={(e) => setFormData({...formData, valor_epoca_baixa: parseFloat(e.target.value)})}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Observações/Descrição Época Baixa</Label>
                        <textarea
                          className="w-full p-2 border rounded-md min-h-[60px] text-sm"
                          placeholder="Ex: Inverno - Menor movimento, clima desfavorável..."
                          value={formData.texto_epoca_baixa}
                          onChange={(e) => setFormData({...formData, texto_epoca_baixa: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>

              {/* Texto de Caução Personalizado */}
              {(formData.tipo_contrato === 'aluguer_com_caucao' || formData.tipo_contrato === 'aluguer_caucao_epocas') && (
                <div className="space-y-2">
                  <Label>Texto Personalizado da Caução (Opcional)</Label>
                  <p className="text-xs text-slate-500">
                    Texto adicional sobre condições específicas da caução para este contrato
                  </p>
                  <textarea
                    className="w-full p-3 border rounded-md min-h-[80px] text-sm"
                    placeholder="Ex: A caução será devolvida em 30 dias após o término do contrato, mediante vistoria do veículo..."
                    value={formData.caucao_texto}
                    onChange={(e) => setFormData({...formData, caucao_texto: e.target.value})}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Semanal Base (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_semanal}
                    onChange={(e) => setFormData({...formData, valor_semanal: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              {/* Condições do Veículo */}
              <div className="space-y-2">
                <Label>Condições do Veículo</Label>
                <p className="text-xs text-slate-500">Condições específicas do veículo para este contrato (editável)</p>
                <textarea
                  className="w-full p-3 border rounded-md min-h-[80px] text-sm"
                  placeholder="Ex: Veículo em bom estado, com manutenção em dia..."
                  value={formData.condicoes_veiculo}
                  onChange={(e) => setFormData({...formData, condicoes_veiculo: e.target.value})}
                />
              </div>

              {/* Template do Contrato */}
              <div className="space-y-2">
                <Label>Texto do Contrato (Opcional)</Label>
                <p className="text-xs text-slate-500 mb-2">
                  <strong>Variáveis Disponíveis:</strong>
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2 p-3 bg-slate-50 rounded">
                  <div><code>{'{'}PARCEIRO_NOME{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_NIF{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_MORADA{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_CP{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_LOCALIDADE{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_TELEFONE{'}'}</code></div>
                  <div><code>{'{'}PARCEIRO_EMAIL{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_NOME{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_CC{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_CC_VALIDADE{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_TELEFONE{'}'}</code></div>
                  <div><code>{'{'}REP_LEGAL_EMAIL{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_NOME{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CC{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CC_VALIDADE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_NIF{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_MORADA{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CP{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_LOCALIDADE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_TELEFONE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO_VALIDADE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_LICENCA_TVDE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_LICENCA_TVDE_VALIDADE{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_SS{'}'}</code></div>
                  <div><code>{'{'}MOTORISTA_EMAIL{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MARCA{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MODELO{'}'}</code></div>
                  <div><code>{'{'}VEICULO_MATRICULA{'}'}</code></div>
                  <div><code>{'{'}DATA_INICIO{'}'}</code></div>
                  <div><code>{'{'}DATA_EMISSAO{'}'}</code></div>
                  <div><code>{'{'}TIPO_CONTRATO{'}'}</code></div>
                  <div><code>{'{'}VALOR_SEMANAL{'}'}</code></div>
                  <div><code>{'{'}COMISSAO{'}'}</code></div>
                  <div><code>{'{'}CAUCAO_TOTAL{'}'}</code></div>
                  <div><code>{'{'}CAUCAO_PARCELAS{'}'}</code></div>
                  <div><code>{'{'}CAUCAO_TEXTO{'}'}</code></div>
                  <div><code>{'{'}DATA_INICIO_EPOCA_ALTA{'}'}</code></div>
                  <div><code>{'{'}DATA_FIM_EPOCA_ALTA{'}'}</code></div>
                  <div><code>{'{'}EPOCA_ALTA_VALOR{'}'}</code></div>
                  <div><code>{'{'}TEXTO_EPOCA_ALTA{'}'}</code></div>
                  <div><code>{'{'}DATA_INICIO_EPOCA_BAIXA{'}'}</code></div>
                  <div><code>{'{'}DATA_FIM_EPOCA_BAIXA{'}'}</code></div>
                  <div><code>{'{'}EPOCA_BAIXA_VALOR{'}'}</code></div>
                  <div><code>{'{'}TEXTO_EPOCA_BAIXA{'}'}</code></div>
                  <div><code>{'{'}CONDICOES_VEICULO{'}'}</code></div>
                </div>
                <textarea
                  className="w-full p-3 border rounded-md min-h-[200px] text-sm font-mono"
                  placeholder="Cole ou escreva o texto do contrato aqui. Use as variáveis acima para preenchimento automático."
                  value={formData.template_texto}
                  onChange={(e) => setFormData({...formData, template_texto: e.target.value})}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Criar Contrato
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {selectedContrato && (
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Contrato {selectedContrato.referencia}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${getStatusBadge(selectedContrato.status)}`}>
                      {getStatusLabel(selectedContrato.status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-slate-500">Data Assinatura</p>
                    <p className="font-medium">{selectedContrato.data_assinatura}</p>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Parceiro</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Nome:</strong> {selectedContrato.parceiro_nome}</p>
                    <p><strong>NIF:</strong> {selectedContrato.parceiro_nif}</p>
                    <p><strong>Morada:</strong> {selectedContrato.parceiro_morada}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Motorista</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Nome:</strong> {selectedContrato.motorista_nome}</p>
                    <p><strong>NIF:</strong> {selectedContrato.motorista_nif}</p>
                    <p><strong>CC:</strong> {selectedContrato.motorista_cc}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Veículo</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Matrícula:</strong> {selectedContrato.vehicle_matricula}</p>
                    <p><strong>Marca/Modelo:</strong> {selectedContrato.vehicle_marca} {selectedContrato.vehicle_modelo}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Termos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Valor Semanal:</strong> €{selectedContrato.valor_semanal}</p>
                    <p><strong>Caução Total:</strong> €{selectedContrato.caucao_total}</p>
                    <p><strong>Caução Lavagem:</strong> €{selectedContrato.caucao_lavagem}</p>
                  </CardContent>
                </Card>

                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default Contratos;
