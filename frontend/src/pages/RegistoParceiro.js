import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building, ArrowLeft, CheckCircle } from 'lucide-react';

const RegistoParceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    nif: '',
    morada: '',
    codigo_postal: '',
    codigo_certidao_comercial: '',
    responsavel_nome: '',
    responsavel_contacto: '',
    numero_veiculos: '',
    numero_motoristas: '',
    finalidade: 'gestao_frota' // gestao_frota ou usar_plataforma
  });

  const handleChange = (e) => {
    let value = e.target.value;
    
    // Format codigo_certidao_comercial with mask xxxx-xxxx-xxxx
    if (e.target.name === 'codigo_certidao_comercial') {
      // Remove all non-digits
      value = value.replace(/\D/g, '');
      
      // Apply mask
      if (value.length > 0) {
        if (value.length <= 4) {
          value = value;
        } else if (value.length <= 8) {
          value = value.slice(0, 4) + '-' + value.slice(4);
        } else {
          value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8, 12);
        }
      }
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user account
      const userData = {
        name: formData.nome,
        email: formData.email,
        password: 'temporary123', // Temporary password
        phone: formData.telefone,
        role: 'parceiro',
        approved: false
      };

      await axios.post(`${API}/auth/register`, userData);

      // Create parceiro entry
      const parceiroData = {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        nif: formData.nif,
        morada: formData.morada,
        codigo_postal: formData.codigo_postal,
        responsavel_nome: formData.responsavel_nome,
        responsavel_contacto: formData.responsavel_contacto,
        numero_veiculos: parseInt(formData.numero_veiculos) || 0,
        numero_motoristas: parseInt(formData.numero_motoristas) || 0,
        finalidade: formData.finalidade
      };

      await axios.post(`${API}/parceiros`, parceiroData);
      
      setSuccess(true);
      toast.success('Registo enviado com sucesso!');
    } catch (error) {
      console.error('Erro no registo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao registar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Registo Enviado!</CardTitle>
            <CardDescription className="text-base">
              O seu pedido de parceria foi enviado com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-center">
              A nossa equipa irá analisar os dados da sua empresa e entrará em contacto em 24-48 horas.
            </p>
            <p className="text-slate-600 text-center">
              Receberá um email em <strong>{formData.email}</strong> quando o registo for aprovado.
            </p>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/')}
            >
              Voltar à Página Inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center space-x-3 mb-4">
            <Building className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Registo de Parceiro</h1>
          </div>
          <p className="text-slate-600 mb-4">
            Registe a sua empresa como parceiro TVDEFleet
          </p>
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-purple-900 mb-2">✨ Benefícios Incluídos:</p>
              <div className="grid md:grid-cols-2 gap-2 text-xs text-slate-700">
                <div>✓ Gestão completa de veículos e motoristas</div>
                <div>✓ Dashboard financeiro em tempo real</div>
                <div>✓ Seguros com condições especiais</div>
                <div>✓ Rede de mecânicos parceiros</div>
                <div>✓ Contabilidade e apoio jurídico TVDE</div>
                <div>✓ Consultoria especializada dedicada</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>
              Preencha os dados da sua empresa para se tornar parceiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome da Empresa *</Label>
                  <Input
                    id="nome"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    required
                    placeholder="Empresa TVDE Lda"
                  />
                </div>
                <div>
                  <Label htmlFor="nif">NIF *</Label>
                  <Input
                    id="nif"
                    name="nif"
                    value={formData.nif}
                    onChange={handleChange}
                    required
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email da Empresa *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="empresa@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    type="tel"
                    value={formData.telefone}
                    onChange={handleChange}
                    required
                    placeholder="+351 210000000"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="morada">Morada *</Label>
                  <Input
                    id="morada"
                    name="morada"
                    value={formData.morada}
                    onChange={handleChange}
                    required
                    placeholder="Rua, Número"
                  />
                </div>
                <div>
                  <Label htmlFor="codigo_postal">Código Postal *</Label>
                  <Input
                    id="codigo_postal"
                    name="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={handleChange}
                    required
                    placeholder="1000-001"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Informações da Frota</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="numero_veiculos">Número de Veículos *</Label>
                    <Input
                      id="numero_veiculos"
                      name="numero_veiculos"
                      type="number"
                      min="0"
                      value={formData.numero_veiculos}
                      onChange={handleChange}
                      required
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_motoristas">Número de Motoristas *</Label>
                    <Input
                      id="numero_motoristas"
                      name="numero_motoristas"
                      type="number"
                      min="0"
                      value={formData.numero_motoristas}
                      onChange={handleChange}
                      required
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="finalidade">Finalidade *</Label>
                    <select
                      id="finalidade"
                      name="finalidade"
                      value={formData.finalidade}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="gestao_frota">Gestão de Frota</option>
                      <option value="usar_plataforma">Usar Plataforma</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Responsável de Contacto</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="responsavel_nome">Nome do Responsável *</Label>
                    <Input
                      id="responsavel_nome"
                      name="responsavel_nome"
                      value={formData.responsavel_nome}
                      onChange={handleChange}
                      required
                      placeholder="João Silva"
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsavel_contacto">Contacto do Responsável *</Label>
                    <Input
                      id="responsavel_contacto"
                      name="responsavel_contacto"
                      type="tel"
                      value={formData.responsavel_contacto}
                      onChange={handleChange}
                      required
                      placeholder="+351 912345678"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Próximos passos:</strong> Após o registo, receberá um email com as suas credenciais de acesso. A nossa equipa entrará em contacto para finalizar o processo de parceria.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'A enviar...' : 'Enviar Candidatura'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegistoParceiro;