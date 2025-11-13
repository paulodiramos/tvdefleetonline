import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Car, Users, Shield, TrendingUp, Phone, Mail, MapPin, 
  ArrowRight, CheckCircle, Clock, Award, Wrench, FileText,
  Scale, Calculator, MessageCircle
} from 'lucide-react';

const PublicHome = () => {
  const navigate = useNavigate();

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
              <Button className="bg-blue-600 hover:bg-emerald-700" onClick={() => navigate('/registo-motorista')}>
                Registar
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-50 to-blue-50 py-20">
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
                  onClick={() => navigate('/registo-parceiro')}
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
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
            <Button size="lg" className="bg-blue-600 hover:bg-emerald-700" onClick={() => navigate('/veiculos')}>
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
            <Card className="text-center hover:shadow-lg transition cursor-pointer" onClick={() => window.open('https://wa.me/351912345678', '_blank')}>
              <CardHeader>
                <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Telefone / WhatsApp</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-600 font-semibold hover:underline">+351 912 345 678</p>
                <p className="text-xs text-slate-500 mt-2">Clique para abrir WhatsApp</p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition cursor-pointer" onClick={() => window.location.href = 'mailto:info@tvdefleet.com'}>
              <CardHeader>
                <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-600 font-semibold hover:underline">info@tvdefleet.com</p>
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

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Car className="w-6 h-6 text-emerald-400" />
                <span className="text-xl font-bold">TVDEFleet</span>
              </div>
              <p className="text-slate-400">
                Plataforma completa de gestão para motoristas TVDE em Portugal.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Links Rápidos</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#servicos" className="hover:text-emerald-400 transition">Serviços</a></li>
                <li><a href="#veiculos" className="hover:text-emerald-400 transition">Veículos</a></li>
                <li><a href="/login" className="hover:text-emerald-400 transition">Login</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Para Motoristas</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/registo-motorista" className="hover:text-emerald-400 transition">Registar</a></li>
                <li><a href="/veiculos" className="hover:text-emerald-400 transition">Ver Veículos</a></li>
                <li><a href="/servicos" className="hover:text-emerald-400 transition">Serviços</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Para Empresas</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/registo-parceiro" className="hover:text-emerald-400 transition">Registar Empresa</a></li>
                <li><a href="#contacto" className="hover:text-emerald-400 transition">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2025 TVDEFleet. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHome;
