import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Truck, Shield, Users, TrendingUp, Car, CheckCircle2, Euro, Clock, MapPin, Star } from 'lucide-react';

const PublicSite = () => {
  const navigate = useNavigate();
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactInfo, setContactInfo] = useState({
    email_contacto: 'info@tvdefleet.com',
    telefone_contacto: '+351 912 345 678',
    morada_empresa: 'Lisboa, Portugal',
    nome_empresa: 'TVDEFleet'
  });

  useEffect(() => {
    fetchAvailableVehicles();
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      const response = await axios.get(`${API}/public/contacto`);
      if (response.data) {
        setContactInfo(response.data);
      }
    } catch (error) {
      console.log('Usando configurações de contacto padrão');
    }
  };

  const fetchAvailableVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles/available`);
      setAvailableVehicles(response.data);
    } catch (error) {
      console.error('Error fetching vehicles', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">TVDEFleet</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/motorista/register')} data-testid="header-register-button">
                Registar como Motorista
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/login')} data-testid="header-login-button">
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 opacity-90"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center text-white space-y-6">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Gestão Inteligente de Frotas TVDE
            </h2>
            <p className="text-base sm:text-lg lg:text-xl max-w-3xl mx-auto opacity-90">
              Otimize operações, controle custos e maximize lucros com nossa plataforma completa de gestão de frotas
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 pt-6">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-slate-100 px-8 py-6 text-lg" onClick={() => navigate('/login')} data-testid="hero-start-button">
                Começar Agora
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg" onClick={() => navigate('/motorista/register')} data-testid="hero-register-button">
                Ser Motorista
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="features-section">
        <div className="text-center mb-16">
          <h3 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Tudo o que Precisa para Gerir a Sua Frota</h3>
          <p className="text-slate-600 text-base sm:text-lg">Soluções completas e integradas</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="card-hover text-center" data-testid="feature-fleet">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-emerald-600" />
              </div>
              <CardTitle>Gestão de Frota</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">Controle completo de veículos, manutenções e dispon ibilidade</p>
            </CardContent>
          </Card>
          <Card className="card-hover text-center" data-testid="feature-insurance">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>Seguros & Conformidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">Gestão automática de seguros, inspeções e documentos</p>
            </CardContent>
          </Card>
          <Card className="card-hover text-center" data-testid="feature-drivers">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-cyan-600" />
              </div>
              <CardTitle>Motoristas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">Registo, aprovação e gestão de motoristas simplificada</p>
            </CardContent>
          </Card>
          <Card className="card-hover text-center" data-testid="feature-roi">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-amber-600" />
              </div>
              <CardTitle>ROI em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">Relatórios financeiros detalhados e análise de rentabilidade</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Available Vehicles Section */}
      <section className="bg-white py-20" data-testid="vehicles-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Veículos Disponíveis para Aluguer</h3>
            <p className="text-slate-600 text-base sm:text-lg">Encontre o veículo perfeito para as suas necessidades</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : availableVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum veículo disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {availableVehicles.map((vehicle) => (
                <Card key={vehicle.id} className="card-hover" data-testid={`public-vehicle-${vehicle.id}`}>
                  <div className="h-48 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                    <Car className="w-20 h-20 text-emerald-600" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-xl">{vehicle.marca} {vehicle.modelo}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-emerald-100 text-emerald-700">Disponível</Badge>
                      <span className="text-sm text-slate-500">{vehicle.ano}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Matrícula:</span>
                      <span className="font-medium">{vehicle.matricula}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Tipo:</span>
                      <span className="font-medium capitalize">{vehicle.tipo}</span>
                    </div>
                    {vehicle.disponibilidade.comissao_full_time > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Comissão Full Time:</span>
                          <span className="text-lg font-bold text-emerald-600">€{vehicle.disponibilidade.comissao_full_time}/dia</span>
                        </div>
                      </div>
                    )}
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4" onClick={() => navigate('/motorista/register')} data-testid={`request-vehicle-${vehicle.id}`}>
                      Solicitar Veículo
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="how-it-works-section">
        <div className="text-center mb-16">
          <h3 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Como Funciona</h3>
          <p className="text-slate-600 text-base sm:text-lg">Simples, rápido e eficiente</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-bold text-white">1</span>
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-3">Registe-se</h4>
            <p className="text-slate-600">Crie a sua conta como motorista ou gestor de frota em minutos</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-bold text-white">2</span>
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-3">Envie Documentos</h4>
            <p className="text-slate-600">Carregue os documentos necessários para aprovação rápida</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-bold text-white">3</span>
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-3">Comece a Conduzir</h4>
            <p className="text-slate-600">Após aprovação, aceda à plataforma e escolha o seu veículo</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Porquê Escolher TVDEFleet?</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Gestão Centralizada</h4>
                <p className="text-slate-600">Controle toda a sua frota numa única plataforma intuitiva</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Automatização Inteligente</h4>
                <p className="text-slate-600">Alertas automáticos para manutenções, seguros e inspeções</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Relatórios Detalhados</h4>
                <p className="text-slate-600">Análise financeira completa com ROI em tempo real</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Integrações</h4>
                <p className="text-slate-600">Sincronização com Uber, Bolt, GPS, Via Verde e mais</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl sm:text-4xl font-bold text-white mb-6">Pronto para Otimizar a Sua Frota?</h3>
          <p className="text-white text-base sm:text-lg mb-8 opacity-90">Junte-se a centenas de gestores que já confiam na TVDEFleet</p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button size="lg" className="bg-white text-emerald-600 hover:bg-slate-100 px-8 py-6 text-lg" onClick={() => navigate('/login')} data-testid="cta-start-button">
              Começar Gratuitamente
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg" onClick={() => navigate('/motorista/register')} data-testid="cta-register-button">
              Registar como Motorista
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Truck className="w-6 h-6" />
                <span className="text-xl font-bold">TVDEFleet</span>
              </div>
              <p className="text-slate-400 text-sm">Gestão inteligente de frotas TVDE. Otimize, controle, lucre.</p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Links Rápidos</h5>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => navigate('/login')} className="hover:text-white">Login</button></li>
                <li><button onClick={() => navigate('/motorista/register')} className="hover:text-white">Registar Motorista</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contacto</h5>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Email: info@tvdefleet.com</li>
                <li>Telefone: +351 XXX XXX XXX</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            <p>© 2025 TVDEFleet. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicSite;