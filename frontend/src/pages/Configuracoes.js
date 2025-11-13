import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Euro, Plus, Edit2, Check, X, Mail } from 'lucide-react';

// Lista de features disponíveis
const AVAILABLE_FEATURES = {
  parceiro: [
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'pagamentos', label: 'Gestão de Pagamentos' },
    { id: 'seguros', label: 'Gestão de Seguros' },
    { id: 'manutencoes', label: 'Gestão de Manutenções' },
    { id: 'contas', label: 'Gestão de Contas' },
    { id: 'contratos', label: 'Emissão de Contratos' }
  ],
  operacional: [
    { id: 'upload_csv_ganhos', label: 'Upload CSV Ganhos (Uber/Bolt)' },
    { id: 'combustivel_manual', label: 'Inserção Manual Combustível' },
    { id: 'viaverde_manual', label: 'Inserção Manual Via Verde' },
    { id: 'upload_csv_km', label: 'Upload CSV de KM' },
    { id: 'gestao_veiculos', label: 'Gestão de Veículos' },
    { id: 'gestao_manutencoes', label: 'Gestão de Manutenções' },
    { id: 'gestao_seguros', label: 'Gestão de Seguros' },
    { id: 'integracoes_fornecedores', label: 'Integrações Automáticas Fornecedores' }
  ]
};

const Configuracoes = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('planos');
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlano, setEditingPlano] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo_usuario: 'parceiro',
    preco_por_unidade: '',
    descricao: '',
    features: []
  });
  const [emailConfig, setEmailConfig] = useState({
    email_contacto: 'info@tvdefleet.com',
    telefone_contacto: '',
    morada_empresa: 'Lisboa, Portugal',
    nome_empresa: 'TVDEFleet'
  });
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (activeTab === 'planos') {
      fetchPlanos();
    } else if (activeTab === 'email') {
      fetchEmailConfig();
    }
  }, [activeTab]);

  const fetchEmailConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/configuracoes/email`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setEmailConfig(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de email:', error);
    }
  };

  const handleSaveEmailConfig = async () => {
    try {
      setSavingEmail(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/configuracoes/email`, emailConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Configurações guardadas com sucesso!');
    } catch (error) {
      alert('Erro ao guardar configurações');
    } finally {
      setSavingEmail(false);
    }
  };

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

  const handleFeatureToggle = (featureId) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(f => f !== featureId)
        : [...prev.features, featureId]
    }));
  };

  const handleCreatePlano = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        preco_por_unidade: parseFloat(formData.preco_por_unidade)
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
        features: []
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

  const renderPlanos = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestão de Planos de Assinatura</h2>
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
                  placeholder="Ex: Parceiro Premium"
                  required
                />
              </div>

              <div>
                <Label htmlFor="tipo_usuario">Tipo de Usuário</Label>
                <select
                  id="tipo_usuario"
                  value={formData.tipo_usuario}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      tipo_usuario: e.target.value,
                      features: [] // Reset features on type change
                    });
                  }}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="parceiro">Parceiro (cobrança por veículo)</option>
                  <option value="operacional">Operacional (cobrança por motorista)</option>
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
                  placeholder="50.00"
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
                  placeholder="Descreva as funcionalidades do plano..."
                  required
                />
              </div>

              <div>
                <Label className="mb-2 block">Features Incluídas</Label>
                <div className="grid grid-cols-2 gap-2 p-4 border rounded-md bg-slate-50">
                  {AVAILABLE_FEATURES[formData.tipo_usuario].map((feature) => (
                    <label
                      key={feature.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feature.id)}
                        onChange={() => handleFeatureToggle(feature.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{feature.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formData.features.length} feature(s) selecionada(s)
                </p>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPlano(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold">{plano.preco_por_unidade}€</span>
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
                      {feature.replace(/_/g, ' ')}
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
  );

  const renderEmailConfig = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configurações de Contacto</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Email e Contactos Públicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email_contacto">Email de Contacto *</Label>
            <Input
              id="email_contacto"
              type="email"
              value={emailConfig.email_contacto}
              onChange={(e) => setEmailConfig({ ...emailConfig, email_contacto: e.target.value })}
              placeholder="info@tvdefleet.com"
            />
            <p className="text-xs text-slate-500 mt-1">
              Formulários do website serão enviados para este email
            </p>
          </div>

          <div>
            <Label htmlFor="telefone_contacto">Telefone de Contacto</Label>
            <Input
              id="telefone_contacto"
              type="tel"
              value={emailConfig.telefone_contacto}
              onChange={(e) => setEmailConfig({ ...emailConfig, telefone_contacto: e.target.value })}
              placeholder="+351 XXX XXX XXX"
            />
          </div>

          <div>
            <Label htmlFor="nome_empresa">Nome da Empresa</Label>
            <Input
              id="nome_empresa"
              value={emailConfig.nome_empresa}
              onChange={(e) => setEmailConfig({ ...emailConfig, nome_empresa: e.target.value })}
              placeholder="TVDEFleet"
            />
          </div>

          <div>
            <Label htmlFor="morada_empresa">Morada da Empresa</Label>
            <Input
              id="morada_empresa"
              value={emailConfig.morada_empresa}
              onChange={(e) => setEmailConfig({ ...emailConfig, morada_empresa: e.target.value })}
              placeholder="Lisboa, Portugal"
            />
          </div>

          <Button
            onClick={handleSaveEmailConfig}
            disabled={savingEmail}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {savingEmail ? 'A guardar...' : 'Guardar Configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderOutrasConfiguracoes = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Outras Configurações</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">
            Configurações adicionais serão adicionadas aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Settings className="w-8 h-8 text-slate-700" />
          <h1 className="text-3xl font-bold">Configurações</h1>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b">
          <button
            onClick={() => setActiveTab('planos')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'planos'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Euro className="w-4 h-4 inline mr-2" />
            Planos de Assinatura
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'email'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Email & Contactos
          </button>
          <button
            onClick={() => setActiveTab('outras')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'outras'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Outras Configurações
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'planos' && renderPlanos()}
          {activeTab === 'email' && renderEmailConfig()}
          {activeTab === 'outras' && renderOutrasConfiguracoes()}
        </div>
      </div>
    </Layout>
  );
};

export default Configuracoes;
