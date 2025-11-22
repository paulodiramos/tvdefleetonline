import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Plus, Edit, Trash2, Euro, Percent, Calendar } from 'lucide-react';

const TIPOS_CONTRATO = [
  { value: 'aluguer_sem_caucao', label: 'Aluguer sem Caução' },
  { value: 'aluguer_com_caucao', label: 'Aluguer com Caução' },
  { value: 'aluguer_caucao_parcelada', label: 'Aluguer com Caução Parcelada' },
  { value: 'periodo_epoca', label: 'Período de Época' },
  { value: 'aluguer_epocas_sem_caucao', label: 'Aluguer com Épocas sem Caução' },
  { value: 'aluguer_epocas_caucao', label: 'Aluguer com Épocas e Caução' },
  { value: 'aluguer_epoca_caucao_parcelada', label: 'Aluguer Época com Caução Parcelada' },
  { value: 'compra_veiculo', label: 'Compra de Veículo' },
  { value: 'comissao', label: 'Comissão' },
  { value: 'motorista_privado', label: 'Motorista Privado' },
  { value: 'outros', label: 'Outros' }
];

const TemplatesContratoTab = ({ parceiroId, user }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    nome_template: '',
    tipo_contrato: 'aluguer_sem_caucao',
    periodicidade_padrao: 'semanal',
    valor_base: '',
    valor_caucao: '',
    numero_parcelas_caucao: '',
    valor_epoca_alta: '',
    valor_epoca_baixa: '',
    percentagem_motorista: '',
    percentagem_parceiro: '',
    combustivel_incluido: false,
    regime_trabalho: 'full_time',
    valor_compra_veiculo: '',
    numero_semanas_compra: '',
    com_slot: false,
    extra_seguro: false,
    valor_extra_seguro: '',
    clausulas_texto: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, [parceiroId]);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${parceiroId}/templates-contrato`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.filter(t => t.ativo));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erro ao carregar templates');
      setLoading(false);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        nome_template: template.nome_template,
        tipo_contrato: template.tipo_contrato,
        periodicidade_padrao: template.periodicidade_padrao || 'semanal',
        valor_base: template.valor_base || '',
        valor_caucao: template.valor_caucao || '',
        numero_parcelas_caucao: template.numero_parcelas_caucao || '',
        valor_epoca_alta: template.valor_epoca_alta || '',
        valor_epoca_baixa: template.valor_epoca_baixa || '',
        percentagem_motorista: template.percentagem_motorista || '',
        percentagem_parceiro: template.percentagem_parceiro || '',
        combustivel_incluido: template.combustivel_incluido || false,
        regime_trabalho: template.regime_trabalho || 'full_time',
        valor_compra_veiculo: template.valor_compra_veiculo || '',
        numero_semanas_compra: template.numero_semanas_compra || '',
        com_slot: template.com_slot || false,
        extra_seguro: template.extra_seguro || false,
        valor_extra_seguro: template.valor_extra_seguro || '',
        clausulas_texto: template.clausulas_texto || ''
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        nome_template: '',
        tipo_contrato: 'aluguer_sem_caucao',
        periodicidade_padrao: 'semanal',
        valor_base: '',
        valor_caucao: '',
        numero_parcelas_caucao: '',
        valor_epoca_alta: '',
        valor_epoca_baixa: '',
        percentagem_motorista: '',
        percentagem_parceiro: '',
        combustivel_incluido: false,
        regime_trabalho: 'full_time',
        valor_compra_veiculo: '',
        numero_semanas_compra: '',
        com_slot: false,
        extra_seguro: false,
        valor_extra_seguro: '',
        clausulas_texto: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (formData.tipo_contrato === 'comissao') {
      const totalComissao = parseFloat(formData.percentagem_motorista || 0) + parseFloat(formData.percentagem_parceiro || 0);
      if (totalComissao !== 100) {
        toast.error('As percentagens de comissão devem somar 100%');
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      
      // Clean data - convert empty strings to null
      const cleanData = {
        ...formData,
        valor_base: formData.valor_base ? parseFloat(formData.valor_base) : null,
        valor_caucao: formData.valor_caucao ? parseFloat(formData.valor_caucao) : null,
        numero_parcelas_caucao: formData.numero_parcelas_caucao ? parseInt(formData.numero_parcelas_caucao) : null,
        valor_epoca_alta: formData.valor_epoca_alta ? parseFloat(formData.valor_epoca_alta) : null,
        valor_epoca_baixa: formData.valor_epoca_baixa ? parseFloat(formData.valor_epoca_baixa) : null,
        percentagem_motorista: formData.percentagem_motorista ? parseFloat(formData.percentagem_motorista) : null,
        percentagem_parceiro: formData.percentagem_parceiro ? parseFloat(formData.percentagem_parceiro) : null,
        valor_compra_veiculo: formData.valor_compra_veiculo ? parseFloat(formData.valor_compra_veiculo) : null,
        numero_semanas_compra: formData.numero_semanas_compra ? parseInt(formData.numero_semanas_compra) : null,
        valor_extra_seguro: formData.valor_extra_seguro ? parseFloat(formData.valor_extra_seguro) : null
      };

      if (editingTemplate) {
        await axios.put(`${API}/templates-contrato/${editingTemplate.id}`, cleanData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template atualizado com sucesso!');
      } else {
        await axios.post(`${API}/parceiros/${parceiroId}/templates-contrato`, cleanData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template criado com sucesso!');
      }
      
      setShowModal(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar template');
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm('Tem certeza que deseja remover este template?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/templates-contrato/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Template removido com sucesso!');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao remover template');
    }
  };

  const needsCaucao = () => {
    return ['aluguer_com_caucao', 'aluguer_caucao_parcelada', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(formData.tipo_contrato);
  };

  const needsCaucaoParcelada = () => {
    return ['aluguer_caucao_parcelada', 'aluguer_epoca_caucao_parcelada'].includes(formData.tipo_contrato);
  };

  const needsEpocas = () => {
    return ['periodo_epoca', 'aluguer_epocas_sem_caucao', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(formData.tipo_contrato);
  };

  const needsComissao = () => {
    return formData.tipo_contrato === 'comissao';
  };

  const needsCompraVeiculo = () => {
    return formData.tipo_contrato === 'compra_veiculo';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Templates de Contrato</h3>
          <p className="text-sm text-slate-600 mt-1">
            Crie templates personalizados para gerar contratos rapidamente
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {loading ? (
        <p>Carregando templates...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum template criado ainda.</p>
              <p className="text-sm mt-2">Crie o primeiro template clicando em "Novo Template"</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{template.nome_template}</span>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenModal(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tipo:</span>
                  <span className="font-medium">
                    {TIPOS_CONTRATO.find(t => t.value === template.tipo_contrato)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Periodicidade:</span>
                  <span className="font-medium capitalize">{template.periodicidade_padrao}</span>
                </div>
                {template.valor_base && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Valor Base:</span>
                    <span className="font-medium">€{template.valor_base}</span>
                  </div>
                )}
                {template.valor_caucao && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Caução:</span>
                    <span className="font-medium">€{template.valor_caucao}</span>
                  </div>
                )}
                {template.percentagem_motorista && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Comissão:</span>
                    <span className="font-medium">
                      {template.percentagem_motorista}% / {template.percentagem_parceiro}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para Criar/Editar Template */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template de Contrato'}
            </DialogTitle>
            <DialogDescription>
              Configure os valores padrão. Eles poderão ser ajustados ao criar o contrato para cada motorista.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Nome e Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome_template">Nome do Template *</Label>
                <Input
                  id="nome_template"
                  value={formData.nome_template}
                  onChange={(e) => setFormData({...formData, nome_template: e.target.value})}
                  placeholder="Ex: Aluguer Padrão, Comissão Premium"
                  required
                />
              </div>
              <div>
                <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                <Select 
                  value={formData.tipo_contrato} 
                  onValueChange={(value) => setFormData({...formData, tipo_contrato: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Periodicidade e Valor Base */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodicidade">Periodicidade Padrão *</Label>
                <Select 
                  value={formData.periodicidade_padrao} 
                  onValueChange={(value) => setFormData({...formData, periodicidade_padrao: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!needsCompraVeiculo() && !needsComissao() && (
                <div>
                  <Label htmlFor="valor_base">Valor Base (€)</Label>
                  <Input
                    id="valor_base"
                    type="number"
                    step="0.01"
                    value={formData.valor_base}
                    onChange={(e) => setFormData({...formData, valor_base: e.target.value})}
                    placeholder="Ex: 250.00"
                  />
                </div>
              )}
            </div>

            {/* Caução (se aplicável) */}
            {needsCaucao() && (
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <Euro className="w-4 h-4 mr-2" />
                    Caução
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor_caucao">Valor da Caução (€)</Label>
                      <Input
                        id="valor_caucao"
                        type="number"
                        step="0.01"
                        value={formData.valor_caucao}
                        onChange={(e) => setFormData({...formData, valor_caucao: e.target.value})}
                        placeholder="Ex: 500.00"
                      />
                    </div>
                    {needsCaucaoParcelada() && (
                      <div>
                        <Label htmlFor="numero_parcelas_caucao">Número de Parcelas</Label>
                        <Input
                          id="numero_parcelas_caucao"
                          type="number"
                          value={formData.numero_parcelas_caucao}
                          onChange={(e) => setFormData({...formData, numero_parcelas_caucao: e.target.value})}
                          placeholder="Ex: 4"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Épocas (se aplicável) */}
            {needsEpocas() && (
              <Card className="bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Épocas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor_epoca_alta">Valor Época Alta (€)</Label>
                      <Input
                        id="valor_epoca_alta"
                        type="number"
                        step="0.01"
                        value={formData.valor_epoca_alta}
                        onChange={(e) => setFormData({...formData, valor_epoca_alta: e.target.value})}
                        placeholder="Ex: 300.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valor_epoca_baixa">Valor Época Baixa (€)</Label>
                      <Input
                        id="valor_epoca_baixa"
                        type="number"
                        step="0.01"
                        value={formData.valor_epoca_baixa}
                        onChange={(e) => setFormData({...formData, valor_epoca_baixa: e.target.value})}
                        placeholder="Ex: 200.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comissão (se aplicável) */}
            {needsComissao() && (
              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <Percent className="w-4 h-4 mr-2" />
                    Comissão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="percentagem_motorista">% Motorista</Label>
                      <Input
                        id="percentagem_motorista"
                        type="number"
                        step="0.01"
                        value={formData.percentagem_motorista}
                        onChange={(e) => setFormData({...formData, percentagem_motorista: e.target.value})}
                        placeholder="Ex: 60"
                      />
                    </div>
                    <div>
                      <Label htmlFor="percentagem_parceiro">% Parceiro</Label>
                      <Input
                        id="percentagem_parceiro"
                        type="number"
                        step="0.01"
                        value={formData.percentagem_parceiro}
                        onChange={(e) => setFormData({...formData, percentagem_parceiro: e.target.value})}
                        placeholder="Ex: 40"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="combustivel_incluido"
                        checked={formData.combustivel_incluido}
                        onChange={(e) => setFormData({...formData, combustivel_incluido: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="combustivel_incluido" className="cursor-pointer">Combustível Incluído</Label>
                    </div>
                    <div>
                      <Label htmlFor="regime_trabalho">Regime</Label>
                      <Select 
                        value={formData.regime_trabalho} 
                        onValueChange={(value) => setFormData({...formData, regime_trabalho: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compra de Veículo (se aplicável) */}
            {needsCompraVeiculo() && (
              <Card className="bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-base">Compra de Veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor_compra_veiculo">Valor de Compra (€)</Label>
                      <Input
                        id="valor_compra_veiculo"
                        type="number"
                        step="0.01"
                        value={formData.valor_compra_veiculo}
                        onChange={(e) => setFormData({...formData, valor_compra_veiculo: e.target.value})}
                        placeholder="Ex: 15000.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="numero_semanas_compra">Número de Semanas</Label>
                      <Input
                        id="numero_semanas_compra"
                        type="number"
                        value={formData.numero_semanas_compra}
                        onChange={(e) => setFormData({...formData, numero_semanas_compra: e.target.value})}
                        placeholder="Ex: 104 (2 anos)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="com_slot"
                        checked={formData.com_slot}
                        onChange={(e) => setFormData({...formData, com_slot: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="com_slot" className="cursor-pointer">Com Slot</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="extra_seguro"
                        checked={formData.extra_seguro}
                        onChange={(e) => setFormData({...formData, extra_seguro: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="extra_seguro" className="cursor-pointer">Extra Seguro</Label>
                    </div>
                    {formData.extra_seguro && (
                      <div>
                        <Label htmlFor="valor_extra_seguro">Valor (€)</Label>
                        <Input
                          id="valor_extra_seguro"
                          type="number"
                          step="0.01"
                          value={formData.valor_extra_seguro}
                          onChange={(e) => setFormData({...formData, valor_extra_seguro: e.target.value})}
                          placeholder="Ex: 50.00"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cláusulas */}
            <div>
              <Label htmlFor="clausulas_texto">Cláusulas do Contrato (opcional)</Label>
              <Textarea
                id="clausulas_texto"
                value={formData.clausulas_texto}
                onChange={(e) => setFormData({...formData, clausulas_texto: e.target.value})}
                placeholder="Digite as cláusulas contratuais que devem aparecer no PDF..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Este texto será incluído no contrato gerado. Use para condições específicas, termos, etc.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTemplate ? 'Atualizar Template' : 'Criar Template'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesContratoTab;
