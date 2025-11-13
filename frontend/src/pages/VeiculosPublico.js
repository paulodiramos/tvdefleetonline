import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, ArrowLeft, Filter, Euro, Calendar, Fuel, Users, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

const VeiculosPublico = () => {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    tipo: 'todos', // todos, venda, aluguer
    marca: '',
    precoMax: ''
  });
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    mensagem: ''
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchVeiculos();
  }, []);

  const fetchVeiculos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/public/veiculos`);
      setVeiculos(response.data);
    } catch (error) {
      console.error('Erro ao carregar veículos:', error);
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  };

  const handleInteresse = (veiculo) => {
    setSelectedVeiculo(veiculo);
    setContactForm({
      ...contactForm,
      mensagem: `Tenho interesse no veículo ${veiculo.marca} ${veiculo.modelo} - ${veiculo.matricula}`
    });
    setShowContactForm(true);
  };

  const handleSubmitContact = async (e) => {
    e.preventDefault();
    try {
      setSending(true);
      await axios.post(`${API}/public/contacto`, {
        ...contactForm,
        assunto: `Interesse em Veículo - ${selectedVeiculo.marca} ${selectedVeiculo.modelo}`,
        veiculo_id: selectedVeiculo.id
      });
      toast.success('Mensagem enviada com sucesso! Entraremos em contacto em breve.');
      setShowContactForm(false);
      setContactForm({ nome: '', email: '', telefone: '', mensagem: '' });
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const veiculosFiltrados = veiculos.filter(v => {
    if (filtros.tipo === 'venda' && !v.disponivel_venda) return false;
    if (filtros.tipo === 'aluguer' && !v.disponivel_aluguer) return false;
    if (filtros.marca && !v.marca.toLowerCase().includes(filtros.marca.toLowerCase())) return false;
    if (filtros.precoMax) {
      const preco = v.disponivel_venda ? v.preco_venda : v.preco_aluguer_mensal;
      if (preco > parseFloat(filtros.precoMax)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-emerald-600" />
              <span className="text-2xl font-bold text-slate-800">TVDEFleet</span>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => navigate('/login')}>Entrar</Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Veículos Disponíveis</h1>
          <p className="text-xl text-slate-600">Encontre o carro perfeito para trabalhar como motorista TVDE</p>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                >
                  <option value="todos">Todos</option>
                  <option value="venda">Venda</option>
                  <option value="aluguer">Aluguer</option>
                </select>
              </div>
              <div>
                <Label>Marca</Label>
                <Input
                  placeholder="Ex: Mercedes, BMW..."
                  value={filtros.marca}
                  onChange={(e) => setFiltros({ ...filtros, marca: e.target.value })}
                />
              </div>
              <div>
                <Label>Preço Máximo (€)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 30000"
                  value={filtros.precoMax}
                  onChange={(e) => setFiltros({ ...filtros, precoMax: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listagem */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Car className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Nenhum veículo disponível com estes filtros</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {veiculosFiltrados.map((veiculo) => (
              <Card key={veiculo.id} className="hover:shadow-xl transition">
                {veiculo.fotos_veiculo && veiculo.fotos_veiculo.length > 0 ? (
                  <img
                    src={veiculo.fotos_veiculo[0]}
                    alt={`${veiculo.marca} ${veiculo.modelo}`}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-lg flex items-center justify-center">
                    <Car className="w-20 h-20 text-slate-400" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{veiculo.marca} {veiculo.modelo}</CardTitle>
                  <p className="text-sm text-slate-600">{veiculo.ano} • {veiculo.matricula}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-4 text-sm text-slate-600">
                    <div className="flex items-center space-x-1">
                      <Fuel className="w-4 h-4" />
                      <span>{veiculo.combustivel}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{veiculo.lugares} lugares</span>
                    </div>
                  </div>

                  {veiculo.descricao_marketplace && (
                    <p className="text-sm text-slate-600">{veiculo.descricao_marketplace}</p>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    {veiculo.disponivel_venda && veiculo.preco_venda && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Venda:</span>
                        <span className="text-xl font-bold text-emerald-600">
                          {veiculo.preco_venda.toLocaleString('pt-PT')}€
                        </span>
                      </div>
                    )}
                    {veiculo.disponivel_aluguer && veiculo.preco_aluguer_mensal && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Aluguer/mês:</span>
                        <span className="text-xl font-bold text-blue-600">
                          {veiculo.preco_aluguer_mensal.toLocaleString('pt-PT')}€
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleInteresse(veiculo)}
                  >
                    Tenho Interesse
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Demonstrar Interesse</CardTitle>
              <p className="text-sm text-slate-600">
                {selectedVeiculo.marca} {selectedVeiculo.modelo} - {selectedVeiculo.matricula}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitContact} className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={contactForm.nome}
                    onChange={(e) => setContactForm({ ...contactForm, nome: e.target.value })}
                    required
                    placeholder="O seu nome"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                    placeholder="seuemail@exemplo.com"
                  />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input
                    type="tel"
                    value={contactForm.telefone}
                    onChange={(e) => setContactForm({ ...contactForm, telefone: e.target.value })}
                    required
                    placeholder="+351 912345678"
                  />
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows="3"
                    value={contactForm.mensagem}
                    onChange={(e) => setContactForm({ ...contactForm, mensagem: e.target.value })}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowContactForm(false)}
                    disabled={sending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={sending}
                  >
                    {sending ? 'A enviar...' : 'Enviar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VeiculosPublico;