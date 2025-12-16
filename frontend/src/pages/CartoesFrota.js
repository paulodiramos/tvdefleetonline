import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Plus, Edit, Trash2, User, Fuel, Battery, Ticket } from 'lucide-react';

const CartoesFrota = ({ user, onLogout }) => {
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCartao, setEditingCartao] = useState(null);
  const [formData, setFormData] = useState({
    numero_cartao: '',
    tipo: 'combustivel',
    fornecedor: '',
    observacoes: ''
  });

  useEffect(() => {
    fetchCartoes();
  }, []);

  const fetchCartoes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/cartoes-frota`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartoes(response.data);
    } catch (error) {
      console.error('Erro ao carregar cartões:', error);
      toast.error('Erro ao carregar cartões de frota');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      
      if (editingCartao) {
        // Atualizar
        await axios.put(`${API}/cartoes-frota/${editingCartao.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cartão atualizado com sucesso!');
      } else {
        // Criar novo
        await axios.post(`${API}/cartoes-frota`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cartão criado com sucesso!');
      }
      
      setShowModal(false);
      setEditingCartao(null);
      setFormData({ numero_cartao: '', tipo: 'combustivel', fornecedor: '', observacoes: '' });
      fetchCartoes();
    } catch (error) {
      console.error('Erro ao salvar cartão:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar cartão');
    }
  };

  const handleEdit = (cartao) => {
    setEditingCartao(cartao);
    setFormData({
      numero_cartao: cartao.numero_cartao,
      tipo: cartao.tipo,
      fornecedor: cartao.fornecedor || '',
      observacoes: cartao.observacoes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (cartao) => {
    if (!window.confirm(`Tem certeza que deseja deletar o cartão ${cartao.numero_cartao}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/cartoes-frota/${cartao.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Cartão deletado com sucesso!');
      fetchCartoes();
    } catch (error) {
      console.error('Erro ao deletar cartão:', error);
      toast.error(error.response?.data?.detail || 'Erro ao deletar cartão');
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'combustivel': return <Fuel className="w-4 h-4" />;
      case 'eletrico': return <Battery className="w-4 h-4" />;
      case 'viaverde': return <Ticket className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'combustivel': return 'Combustível';
      case 'eletrico': return 'Elétrico';
      case 'viaverde': return 'Via Verde';
      default: return tipo;
    }
  };

  const getTipoBadgeColor = (tipo) => {
    switch (tipo) {
      case 'combustivel': return 'bg-orange-100 text-orange-700';
      case 'eletrico': return 'bg-green-100 text-green-700';
      case 'viaverde': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">A carregar...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-indigo-600" />
              Cartões de Frota
            </h1>
            <p className="text-slate-600 mt-1">Gestão de cartões de combustível, elétrico e Via Verde</p>
          </div>
          {['admin', 'gestao', 'parceiro'].includes(user.role) && (
            <Button onClick={() => {
              setEditingCartao(null);
              setFormData({ numero_cartao: '', tipo: 'combustivel', fornecedor: '', observacoes: '' });
              setShowModal(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Cartão
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Número do Cartão</th>
                    <th className="text-left py-3 px-4 font-semibold">Tipo</th>
                    <th className="text-left py-3 px-4 font-semibold">Fornecedor</th>
                    <th className="text-left py-3 px-4 font-semibold">Motorista</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    {['admin', 'gestao', 'parceiro'].includes(user.role) && (
                      <th className="text-right py-3 px-4 font-semibold">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {cartoes.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-500">
                        Nenhum cartão de frota cadastrado. Clique em "Adicionar Cartão" para começar.
                      </td>
                    </tr>
                  ) : (
                    cartoes.map((cartao) => (
                      <tr key={cartao.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono">{cartao.numero_cartao}</td>
                        <td className="py-3 px-4">
                          <Badge className={getTipoBadgeColor(cartao.tipo)}>
                            <span className="flex items-center gap-1">
                              {getTipoIcon(cartao.tipo)}
                              {getTipoLabel(cartao.tipo)}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{cartao.fornecedor || '-'}</td>
                        <td className="py-3 px-4">
                          {cartao.motorista_nome ? (
                            <span className="flex items-center gap-1 text-sm">
                              <User className="w-3 h-3" />
                              {cartao.motorista_nome}
                            </span>
                          ) : (
                            <span className="text-slate-400">Não atribuído</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={cartao.status === 'ativo' ? 'default' : 'secondary'}>
                            {cartao.status}
                          </Badge>
                        </td>
                        {['admin', 'gestao', 'parceiro'].includes(user.role) && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(cartao)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {['admin', 'gestao'].includes(user.role) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(cartao)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingCartao ? 'Editar Cartão' : 'Novo Cartão de Frota'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Número do Cartão *</Label>
                <Input
                  value={formData.numero_cartao}
                  onChange={(e) => setFormData({ ...formData, numero_cartao: e.target.value })}
                  placeholder="Ex: GALP123456, PTPRIO6087131736480003"
                  required
                  disabled={!!editingCartao}
                />
                {editingCartao && (
                  <p className="text-xs text-slate-500 mt-1">Número do cartão não pode ser alterado</p>
                )}
              </div>

              <div>
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combustivel">
                      <span className="flex items-center gap-2">
                        <Fuel className="w-4 h-4" />
                        Combustível
                      </span>
                    </SelectItem>
                    <SelectItem value="eletrico">
                      <span className="flex items-center gap-2">
                        <Battery className="w-4 h-4" />
                        Elétrico
                      </span>
                    </SelectItem>
                    <SelectItem value="viaverde">
                      <span className="flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        Via Verde
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <Input
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Ex: Galp, Repsol, PRIO, Via Verde"
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o cartão..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingCartao ? 'Atualizar' : 'Criar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCartao(null);
                    setFormData({ numero_cartao: '', tipo: 'combustivel', fornecedor: '', observacoes: '' });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CartoesFrota;
