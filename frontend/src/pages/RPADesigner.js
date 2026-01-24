import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  Bot,
  Plus,
  Upload,
  Code,
  Settings,
  Trash2,
  Edit,
  Copy,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FileCode,
  HelpCircle,
  Download,
  Play,
  BarChart3,
  Zap,
  TableProperties
} from 'lucide-react';

const RPADesigner = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scripts');
  
  // Estados
  const [scripts, setScripts] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [template, setTemplate] = useState(null);
  
  // Modais
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showCodigoModal, setShowCodigoModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showInstrucoesModal, setShowInstrucoesModal] = useState(false);
  
  // Forms
  const [scriptForm, setScriptForm] = useState({
    nome: '',
    descricao: '',
    icone: '🤖',
    cor: '#6B7280',
    url_base: '',
    campos_credenciais: [
      { nome: 'email', tipo: 'email', label: 'Email', obrigatorio: true },
      { nome: 'password', tipo: 'password', label: 'Password', obrigatorio: true }
    ],
    codigo_script: '',
    tipos_extracao: ['todos'],
    notas_admin: ''
  });
  
  const [selectedScript, setSelectedScript] = useState(null);
  const [saving, setSaving] = useState(false);

  // Cores disponíveis
  const coresDisponiveis = [
    { nome: 'Cinzento', valor: '#6B7280' },
    { nome: 'Vermelho', valor: '#EF4444' },
    { nome: 'Laranja', valor: '#F97316' },
    { nome: 'Amarelo', valor: '#EAB308' },
    { nome: 'Verde', valor: '#22C55E' },
    { nome: 'Azul', valor: '#3B82F6' },
    { nome: 'Roxo', valor: '#8B5CF6' },
    { nome: 'Rosa', valor: '#EC4899' },
    { nome: 'Preto', valor: '#000000' }
  ];

  // Ícones disponíveis
  const iconesDisponiveis = ['🤖', '🚗', '⚡', '🛣️', '⛽', '💳', '📊', '🔄', '📦', '🏢', '💰', '📈'];

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchDados();
  }, [user]);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Buscar scripts
      const scriptsRes = await axios.get(`${API}/rpa-designer/scripts?incluir_inativos=true`, { headers });
      setScripts(scriptsRes.data || []);
      
      // Buscar estatísticas
      try {
        const statsRes = await axios.get(`${API}/rpa-designer/estatisticas`, { headers });
        setEstatisticas(statsRes.data);
      } catch (e) {
        console.error('Erro ao buscar estatísticas:', e);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/rpa-designer/template-script`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplate(res.data);
      setShowTemplateModal(true);
    } catch (error) {
      toast.error('Erro ao carregar template');
    }
  };

  const handleCriar = async () => {
    if (!scriptForm.nome || !scriptForm.codigo_script) {
      toast.error('Preencha o nome e o código do script');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa-designer/scripts`, scriptForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Script criado com sucesso!');
      setShowCriarModal(false);
      resetForm();
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar script');
    } finally {
      setSaving(false);
    }
  };

  const handleAtualizar = async () => {
    if (!selectedScript) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/rpa-designer/scripts/${selectedScript.id}`, scriptForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Script atualizado com sucesso!');
      setShowEditarModal(false);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar script');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (scriptId) => {
    if (!confirm('Tem a certeza que quer eliminar este script?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/rpa-designer/scripts/${scriptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Script eliminado');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao eliminar script');
    }
  };

  const handleDuplicar = async (scriptId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa-designer/scripts/${scriptId}/duplicar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Script duplicado com sucesso');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao duplicar script');
    }
  };

  const handleVerCodigo = async (script) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/rpa-designer/scripts/${script.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedScript(res.data);
      setShowCodigoModal(true);
    } catch (error) {
      toast.error('Erro ao carregar código');
    }
  };

  const handleEditar = async (script) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/rpa-designer/scripts/${script.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      
      setSelectedScript(data);
      setScriptForm({
        nome: data.nome || '',
        descricao: data.descricao || '',
        icone: data.icone || '🤖',
        cor: data.cor || '#6B7280',
        url_base: data.url_base || '',
        campos_credenciais: data.campos_credenciais || [
          { nome: 'email', tipo: 'email', label: 'Email', obrigatorio: true },
          { nome: 'password', tipo: 'password', label: 'Password', obrigatorio: true }
        ],
        codigo_script: data.codigo_script || '',
        tipos_extracao: data.tipos_extracao || ['todos'],
        notas_admin: data.notas_admin || '',
        ativo: data.ativo !== false
      });
      setShowEditarModal(true);
    } catch (error) {
      toast.error('Erro ao carregar script');
    }
  };

  const resetForm = () => {
    setScriptForm({
      nome: '',
      descricao: '',
      icone: '🤖',
      cor: '#6B7280',
      url_base: '',
      campos_credenciais: [
        { nome: 'email', tipo: 'email', label: 'Email', obrigatorio: true },
        { nome: 'password', tipo: 'password', label: 'Password', obrigatorio: true }
      ],
      codigo_script: '',
      tipos_extracao: ['todos'],
      notas_admin: ''
    });
    setSelectedScript(null);
  };

  const addCampoCredencial = () => {
    setScriptForm(prev => ({
      ...prev,
      campos_credenciais: [
        ...prev.campos_credenciais,
        { nome: '', tipo: 'text', label: '', obrigatorio: true }
      ]
    }));
  };

  const removeCampoCredencial = (index) => {
    setScriptForm(prev => ({
      ...prev,
      campos_credenciais: prev.campos_credenciais.filter((_, i) => i !== index)
    }));
  };

  const updateCampoCredencial = (index, field, value) => {
    setScriptForm(prev => ({
      ...prev,
      campos_credenciais: prev.campos_credenciais.map((campo, i) => 
        i === index ? { ...campo, [field]: value } : campo
      )
    }));
  };

  if (user?.role !== 'admin') {
    return null;
  }

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileCode className="w-6 h-6" />
                RPA Designer
              </h1>
              <p className="text-slate-600">Criar e gerir scripts de automação Playwright</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button 
              variant="outline" 
              onClick={() => navigate('/rpa-automacao')}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              RPA Automação
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/configuracao-mapeamento')}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <TableProperties className="w-4 h-4 mr-2" />
              Mapeamento
            </Button>
            <Button variant="outline" onClick={() => setShowInstrucoesModal(true)}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Instruções
            </Button>
            <Button variant="outline" onClick={fetchTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button onClick={() => { resetForm(); setShowCriarModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Script
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Scripts Ativos</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticas.total_scripts}</p>
                  </div>
                  <Bot className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Execuções Total</p>
                    <p className="text-2xl font-bold text-slate-700">{estatisticas.total_execucoes}</p>
                  </div>
                  <Play className="w-8 h-8 text-slate-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Taxa Sucesso</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticas.taxa_sucesso.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Scripts Inativos</p>
                    <p className="text-2xl font-bold text-slate-400">{estatisticas.scripts_inativos}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-slate-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Scripts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scripts de Automação</CardTitle>
                <CardDescription>Scripts Playwright para extração automática de dados</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchDados}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scripts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum script criado</p>
                <p className="text-sm mb-4">Crie o primeiro script de automação para os parceiros usarem</p>
                <Button onClick={() => { resetForm(); setShowCriarModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Script
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scripts.map((script) => (
                  <Card 
                    key={script.id} 
                    className={`transition-all hover:shadow-md ${!script.ativo ? 'opacity-60' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl"
                          style={{ backgroundColor: script.cor }}
                        >
                          {script.icone}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate flex items-center gap-2">
                            {script.nome}
                            {!script.ativo && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="truncate">{script.descricao}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {script.tipos_extracao?.map((tipo) => (
                            <Badge key={tipo} variant="outline" className="text-xs">{tipo}</Badge>
                          ))}
                        </div>
                        
                        <div className="text-xs text-slate-500 space-y-1">
                          <p>Versão: {script.versao || 1}</p>
                          <p>Execuções: {script.execucoes_total || 0} ({script.execucoes_sucesso || 0} com sucesso)</p>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleVerCodigo(script)}>
                            <Code className="w-3 h-3 mr-1" />
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditar(script)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDuplicar(script.id)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleEliminar(script.id)}
                          >
                            <Trash2 className="w-3 h-3" />
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
      </div>

      {/* Modal Criar/Editar Script */}
      <Dialog open={showCriarModal || showEditarModal} onOpenChange={(open) => {
        if (!open) {
          setShowCriarModal(false);
          setShowEditarModal(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              {showEditarModal ? 'Editar Script' : 'Criar Novo Script'}
            </DialogTitle>
            <DialogDescription>
              {showEditarModal ? 'Atualize as configurações do script' : 'Configure um novo script de automação Playwright'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Plataforma *</Label>
                <Input
                  placeholder="Ex: Via Verde, Uber, Prio..."
                  value={scriptForm.nome}
                  onChange={(e) => setScriptForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>URL Base</Label>
                <Input
                  placeholder="https://exemplo.com"
                  value={scriptForm.url_base}
                  onChange={(e) => setScriptForm(prev => ({ ...prev, url_base: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição do que este script faz..."
                value={scriptForm.descricao}
                onChange={(e) => setScriptForm(prev => ({ ...prev, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Ícone e Cor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-2">
                  {iconesDisponiveis.map((icone) => (
                    <Button
                      key={icone}
                      type="button"
                      variant={scriptForm.icone === icone ? 'default' : 'outline'}
                      size="sm"
                      className="w-10 h-10 text-lg"
                      onClick={() => setScriptForm(prev => ({ ...prev, icone }))}
                    >
                      {icone}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {coresDisponiveis.map((cor) => (
                    <Button
                      key={cor.valor}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`w-10 h-10 ${scriptForm.cor === cor.valor ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                      style={{ backgroundColor: cor.valor }}
                      onClick={() => setScriptForm(prev => ({ ...prev, cor: cor.valor }))}
                      title={cor.nome}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Campos de Credenciais */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Campos de Credenciais (que o parceiro preenche)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCampoCredencial}>
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar Campo
                </Button>
              </div>
              
              <div className="space-y-2">
                {scriptForm.campos_credenciais.map((campo, index) => (
                  <div key={index} className="flex gap-2 items-center p-3 bg-slate-50 rounded-lg">
                    <Input
                      placeholder="Nome (ex: email)"
                      value={campo.nome}
                      onChange={(e) => updateCampoCredencial(index, 'nome', e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={campo.tipo}
                      onValueChange={(v) => updateCampoCredencial(index, 'tipo', v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="password">Password</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Label (ex: Email)"
                      value={campo.label}
                      onChange={(e) => updateCampoCredencial(index, 'label', e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={campo.obrigatorio}
                        onCheckedChange={(checked) => updateCampoCredencial(index, 'obrigatorio', checked)}
                      />
                      <span className="text-xs text-slate-500">Obrig.</span>
                    </div>
                    {scriptForm.campos_credenciais.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => removeCampoCredencial(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tipos de Extração */}
            <div className="space-y-2">
              <Label>Tipos de Extração (separados por vírgula)</Label>
              <Input
                placeholder="todos, ganhos, portagens, combustivel"
                value={scriptForm.tipos_extracao.join(', ')}
                onChange={(e) => setScriptForm(prev => ({
                  ...prev,
                  tipos_extracao: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                }))}
              />
            </div>

            {/* Código do Script */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Código Python (Playwright) *</Label>
                <Button type="button" variant="outline" size="sm" onClick={fetchTemplate}>
                  <Download className="w-3 h-3 mr-1" />
                  Ver Template
                </Button>
              </div>
              <Textarea
                placeholder="Cole aqui o código Python gerado pelo Playwright Codegen..."
                value={scriptForm.codigo_script}
                onChange={(e) => setScriptForm(prev => ({ ...prev, codigo_script: e.target.value }))}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Dica: Use `npx playwright codegen [URL]` no seu computador para gravar o script
              </p>
            </div>

            {/* Notas Admin */}
            <div className="space-y-2">
              <Label>Notas Internas (só admin vê)</Label>
              <Textarea
                placeholder="Observações, problemas conhecidos, etc..."
                value={scriptForm.notas_admin}
                onChange={(e) => setScriptForm(prev => ({ ...prev, notas_admin: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Status Ativo (apenas edição) */}
            {showEditarModal && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Switch
                  checked={scriptForm.ativo !== false}
                  onCheckedChange={(checked) => setScriptForm(prev => ({ ...prev, ativo: checked }))}
                />
                <div>
                  <Label>Script Ativo</Label>
                  <p className="text-xs text-slate-500">Scripts inativos não aparecem para os parceiros</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCriarModal(false);
              setShowEditarModal(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={showEditarModal ? handleAtualizar : handleCriar} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {showEditarModal ? 'Guardar Alterações' : 'Criar Script'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Código */}
      <Dialog open={showCodigoModal} onOpenChange={setShowCodigoModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Código do Script: {selectedScript?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="p-4 bg-slate-900 text-green-400 rounded-lg text-sm font-mono whitespace-pre-wrap">
              {selectedScript?.codigo_script || 'Código não disponível'}
            </pre>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                navigator.clipboard.writeText(selectedScript?.codigo_script || '');
                toast.success('Código copiado!');
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Código
            </Button>
            <Button onClick={() => setShowCodigoModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Template */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              Template de Script Playwright
            </DialogTitle>
          </DialogHeader>
          
          {template && (
            <div className="space-y-4">
              {/* Instruções */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Instruções:</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  {template.instrucoes.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </div>
              
              {/* Template Code */}
              <div className="overflow-auto max-h-[40vh]">
                <pre className="p-4 bg-slate-900 text-green-400 rounded-lg text-sm font-mono whitespace-pre-wrap">
                  {template.template}
                </pre>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                navigator.clipboard.writeText(template?.template || '');
                toast.success('Template copiado!');
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Template
            </Button>
            <Button onClick={() => setShowTemplateModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Instruções */}
      <Dialog open={showInstrucoesModal} onOpenChange={setShowInstrucoesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Como Criar Scripts de Automação
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h4 className="font-medium">1. Instalar Playwright no seu computador</h4>
              <code className="block p-2 bg-slate-200 rounded text-sm">
                npm init playwright@latest
              </code>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h4 className="font-medium">2. Iniciar o Gravador</h4>
              <code className="block p-2 bg-slate-200 rounded text-sm">
                npx playwright codegen https://site-alvo.com
              </code>
              <p className="text-sm text-slate-600">
                Isto abre um browser onde pode navegar normalmente. 
                Todas as suas ações serão gravadas e convertidas em código Python.
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h4 className="font-medium">3. Gravar as Ações</h4>
              <p className="text-sm text-slate-600">
                No browser que abriu, faça exatamente o que quer automatizar:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>Clique no botão de login</li>
                <li>Preencha os campos (email, password)</li>
                <li>Navegue até à página de dados</li>
                <li>Aplique filtros se necessário</li>
                <li>Clique em exportar/extrair</li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h4 className="font-medium">4. Copiar e Adaptar o Código</h4>
              <p className="text-sm text-slate-600">
                O código Python aparece numa janela lateral. Copie-o e:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>Substitua valores fixos por variáveis (email, password)</li>
                <li>Adicione lógica para extrair os dados</li>
                <li>Cole no formulário de criação de script</li>
              </ul>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Nota:</strong> Os parceiros NÃO vêem o código do script. 
                Eles apenas preenchem as credenciais e clicam em "Executar".
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowInstrucoesModal(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RPADesigner;
