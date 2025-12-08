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
import { toast } from 'sonner';
import { FileText, Plus, Edit, Trash2, Save, X } from 'lucide-react';

const TemplatesContratos = ({ user, onLogout }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    texto_template: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

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
      setFormData({ nome: '', descricao: '', texto_template: '' });
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
      descricao: template.descricao || '',
      texto_template: template.texto_template
    });
    setShowAddDialog(true);
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

  return (
    <Layout user={user} onLogout={onLogout}>
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
                  <Label>Descrição</Label>
                  <Input
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Breve descrição do template"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto do Template *</Label>
                  <Textarea
                    value={formData.texto_template}
                    onChange={(e) => setFormData({ ...formData, texto_template: e.target.value })}
                    placeholder="Digite o texto do contrato. Use {MOTORISTA_NOME}, {VEICULO_MATRICULA}, {DATA_INICIO}, etc. para inserir dados dinâmicos."
                    rows={15}
                    className="font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Variáveis disponíveis: {'{MOTORISTA_NOME}'}, {'{MOTORISTA_NIF}'}, {'{VEICULO_MATRICULA}'}, 
                    {'{VEICULO_MARCA}'}, {'{DATA_INICIO}'}, {'{DATA_FIM}'}, {'{PARCEIRO_NOME}'}, {'{PARCEIRO_NIF}'}
                  </p>
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
    </Layout>
  );
};

export default TemplatesContratos;
