import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Car, Users, Shield, TrendingUp, Phone, Mail, MapPin, 
  ArrowRight, CheckCircle, Clock, Award, Wrench, FileText,
  Scale, Calculator, MessageCircle, Building
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PublicHome = () => {
  const navigate = useNavigate();
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    email_contacto: 'info@tvdefleet.com',
    telefone_contacto: '+351 912 345 678',
    morada_empresa: 'Lisboa, Portugal',
    nome_empresa: 'TVDEFleet'
  });

  // Carregar informações de contacto do backend
  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/public/contacto`);
        if (response.data) {
          setContactInfo(response.data);
        }
      } catch (error) {
        console.log('Usando configurações de contacto padrão');
      }
    };
    fetchContactInfo();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-800">TVDEFleet</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#servicos" className="text-slate-600 hover:text-blue-600 transition">Serviços</a>
              <a href="#veiculos" className="text-slate-600 hover:text-blue-600 transition">Veículos</a>
              <a href="#parceiros" className="text-slate-600 hover:text-blue-600 transition">Parceiros</a>
              <a href="#contacto" className="text-slate-600 hover:text-blue-600 transition">Contacto</a>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => navigate('/login')}>
                Entrar
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowRegistroModal(true)}>
                Registar
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl font-bold text-slate-900 leading-tight">
                A Sua Plataforma Completa para <span className="text-blue-600">TVDE</span>
              </h1>
              <p className="text-xl text-slate-600">
                Gestão profissional de frota, veículos disponíveis e serviços especializados para motoristas TVDE em Portugal.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-lg px-8"
                  onClick={() => navigate('/registo-motorista')}
                >
                  Tornar-se Motorista
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8"
                  onClick={() => setShowRegistroModal(true)}
                >
                  Registar Empresa
                </Button>
              </div>
              <div className="flex items-center space-x-6 pt-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-slate-700">+500 Motoristas</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-slate-700">+200 Veículos</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1644112865520-c91bb4c018ed?q=80&w=1200" 
                alt="Motorista TVDE Profissional"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Gestão de Frotas - Destaque */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600 mb-4">
              <Building className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Gestão de Frotas Profissional</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Plataforma completa para empresas TVDE gerenciarem toda a operação: veículos, motoristas, finanças e mais
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="hover:shadow-xl transition">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Gestão de Veículos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Controlo de manutenção e revisões</li>
                  <li>• Gestão de seguros e inspeções</li>
                  <li>• Histórico completo de cada veículo</li>
                  <li>• Alertas automáticos de vencimentos</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Gestão de Motoristas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Cadastro completo com documentos</li>
                  <li>• Atribuição de veículos</li>
                  <li>• Controlo de pagamentos e rendimentos</li>
                  <li>• Histórico de atividade</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Controlo Financeiro</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Dashboard com estatísticas em tempo real</li>
                  <li>• Gestão de pagamentos e recibos</li>
                  <li>• Relatórios detalhados</li>
                  <li>• Integração com parceiros</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="mb-6 md:mb-0 md:mr-8">
                  <h3 className="text-2xl font-bold mb-2">🎯 Serviços Especiais para Parceiros</h3>
                  <p className="text-purple-100 mb-4">
                    Acesso exclusivo a serviços especializados com condições preferenciais
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>Seguros com descontos</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Wrench className="w-5 h-5" />
                      <span>Mecânica especializada</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calculator className="w-5 h-5" />
                      <span>Contabilidade TVDE</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-5 h-5" />
                      <span>Consultoria dedicada</span>
                    </div>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className="bg-white text-purple-600 hover:bg-purple-50"
                  onClick={() => setShowRegistroModal(true)}
                >
                  Começar Agora
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Como Funciona</h2>
            <p className="text-xl text-slate-600">Simples, rápido e profissional</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle>1. Registe-se</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Crie a sua conta como motorista ou parceiro. Processo rápido e simples.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle>2. Aprovação</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Nossa equipa verifica os seus documentos e aprova em 24-48h.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition">
              <CardHeader>
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle>3. Comece a Trabalhar</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Acesso completo à plataforma, veículos e serviços especializados.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Serviços em Destaque */}
      <section id="servicos" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Serviços Especializados</h2>
            <p className="text-xl text-slate-600">Parceiros de confiança para o seu sucesso</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Seguros */}
            <Card className="hover:shadow-xl transition cursor-pointer" onClick={() => navigate('/servicos/seguros')}>
              <CardHeader>
                <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-20 h-20 text-blue-600" />
                </div>
                <CardTitle className="text-blue-600">Seguros Mais Baratos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  Seguros específicos para TVDE com as melhores condições do mercado.
                </CardDescription>
                <Button variant="link" className="text-blue-600 p-0">
                  Saber mais <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Mecânicos */}
            <Card className="hover:shadow-xl transition cursor-pointer" onClick={() => navigate('/servicos/mecanica')}>
              <CardHeader>
                <img 
                  src="https://images.unsplash.com/photo-1645445522156-9ac06bc7a767?q=80&w=600" 
                  alt="Mecânica"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <CardTitle className="text-blue-600">Mecânicos & Bate-Chapas</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  Oficinas especializadas com preços especiais para motoristas TVDE.
                </CardDescription>
                <Button variant="link" className="text-blue-600 p-0">
                  Saber mais <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Contabilidade */}
            <Card className="hover:shadow-xl transition cursor-pointer" onClick={() => navigate('/servicos/contabilidade')}>
              <CardHeader>
                <img 
                  src="https://images.unsplash.com/photo-1556745753-b2904692b3cd?q=80&w=600" 
                  alt="Contabilidade"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <CardTitle className="text-blue-600">Contabilistas & Advogados</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  Apoio fiscal e jurídico especializado em atividade TVDE.
                </CardDescription>
                <Button variant="link" className="text-blue-600 p-0">
                  Saber mais <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button size="lg" variant="outline" onClick={() => navigate('/servicos')}>
              Ver Todos os Serviços
            </Button>
          </div>
        </div>
      </section>

      {/* Veículos Disponíveis */}
      <section id="veiculos" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Veículos Disponíveis</h2>
            <p className="text-xl text-slate-600">Encontre o carro perfeito para trabalhar</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="overflow-hidden hover:shadow-xl transition">
              <img 
                src="https://images.unsplash.com/photo-1616932321030-16411c3a6489?q=80&w=800" 
                alt="Carro TVDE"
                className="w-full h-64 object-cover"
              />
              <CardHeader>
                <CardTitle>Venda & Aluguer</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Veículos certificados e prontos para TVDE. Opções flexíveis de compra e aluguer.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-xl transition">
              <img 
                src="https://images.unsplash.com/photo-1504366130991-154787072d46?q=80&w=800" 
                alt="Carro TVDE"
                className="w-full h-64 object-cover"
              />
              <CardHeader>
                <CardTitle>Totalmente Equipados</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Todos os veículos vêm com documentação em dia e prontos para trabalhar.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/veiculos')}>
              Ver Veículos Disponíveis
            </Button>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Entre em Contacto</h2>
            <p className="text-xl text-slate-600">Estamos aqui para ajudar</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card 
              className="text-center hover:shadow-lg transition cursor-pointer" 
              onClick={() => {
                const phone = contactInfo.telefone_contacto?.replace(/\s/g, '').replace('+', '');
                window.open(`https://wa.me/${phone}`, '_blank');
              }}
            >
              <CardHeader>
                <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Telefone / WhatsApp</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-600 font-semibold hover:underline">{contactInfo.telefone_contacto}</p>
                <p className="text-xs text-slate-500 mt-2">Clique para abrir WhatsApp</p>
              </CardContent>
            </Card>

            <Card 
              className="text-center hover:shadow-lg transition cursor-pointer" 
              onClick={() => window.location.href = `mailto:${contactInfo.email_contacto}`}
            >
              <CardHeader>
                <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-600 font-semibold hover:underline">{contactInfo.email_contacto}</p>
                <p className="text-xs text-slate-500 mt-2">Clique para enviar email</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Localização</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Lisboa, Portugal</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modal de Seleção de Registo */}
      {showRegistroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Como deseja registar-se?</CardTitle>
              <CardDescription className="text-center">
                Escolha o tipo de registo adequado ao seu perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Gestão de Frota */}
                <Card 
                  className="cursor-pointer hover:shadow-xl hover:border-purple-500 transition border-2 border-purple-200"
                  onClick={() => {
                    setShowRegistroModal(false);
                    navigate('/registo-parceiro?tipo=gestao_frota');
                  }}
                >
                  <CardHeader className="text-center">
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">Popular</span>
                    </div>
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Car className="w-10 h-10 text-purple-600" />
                    </div>
                    <CardTitle className="text-lg">Gerir Frota</CardTitle>
                    <CardDescription>Tenho veículos e motoristas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Gestão completa</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Múltiplos veículos</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Controlo financeiro</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Serviços incluídos</strong></span>
                      </li>
                    </ul>
                    <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-sm">
                      Começar Agora
                    </Button>
                  </CardContent>
                </Card>

                {/* Usar Plataforma */}
                <Card 
                  className="cursor-pointer hover:shadow-xl hover:border-green-500 transition"
                  onClick={() => {
                    setShowRegistroModal(false);
                    navigate('/registo-parceiro?tipo=usar_plataforma');
                  }}
                >
                  <CardHeader className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building className="w-10 h-10 text-green-600" />
                    </div>
                    <CardTitle className="text-lg">Usar Plataforma</CardTitle>
                    <CardDescription>Outros serviços</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Acesso à plataforma</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Serviços parceiros</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Rede TVDE</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Consultoria</span>
                      </li>
                    </ul>
                    <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-sm">
                      Registar
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRegistroModal(false)}
                  className="px-8"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Car className="w-6 h-6 text-blue-400" />
                <span className="text-xl font-bold">TVDEFleet</span>
              </div>
              <p className="text-slate-400">
                Plataforma completa de gestão para motoristas TVDE em Portugal.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Links Rápidos</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#servicos" className="hover:text-blue-400 transition">Serviços</a></li>
                <li><a href="#veiculos" className="hover:text-blue-400 transition">Veículos</a></li>
                <li><a href="/login" className="hover:text-blue-400 transition">Login</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Para Motoristas</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/registo-motorista" className="hover:text-blue-400 transition">Registar</a></li>
                <li><a href="/veiculos" className="hover:text-blue-400 transition">Ver Veículos</a></li>
                <li><a href="/servicos" className="hover:text-blue-400 transition">Serviços</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Para Empresas</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/registo-parceiro" className="hover:text-blue-400 transition">Registar Empresa</a></li>
                <li><a href="#contacto" className="hover:text-blue-400 transition">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-slate-400">
              <p>&copy; 2025 TVDEFleet. Todos os direitos reservados.</p>
              <div className="flex space-x-6 text-sm">
                <button 
                  onClick={() => window.open('/termos', '_blank')}
                  className="hover:text-white transition"
                >
                  Termos e Condições
                </button>
                <span>|</span>
                <button 
                  onClick={() => window.open('/privacidade', '_blank')}
                  className="hover:text-white transition"
                >
                  Política de Privacidade
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHome;
