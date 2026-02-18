import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { 
  Building2, Plus, Pencil, Trash2, Star, Check, X, 
  Mail, Phone, FileText, CreditCard, Loader2, AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function EmpresasFaturacao() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [empresaToDelete, setEmpresaToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    nipc: '',
    morada: '',
    codigo_postal: '',
    cidade: '',
    email: '',
    telefone: '',
    iban: '',
    principal: false
  });

  const fetchEmpresas = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/empresas-faturacao/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Erro ao carregar empresas');
      }
      
      const data = await response.json();
      setEmpresas(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar empresas de faturação');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const handleOpenModal = (empresa = null) => {
    if (empresa) {
      setEditingEmpresa(empresa);
      setFormData({
        nome: empresa.nome || '',
        nipc: empresa.nipc || '',
        morada: empresa.morada || '',
        codigo_postal: empresa.codigo_postal || '',
        cidade: empresa.cidade || '',
        email: empresa.email || '',
        telefone: empresa.telefone || '',
        iban: empresa.iban || '',
        principal: empresa.principal || false
      });
    } else {
      setEditingEmpresa(null);
      setFormData({
        nome: '',
        nipc: '',
        morada: '',
        codigo_postal: '',
        cidade: '',
        email: '',
        telefone: '',
        iban: '',
        principal: empresas.length === 0
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEmpresa(null);
    setFormData({
      nome: '',
      nipc: '',
      morada: '',
      codigo_postal: '',
      cidade: '',
      email: '',
      telefone: '',
      iban: '',
      principal: false
    });
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('O nome da empresa é obrigatório');
      return;
    }
    
    if (!formData.nipc.trim()) {
      toast.error('O NIPC é obrigatório');
      return;
    }

    if (formData.nipc.length !== 9 || !/^\d+$/.test(formData.nipc)) {
      toast.error('O NIPC deve ter 9 dígitos');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const url = editingEmpresa 
        ? `${API_URL}/api/empresas-faturacao/${editingEmpresa.id}`
        : `${API_URL}/api/empresas-faturacao/`;
      
      const response = await fetch(url, {
        method: editingEmpresa ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao guardar empresa');
      }

      toast.success(editingEmpresa ? 'Empresa atualizada com sucesso' : 'Empresa criada com sucesso');
      handleCloseModal();
      fetchEmpresas();
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao guardar empresa');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (empresa) => {
    setEmpresaToDelete(empresa);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!empresaToDelete) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/empresas-faturacao/${empresaToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao eliminar empresa');
      }

      toast.success('Empresa eliminada com sucesso');
      setShowDeleteModal(false);
      setEmpresaToDelete(null);
      fetchEmpresas();
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao eliminar empresa');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrincipal = async (empresa) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/empresas-faturacao/${empresa.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ principal: true })
      });

      if (!response.ok) {
        throw new Error('Erro ao definir empresa principal');
      }

      toast.success('Empresa definida como principal');
      fetchEmpresas();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao definir empresa principal');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-empresas">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4" data-testid="empresas-faturacao-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Empresas de Faturação
          </h1>
          <p className="text-gray-500 mt-1">
            Gerir as entidades para emissão de recibos e faturas
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} data-testid="btn-nova-empresa">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {empresas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Sem empresas de faturação
            </h3>
            <p className="text-gray-400 text-center mb-4">
              Adicione empresas para poder emitir recibos em diferentes entidades
            </p>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Empresa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Empresas</CardTitle>
            <CardDescription>
              {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} registada{empresas.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>NIPC</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((empresa) => (
                  <TableRow key={empresa.id} data-testid={`empresa-row-${empresa.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {empresa.principal && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        <div>
                          <div className="font-medium">{empresa.nome}</div>
                          {empresa.morada && (
                            <div className="text-sm text-gray-500">
                              {empresa.morada}
                              {empresa.cidade && `, ${empresa.cidade}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {empresa.nipc}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {empresa.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Mail className="w-3 h-3" />
                            {empresa.email}
                          </div>
                        )}
                        {empresa.telefone && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-3 h-3" />
                            {empresa.telefone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {empresa.ativa !== false ? (
                          <Badge variant="default" className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="w-3 h-3 mr-1" />
                            Inativa
                          </Badge>
                        )}
                        {empresa.principal && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                            Principal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!empresa.principal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrincipal(empresa)}
                            title="Definir como principal"
                            data-testid={`btn-principal-${empresa.id}`}
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(empresa)}
                          data-testid={`btn-editar-${empresa.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(empresa)}
                          data-testid={`btn-eliminar-${empresa.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal Criar/Editar Empresa */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[550px]" data-testid="modal-empresa">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingEmpresa ? 'Editar Empresa' : 'Nova Empresa de Faturação'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa que irá emitir recibos e faturas
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Empresa *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Empresa XYZ Lda"
                  data-testid="input-nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nipc">NIPC *</Label>
                <Input
                  id="nipc"
                  value={formData.nipc}
                  onChange={(e) => setFormData({ ...formData, nipc: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                  placeholder="9 dígitos"
                  maxLength={9}
                  data-testid="input-nipc"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="morada">Morada</Label>
              <Input
                id="morada"
                value={formData.morada}
                onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                placeholder="Rua, número, andar..."
                data-testid="input-morada"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo_postal">Código Postal</Label>
                <Input
                  id="codigo_postal"
                  value={formData.codigo_postal}
                  onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                  placeholder="0000-000"
                  data-testid="input-codigo-postal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="Lisboa"
                  data-testid="input-cidade"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="empresa@exemplo.com"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="+351 912 345 678"
                  data-testid="input-telefone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                IBAN
              </Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                placeholder="PT50 0000 0000 0000 0000 0000 0"
                data-testid="input-iban"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <div>
                  <Label htmlFor="principal" className="cursor-pointer">Empresa Principal</Label>
                  <p className="text-xs text-gray-500">Será usada por defeito nos novos recibos</p>
                </div>
              </div>
              <Switch
                id="principal"
                checked={formData.principal}
                onCheckedChange={(checked) => setFormData({ ...formData, principal: checked })}
                data-testid="switch-principal"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-guardar-empresa">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {editingEmpresa ? 'Atualizar' : 'Criar Empresa'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminação */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px]" data-testid="modal-delete-empresa">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Empresa
            </DialogTitle>
            <DialogDescription>
              Tem a certeza que deseja eliminar a empresa "{empresaToDelete?.nome}"?
              Esta ação não pode ser revertida.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowDeleteModal(false); setEmpresaToDelete(null); }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={saving}
              data-testid="btn-confirmar-eliminar"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A eliminar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
