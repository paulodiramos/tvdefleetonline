import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, ArrowLeft, Filter, Euro, Calendar, Fuel, Users, Mail, Phone, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

// Helper para construir URL de fotos
const getPhotoUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  if (photoPath.startsWith('/uploads/')) {
    return `${API.replace('/api', '')}/api${photoPath}`;
  }
  if (photoPath.startsWith('/api/')) {
    return `${API.replace('/api', '')}${photoPath}`;
  }
  if (photoPath.startsWith('uploads/')) {
    return `${API.replace('/api', '')}/api/${photoPath}`;
  }
  return `${API.replace('/api', '')}/api/uploads/${photoPath}`;
};

// Helper para obter todas as fotos válidas (imagens, não PDF)
const getValidPhotos = (fotos) => {
  if (!fotos || fotos.length === 0) return [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const validPhotos = [];
  
  for (const foto of fotos) {
    const lowerFoto = foto.toLowerCase();
    if (imageExtensions.some(ext => lowerFoto.endsWith(ext))) {
      validPhotos.push(getPhotoUrl(foto));
    }
  }
  
  return validPhotos;
};

// Componente de Carrossel de Fotos
const PhotoCarousel = ({ photos, altText }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!photos || photos.length === 0) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-lg flex items-center justify-center">
        <Car className="w-20 h-20 text-slate-400" />
      </div>
    );
  }
  
  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };
  
  const goToPrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };
  
  return (
    <div className="relative w-full h-48 group">
      <img
        src={photos[currentIndex]}
        alt={`${altText} - Foto ${currentIndex + 1}`}
        className="w-full h-48 object-cover rounded-t-lg"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '';
          e.target.parentElement.innerHTML = '<div class="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-lg flex items-center justify-center"><svg class="w-20 h-20 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/></svg></div>';
        }}
      />
      
      {/* Controlos do carrossel - só mostrar se houver mais de 1 foto */}
      {photos.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="carousel-prev"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="carousel-next"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
          
          {/* Indicadores de posição */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
          
          {/* Contador */}
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {currentIndex + 1}/{photos.length}
          </div>
        </>
      )}
    </div>
  );
};

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
              <Car className="w-8 h-8 text-blue-600" />
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Car className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Nenhum veículo disponível com estes filtros</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {veiculosFiltrados.map((veiculo) => {
              const photos = getValidPhotos(veiculo.fotos_veiculo || veiculo.fotos);
              return (
              <Card key={veiculo.id} className="hover:shadow-xl transition" data-testid={`veiculo-card-${veiculo.id}`}>
                {/* Carrossel de Fotos */}
                <PhotoCarousel 
                  photos={photos} 
                  altText={`${veiculo.marca} ${veiculo.modelo}`} 
                />
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{veiculo.marca} {veiculo.modelo}</CardTitle>
                  <p className="text-sm text-slate-600">
                    {veiculo.ano} • {veiculo.matricula}
                    {veiculo.versao && <span className="ml-1">• {veiculo.versao}</span>}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Características do veículo */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <div className="flex items-center space-x-1">
                      <Fuel className="w-4 h-4" />
                      <span>{veiculo.combustivel}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{veiculo.lugares} lug.</span>
                    </div>
                    {veiculo.caixa && (
                      <div className="flex items-center space-x-1">
                        <Settings2 className="w-4 h-4" />
                        <span>{veiculo.caixa === 'automatica' || veiculo.caixa === 'Automática' ? 'Auto' : 'Manual'}</span>
                      </div>
                    )}
                  </div>

                  {/* Badge para veículo disponível sem motorista */}
                  {veiculo.disponivel_sem_motorista && (
                    <div className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      Disponível para Aluguer
                    </div>
                  )}

                  {veiculo.descricao_marketplace && (
                    <p className="text-sm text-slate-600 line-clamp-2">{veiculo.descricao_marketplace}</p>
                  )}

                  {/* Condições do Contrato */}
                  {veiculo.condicoes_resumo && (
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                      <p className="font-semibold text-slate-700">Condições:</p>
                      {veiculo.condicoes_resumo.valor_semanal && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Valor Semanal:</span>
                          <span className="font-bold text-blue-600">{veiculo.condicoes_resumo.valor_semanal}€</span>
                        </div>
                      )}
                      {veiculo.condicoes_resumo.valor_caucao > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Caução:</span>
                          <span className="font-medium">{veiculo.condicoes_resumo.valor_caucao}€</span>
                        </div>
                      )}
                      {veiculo.condicoes_resumo.km_incluidos && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">KM Incluídos/Mês:</span>
                          <span className="font-medium">{veiculo.condicoes_resumo.km_incluidos} km</span>
                        </div>
                      )}
                      {veiculo.condicoes_resumo.tem_garantia && (
                        <div className="text-green-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Garantia até {new Date(veiculo.condicoes_resumo.data_limite_garantia).toLocaleDateString('pt-PT')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    {veiculo.disponivel_venda && veiculo.preco_venda && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Venda:</span>
                        <span className="text-xl font-bold text-blue-600">
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
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleInteresse(veiculo)}
                  >
                    Tenho Interesse
                  </Button>
                </CardContent>
              </Card>
              );
            })}
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
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
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