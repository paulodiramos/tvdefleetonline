import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Key, Eye, EyeOff, Plus, Save, Trash2, 
  Shield, AlertCircle, CheckCircle, RefreshCw 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CredenciaisAutomacaoTab = ({ parceiroId, parceiroNome }) => {
  const [credenciais, setCredenciais] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredencial, setEditingCredencial] = useState(null);
  const [formData, setFormData] = useState({
    fornecedor_id: '',
    email: '',
    password: '',
    codigo_2fa_secret: '',
    dados_extra: {}
  });

  useEffect(() => {
    if (parceiroId) {
      fetchCredenciais();
      fetchFornecedores();
    }
  }, [parceiroId]);

  const fetchCredenciais = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/automacao/credenciais?parceiro_id=${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredenciais(response.data);
    } catch (error) {
      console.error('Error fetching credenciais:', error);
      // Se der 404, significa que não há credenciais (normal para novo parceiro)
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar credenciais');
      }
      setCredenciais([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFornecedores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/automacao/fornecedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFornecedores(response.data);
    } catch (error) {
      console.error('Error fetching fornecedores:', error);
      // Try to get types if fornecedores is empty
      try {
        const typesResponse = await axios.get(`${API}/automacao/fornecedores/tipos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Convert types to fornecedor-like structure
        const tiposAsFornecedores = typesResponse.data.map(t => ({
          id: t.id,
          nome: t.nome,
          tipo: t.id
        }));
        setFornecedores(tiposAsFornecedores);
      } catch (e) {
        console.error('Error fetching tipos:', e);
      }
    }
  };

  const togglePassword = (credId) => {
    setShowPasswords(prev => ({
      ...prev,
      [credId]: !prev[credId]
    }));
  };

  const handleOpenDialog = (credencial = null) => {
    if (credencial) {
      setEditingCredencial(credencial);
      setFormData({
        fornecedor_id: credencial.fornecedor_id,
        email: credencial.email,
        password: '', // Never show existing password
        codigo_2fa_secret: credencial.codigo_2fa_secret || '',
        dados_extra: credencial.dados_extra || {}
      });
    } else {
      setEditingCredencial(null);
      setFormData({
        fornecedor_id: '',
        email: '',
        password: '',
        codigo_2fa_secret: '',
        dados_extra: {}
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveCredencial = async () => {
    if (!formData.fornecedor_id || !formData.email) {
      toast.error('Preencha o fornecedor e email');
      return;
    }

    // Se estamos a criar nova credencial, password é obrigatório
    if (!editingCredencial && !formData.password) {
      toast.error('Password é obrigatório para nova credencial');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        parceiro_id: parceiroId,
        fornecedor_id: formData.fornecedor_id,
        email: formData.email,
        password: formData.password || undefined, // Only send if provided
        codigo_2fa_secret: formData.codigo_2fa_secret || null,
        dados_extra: formData.dados_extra
      };

      // Remove password if empty (for updates)
      if (!payload.password) {
        delete payload.password;
      }

      await axios.post(`${API}/automacao/credenciais`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(editingCredencial ? 'Credenciais atualizadas!' : 'Credenciais guardadas!');
      setIsDialogOpen(false);
      fetchCredenciais();
    } catch (error) {
      console.error('Error saving credencial:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar credenciais');
    }
  };

  const handleDeleteCredencial = async (credencialId) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta credencial?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/automacao/credenciais/${credencialId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credencial eliminada!');
      fetchCredenciais();
    } catch (error) {
      console.error('Error deleting credencial:', error);
      toast.error('Erro ao eliminar credencial');
    }
  };

  const getFornecedorIcon = (tipo) => {
    const icons = {
      'uber': '🚗',
      'bolt': '⚡',
      'via_verde': '🛣️',
      'gps': '📍',
      'combustivel': '⛽',
      'carregamento_eletrico': '🔌'
    };
    return icons[tipo] || '🔧';
  };

  const getFornecedorColor = (tipo) => {
    const colors = {
      'uber': 'bg-black text-white',
      'bolt': 'bg-green-500 text-white',
      'via_verde': 'bg-green-600 text-white',
      'gps': 'bg-blue-500 text-white',
      'combustivel': 'bg-amber-500 text-white',
      'carregamento_eletrico': 'bg-purple-500 text-white'
    };
    return colors[tipo] || 'bg-slate-500 text-white';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com Info */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold">Credenciais de Automação RPA</h3>
            <p className="text-sm text-slate-500">
              Configure as credenciais de login para download automático de ficheiros
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Credencial
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                {editingCredencial ? 'Editar Credencial' : 'Nova Credencial'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Fornecedor Select */}
              <div className="space-y-2">
                <Label>Plataforma / Fornecedor</Label>
                <Select 
                  value={formData.fornecedor_id} 
                  onValueChange={(value) => setFormData({...formData, fornecedor_id: value})}
                  disabled={!!editingCredencial}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {getFornecedorIcon(f.tipo || f.id)} {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email / Username</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@exemplo.com"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>
                  Password
                  {editingCredencial && (
                    <span className="text-xs text-slate-500 ml-2">
                      (deixe em branco para manter)
                    </span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder={editingCredencial ? '••••••••' : 'Introduza a password'}
                />
              </div>

              {/* 2FA Secret (opcional) */}
              <div className="space-y-2">
                <Label>
                  Código 2FA Secret (opcional)
                  <span className="text-xs text-slate-500 ml-2">
                    Para autenticação em duas etapas
                  </span>
                </Label>
                <Input
                  type="text"
                  value={formData.codigo_2fa_secret}
                  onChange={(e) => setFormData({...formData, codigo_2fa_secret: e.target.value})}
                  placeholder="TOTP secret key"
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCredencial}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Warning Card */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4" />
            <span>
              As passwords são encriptadas e armazenadas de forma segura. 
              Apenas utilizadores autorizados podem executar automações.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Credenciais */}
      {credenciais.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-700 mb-2">Sem Credenciais Configuradas</h3>
            <p className="text-sm text-slate-500 mb-4">
              Configure as credenciais de acesso às plataformas para permitir o download automático de ficheiros.
            </p>
            <Button variant="outline" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Credencial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credenciais.map((cred) => (
            <Card key={cred.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {getFornecedorIcon(cred.fornecedor_tipo)}
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        {cred.fornecedor_nome || cred.fornecedor_tipo}
                      </CardTitle>
                      <Badge className={`text-xs ${getFornecedorColor(cred.fornecedor_tipo)}`}>
                        {cred.fornecedor_tipo}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ativa
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Email */}
                <div>
                  <Label className="text-xs text-slate-500">Email / Username</Label>
                  <p className="font-mono text-sm bg-slate-50 px-2 py-1 rounded">
                    {cred.email}
                  </p>
                </div>

                {/* Password (masked) */}
                <div>
                  <Label className="text-xs text-slate-500">Password</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm bg-slate-50 px-2 py-1 rounded flex-1">
                      {showPasswords[cred.id] ? '••••••••' : '••••••••'}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePassword(cred.id)}
                      title="Password encriptada - não pode ser visualizada"
                      disabled
                    >
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Password encriptada (não pode ser visualizada)
                  </p>
                </div>

                {/* 2FA Indicator */}
                {cred.codigo_2fa_secret && (
                  <Badge variant="outline" className="text-purple-600">
                    🔐 2FA Configurado
                  </Badge>
                )}

                {/* Last Updated */}
                {cred.updated_at && (
                  <p className="text-xs text-slate-400">
                    Última atualização: {new Date(cred.updated_at).toLocaleString('pt-PT')}
                  </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(cred)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteCredencial(cred.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CredenciaisAutomacaoTab;
