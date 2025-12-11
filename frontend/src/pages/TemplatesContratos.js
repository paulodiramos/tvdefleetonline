import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus, Edit, Trash2, Save, X } from 'lucide-react';

const TemplatesContratos = ({ user, onLogout, showLayout = true }) => {
  const [templates, setTemplates] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showNovoTipoDialog, setShowNovoTipoDialog] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [tiposContrato, setTiposContrato] = useState([
    'Aluguer',
    'Prestação de Serviços',
    'Parceria',
    'Compra',
    'Venda',
    'Arrendamento'
  ]);
  const [formData, setFormData] = useState({
    nome: '',
    tipo_contrato: '',
    parceiro_id: '',
    descricao: '',
    texto_template: ''
  });

  useEffect(() => {
    fetchTemplates();
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    } else if (user.role === 'parceiro') {
      fetchParceiroLogado();
    }
  }, []);

  const fetchParceiroLogado = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Encontrar o parceiro pelo email do user
      const parceiro = response.data.find(p => p.email === user.email);
      if (parceiro) {
        setFormData(prev => ({ ...prev, parceiro_id: parceiro.id }));
      }
    } catch (error) {
      console.error('Error fetching parceiro:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/templates-contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
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

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      
      if (editingTemplate) {
        // Update existing template
        await axios.put(
          `${API}/templates-contratos/${editingTemplate.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Template atualizado com sucesso!');
      } else {
        // Create new template
        await axios.post(
          `${API}/templates-contratos`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Template criado com sucesso!');
      }
      
      setShowAddDialog(false);
      setEditingTemplate(null);
      setFormData({ nome: '', tipo_contrato: '', parceiro_id: '', descricao: '', texto_template: '' });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar template');
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      nome: template.nome,
      tipo_contrato: template.tipo_contrato || '',
      parceiro_id: template.parceiro_id || '',
      descricao: template.descricao || '',
      texto_template: template.texto_template
    });
    setShowAddDialog(true);
  };

  const handleAdicionarTipo = () => {
    if (!novoTipo.trim()) {
      toast.error('Digite o nome do tipo de contrato');
      return;
    }
    if (tiposContrato.includes(novoTipo)) {
      toast.error('Este tipo já existe');
      return;
    }
    setTiposContrato([...tiposContrato, novoTipo]);
    setFormData({ ...formData, tipo_contrato: novoTipo });
    setNovoTipo('');
    setShowNovoTipoDialog(false);
    toast.success('Novo tipo de contrato adicionado!');
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/templates-contratos/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Template excluído com sucesso!');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingTemplate(null);
    setFormData({ nome: '', descricao: '', texto_template: '' });
  };

  const content = (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Templates de Contratos</h1>
            <p className="text-slate-600 mt-1">
              Gerencie os templates para geração de contratos da sua empresa
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Template *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Contrato de Aluguer Padrão"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Tipo de Contrato *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNovoTipoDialog(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Novo Tipo
                    </Button>
                  </div>
                  <Select 
                    value={formData.tipo_contrato} 
                    onValueChange={(value) => setFormData({ ...formData, tipo_contrato: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ou crie um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContrato.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Selecione um tipo existente ou clique em "Novo Tipo" para criar
                  </p>
                </div>
                
                {(user.role === 'admin' || user.role === 'gestao') && (
                  <div className="space-y-2">
                    <Label>Parceiro Associado *</Label>
                    <Select 
                      value={formData.parceiro_id} 
                      onValueChange={(value) => setFormData({ ...formData, parceiro_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um parceiro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Template Global (todos os parceiros)</SelectItem>
                        {parceiros.map((parceiro) => (
                          <SelectItem key={parceiro.id} value={parceiro.id}>
                            {parceiro.nome_empresa || parceiro.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Cada parceiro pode ter apenas 1 template ativo. Ao criar um novo, o anterior será desativado.
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Breve descrição do template"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto do Contrato *</Label>
                  <p className="text-xs text-slate-600 mb-2">
                    <strong>Variáveis Disponíveis:</strong>
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2 p-3 bg-slate-50 rounded max-h-40 overflow-y-auto">
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
                  <p className="text-xs text-slate-500 mb-2">
                    Clique numa variável para inseri-la no texto do contrato
                  </p>
                  <Textarea
                    value={formData.texto_template}
                    onChange={(e) => setFormData({ ...formData, texto_template: e.target.value })}
                    placeholder="Cole ou escreva o texto do contrato aqui. Use as variáveis acima para preenchimento automático."
                    rows={15}
                    className="font-mono text-sm"
                    required
                  />
                </div>
                <div className="flex space-x-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Templates */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">A carregar templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Nenhum template criado</p>
              <p className="text-slate-500 text-sm mt-2">
                Crie o primeiro template para começar a gerar contratos personalizados
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span>{template.nome}</span>
                      </CardTitle>
                      {template.descricao && (
                        <p className="text-sm text-slate-600 mt-1">{template.descricao}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                      {template.texto_template.substring(0, 300)}
                      {template.texto_template.length > 300 && '...'}
                    </p>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Criado em: {new Date(template.created_at).toLocaleString('pt-PT')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Diálogo Novo Tipo de Contrato */}
        <Dialog open={showNovoTipoDialog} onOpenChange={setShowNovoTipoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Tipo de Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="novo-tipo">Nome do Tipo</Label>
                <Input
                  id="novo-tipo"
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value)}
                  placeholder="Ex: Compra de Viatura, Leasing"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdicionarTipo()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNovoTipoDialog(false);
                    setNovoTipo('');
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAdicionarTipo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Informação de Ajuda */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base text-blue-900">
              💡 Como usar templates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>
              • Os templates permitem criar contratos personalizados com dados dinâmicos
            </p>
            <p>
              • Use variáveis como {'{MOTORISTA_NOME}'} para inserir automaticamente informações
            </p>
            <p>
              • Ao criar um contrato, você poderá escolher o template desejado
            </p>
            <p>
              • Os templates só ficam disponíveis se o módulo "contratos" estiver ativo no seu plano
            </p>
          </CardContent>
        </Card>
      </div>
  );

  return showLayout ? (
    <Layout user={user} onLogout={onLogout}>
      {content}
    </Layout>
  ) : content;
};

export default TemplatesContratos;
