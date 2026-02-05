import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Settings, Check, X, RefreshCw,
  Play, Clock, Users, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GestaoPlataformasRPA() {
  const navigate = useNavigate();
  const [plataformas, setPlataformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    url_base: '',
    icone: '🔗',
    descricao: '',
    suporta_semanas: true,
    max_semanas: 4,
    campos_credenciais: ['email', 'password'],
    tipo_ficheiro: 'csv'
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    carregarPlataformas();
  }, []);

  const carregarPlataformas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/plataformas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPlataformas(data);
    } catch (error) {
      toast.error('Erro ao carregar plataformas');
    } finally {
      setLoading(false);
    }
  };

  const criarPlataformasPredefinidas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/seed-plataformas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(`${data.plataformas_criadas} plataformas criadas!`);
      carregarPlataformas();
    } catch (error) {
      toast.error('Erro ao criar plataformas');
    }
  };

  const abrirModal = (plataforma = null) => {
    if (plataforma) {
      setEditando(plataforma);
      setFormData({
        nome: plataforma.nome,
        url_base: plataforma.url_base,
        icone: plataforma.icone || '🔗',
        descricao: plataforma.descricao || '',
        suporta_semanas: plataforma.suporta_semanas ?? true,
        max_semanas: plataforma.max_semanas || 4,
        campos_credenciais: plataforma.campos_credenciais || ['email', 'password'],
        tipo_ficheiro: plataforma.tipo_ficheiro || 'csv'
      });
    } else {
      setEditando(null);
      setFormData({
        nome: '',
        url_base: '',
        icone: '🔗',
        descricao: '',
        suporta_semanas: true,
        max_semanas: 4,
        campos_credenciais: ['email', 'password'],
        tipo_ficheiro: 'csv'
      });
    }
    setShowModal(true);
  };

  const guardarPlataforma = async () => {
    if (!formData.nome || !formData.url_base) {
      toast.error('Preencha o nome e URL');
      return;
    }

    try {
      const url = editando
        ? `${API_URL}/api/rpa-designer/plataformas/${editando.id}`
        : `${API_URL}/api/rpa-designer/plataformas`;

      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.sucesso || data.plataforma_id) {
        toast.success(editando ? 'Plataforma atualizada!' : 'Plataforma criada!');
        setShowModal(false);
        carregarPlataformas();
      } else {
        toast.error(data.detail || 'Erro ao guardar');
      }
    } catch (error) {
      toast.error('Erro ao guardar plataforma');
    }
  };

  const eliminarPlataforma = async (id) => {
    if (!window.confirm('Tem certeza que deseja desativar esta plataforma?')) return;

    try {
      await fetch(`${API_URL}/api/rpa-designer/plataformas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Plataforma desativada');
      carregarPlataformas();
    } catch (error) {
      toast.error('Erro ao desativar plataforma');
    }
  };

  const toggleCampoCredencial = (campo) => {
    const campos = formData.campos_credenciais.includes(campo)
      ? formData.campos_credenciais.filter(c => c !== campo)
      : [...formData.campos_credenciais, campo];
    setFormData({ ...formData, campos_credenciais: campos });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📋 Gestão de Plataformas RPA</h1>
            <p className="text-gray-400">Configure as plataformas disponíveis para automação</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/rpa-designer')}>
              🎨 RPA Designer
            </Button>
            <Button onClick={() => abrirModal()}>
              <Plus className="w-4 h-4 mr-2" /> Nova Plataforma
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-white">{plataformas.length}</div>
              <div className="text-gray-300 text-sm">Plataformas</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-400">
                {plataformas.filter(p => p.designs_completos).length}
              </div>
              <div className="text-gray-300 text-sm">Com Designs Completos</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-400">
                {plataformas.filter(p => !p.designs_completos && p.designs_count > 0).length}
              </div>
              <div className="text-gray-300 text-sm">Em Progresso</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-400">
                {plataformas.filter(p => p.designs_count === 0).length}
              </div>
              <div className="text-gray-300 text-sm">Sem Designs</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Plataformas */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-500" />
          </div>
        ) : plataformas.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-12 text-center">
              <Settings className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma plataforma configurada</h3>
              <p className="text-gray-400 mb-4">
                Crie plataformas predefinidas ou adicione uma nova manualmente
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={criarPlataformasPredefinidas}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Criar Predefinidas
                </Button>
                <Button variant="outline" onClick={() => abrirModal()}>
                  <Plus className="w-4 h-4 mr-2" /> Criar Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {plataformas.map(plat => (
              <Card 
                key={plat.id} 
                className={`bg-gray-800 border-gray-700 ${!plat.ativo ? 'opacity-50' : ''}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{plat.icone}</div>
                      <div>
                        <h3 className="font-bold text-lg text-white">{plat.nome}</h3>
                        <p className="text-blue-300 text-sm">{plat.url_base}</p>
                        {plat.descricao && (
                          <p className="text-gray-300 text-xs mt-1">{plat.descricao}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Estado dos Designs */}
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2, 3].map(i => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${
                                i < plat.designs_count
                                  ? 'bg-green-500'
                                  : 'bg-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">
                          {plat.designs_count}/{plat.max_semanas} designs
                        </span>
                      </div>

                      {/* Estatísticas */}
                      <div className="text-center">
                        <div className="text-lg font-bold">{plat.total_execucoes || 0}</div>
                        <span className="text-xs text-gray-400">execuções</span>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/rpa-designer?plataforma=${plat.id}`)}
                        >
                          <Play className="w-4 h-4 mr-1" /> Designer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModal(plat)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => eliminarPlataforma(plat.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Criar/Editar */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">
                {editando ? 'Editar Plataforma' : 'Nova Plataforma'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-sm text-gray-400">Ícone</label>
                    <Input
                      value={formData.icone}
                      onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-center text-2xl"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-sm text-gray-400">Nome</label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Uber Fleet"
                      className="bg-gray-700 border-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">URL Base</label>
                  <Input
                    value={formData.url_base}
                    onChange={(e) => setFormData({ ...formData, url_base: e.target.value })}
                    placeholder="https://..."
                    className="bg-gray-700 border-gray-600"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">Descrição</label>
                  <Input
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição da plataforma..."
                    className="bg-gray-700 border-gray-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Máximo de Semanas</label>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={formData.max_semanas}
                      onChange={(e) => setFormData({ ...formData, max_semanas: parseInt(e.target.value) })}
                      className="bg-gray-700 border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Tipo de Ficheiro</label>
                    <select
                      value={formData.tipo_ficheiro}
                      onChange={(e) => setFormData({ ...formData, tipo_ficheiro: e.target.value })}
                      className="w-full bg-gray-700 border-gray-600 rounded p-2"
                    >
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel (XLSX)</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Campos de Credenciais</label>
                  <div className="flex flex-wrap gap-2">
                    {['email', 'password', 'telefone', 'username', 'api_key'].map(campo => (
                      <button
                        key={campo}
                        onClick={() => toggleCampoCredencial(campo)}
                        className={`px-3 py-1 rounded text-sm ${
                          formData.campos_credenciais.includes(campo)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {campo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="suporta_semanas"
                    checked={formData.suporta_semanas}
                    onChange={(e) => setFormData({ ...formData, suporta_semanas: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="suporta_semanas" className="text-sm">
                    Suporta múltiplas semanas (designs separados por semana)
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={guardarPlataforma}
                >
                  {editando ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
