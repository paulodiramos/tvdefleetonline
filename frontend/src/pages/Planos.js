import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Plus, Edit2, Check } from 'lucide-react';

const Planos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlano, setEditingPlano] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo_usuario: 'parceiro',
    preco_por_unidade: '',
    descricao: '',
    features: ''
  });

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching planos', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/seed-planos`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Planos padrão criados com sucesso!');
      fetchPlanos();
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao criar planos padrão');
    }
  };

  const handleCreatePlano = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        preco_por_unidade: parseFloat(formData.preco_por_unidade),
        features: formData.features.split(',').map(f => f.trim())
      };

      await axios.post(`${API}/admin/planos`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Plano criado com sucesso!');
      setShowForm(false);
      setFormData({
        nome: '',
        tipo_usuario: 'parceiro',
        preco_por_unidade: '',
        descricao: '',
        features: ''
      });
      fetchPlanos();
    } catch (error) {
      alert(error.response?.data?.detail || 'Erro ao criar plano');
    }
  };

  const handleUpdatePreco = async (planoId, novoPreco) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/planos/${planoId}`,
        { preco_por_unidade: parseFloat(novoPreco) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Preço atualizado com sucesso!');
      setEditingPlano(null);
      fetchPlanos();
    } catch (error) {
      alert('Erro ao atualizar preço');
    }
  };

  if (loading) return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestão de Planos</h1>
          <div className="space-x-2">
            {planos.length === 0 && (
              <Button onClick={handleSeedPlanos} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Criar Planos Padrão
              </Button>
            )}
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </div>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Plano</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePlano} className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome do Plano</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_usuario">Tipo de Usuário</Label>
                  <select
                    id="tipo_usuario"
                    value={formData.tipo_usuario}
                    onChange={(e) => setFormData({ ...formData, tipo_usuario: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="parceiro">Parceiro</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="preco">Preço por Unidade (€)</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={formData.preco_por_unidade}
                    onChange={(e) => setFormData({ ...formData, preco_por_unidade: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full p-2 border rounded-md"
                    rows="3"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="features">Features (separadas por vírgula)</Label>
                  <Input
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    placeholder="relatorios, pagamentos, seguros"
                    required
                  />
                </div>

                <div className="flex space-x-2">
                  <Button type="submit">Criar Plano</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {planos.map((plano) => (
            <Card key={plano.id} className={!plano.ativo ? 'opacity-50' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plano.nome}</span>
                  <span className={`text-sm px-2 py-1 rounded ${
                    plano.tipo_usuario === 'parceiro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {plano.tipo_usuario}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">{plano.descricao}</p>

                <div className="flex items-center justify-between">
                  {editingPlano === plano.id ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={plano.preco_por_unidade}
                        id={`preco-${plano.id}`}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const novoPreco = document.getElementById(`preco-${plano.id}`).value;
                          handleUpdatePreco(plano.id, novoPreco);
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-2xl font-bold">€{plano.preco_por_unidade}</span>
                        <span className="text-sm text-slate-500">
                          / {plano.tipo_usuario === 'parceiro' ? 'veículo' : 'motorista'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlano(plano.id)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {plano.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  {plano.ativo ? '✓ Ativo' : '✗ Inativo'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Planos;
