import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, ArrowLeft, Shield, Wrench, Calculator, Scale, MessageCircle, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

const servicosData = {
  seguros: {
    titulo: 'Seguros TVDE',
    descricao: 'Seguros específicos para motoristas TVDE com as melhores condições do mercado',
    icon: Shield,
    cor: 'blue',
    imagem: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=800',
    features: [
      'Seguros específicos para TVDE',
      'Coberturas completas',
      'Preços competitivos',
      'Assistência 24/7',
      'Parceiros certificados'
    ]
  },
  mecanica: {
    titulo: 'Mecânicos & Bate-Chapas',
    descricao: 'Oficinas especializadas com preços especiais para motoristas TVDE',
    icon: Wrench,
    cor: 'orange',
    imagem: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?q=80&w=800',
    features: [
      'Manutenção preventiva',
      'Reparações de chapa',
      'Preços especiais TVDE',
      'Orçamentos gratuitos',
      'Garantia de serviço'
    ]
  },
  contabilidade: {
    titulo: 'Contabilistas & Advogados',
    descricao: 'Apoio fiscal e jurídico especializado em atividade TVDE',
    icon: Calculator,
    cor: 'green',
    imagem: 'https://images.unsplash.com/photo-1556745753-b2904692b3cd?q=80&w=800',
    features: [
      'Contabilidade para TVDE',
      'Declarações fiscais',
      'Apoio jurídico',
      'Consultoria especializada',
      'Abertura de atividade'
    ]
  },
  consultoria: {
    titulo: 'Consultoria TVDE',
    descricao: 'Consultoria especializada para maximizar os seus ganhos',
    icon: MessageCircle,
    cor: 'purple',
    imagem: 'https://images.unsplash.com/photo-1556745753-b2904692b3cd?q=80&w=800',
    features: [
      'Otimização de rotas',
      'Gestão de tempo',
      'Estratégias de rendimento',
      'Formação contínua',
      'Suporte personalizado'
    ]
  }
};

const ServicosPublico = () => {
  const navigate = useNavigate();
  const { servico } = useParams();
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    servico: servico || 'geral',
    mensagem: ''
  });
  const [sending, setSending] = useState(false);

  const handleSubmitContact = async (e) => {
    e.preventDefault();
    try {
      setSending(true);
      await axios.post(`${API}/public/contacto`, {
        ...contactForm,
        assunto: `Interesse em Serviço - ${contactForm.servico}`
      });
      toast.success('Mensagem enviada com sucesso! Entraremos em contacto em breve.');
      setShowContactForm(false);
      setContactForm({ nome: '', email: '', telefone: '', servico: servico || 'geral', mensagem: '' });
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const servicoEspecifico = servico ? servicosData[servico] : null;

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
        {servicoEspecifico ? (
          // Página de Serviço Específico
          <>
            <div className="mb-8">
              <Button variant="ghost" onClick={() => navigate('/servicos')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ver Todos os Serviços
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <img
                  src={servicoEspecifico.imagem}
                  alt={servicoEspecifico.titulo}
                  className="w-full h-96 object-cover rounded-2xl shadow-xl"
                />
              </div>
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 mb-4">{servicoEspecifico.titulo}</h1>
                  <p className="text-xl text-slate-600">{servicoEspecifico.descricao}</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>O Que Oferecemos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {servicoEspecifico.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full bg-${servicoEspecifico.cor}-600`}></div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Button
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowContactForm(true)}
                >
                  Solicitar Contacto
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Listagem de Todos os Serviços
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-slate-900 mb-4">Serviços Especializados</h1>
              <p className="text-xl text-slate-600">Parceiros de confiança para o seu sucesso como motorista TVDE</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {Object.entries(servicosData).map(([key, servico]) => (
                <Card key={key} className="hover:shadow-xl transition cursor-pointer" onClick={() => navigate(`/servicos/${key}`)}>
                  <img
                    src={servico.imagem}
                    alt={servico.titulo}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <servico.icon className={`w-6 h-6 text-${servico.cor}-600`} />
                      <span>{servico.titulo}</span>
                    </CardTitle>
                    <CardDescription>{servico.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      Saber Mais
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Solicitar Contacto</CardTitle>
              <CardDescription>
                Preencha o formulário e entraremos em contacto em breve
              </CardDescription>
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
                    rows="4"
                    value={contactForm.mensagem}
                    onChange={(e) => setContactForm({ ...contactForm, mensagem: e.target.value })}
                    placeholder="Descreva o que precisa..."
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

export default ServicosPublico;