import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';

const MotoristaRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [motoristId, setMotoristaId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    morada_completa: '',
    codigo_postal: '',
    data_nascimento: '',
    nacionalidade: 'Portuguesa',
    tipo_documento: 'CC',
    numero_documento: '',
    validade_documento: '',
    nif: '',
    carta_conducao_numero: '',
    carta_conducao_validade: '',
    licenca_tvde_numero: '',
    licenca_tvde_validade: '',
    codigo_registo_criminal: '',
    regime: 'aluguer',
    iban: '',
    email_uber: '',
    telefone_uber: '',
    email_bolt: '',
    telefone_bolt: '',
    whatsapp: '',
    tipo_pagamento: 'recibo_verde'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/motoristas/register`, formData);
      setMotoristaId(response.data.id);
      toast.success('Registo criado! Agora envie os documentos.');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao registar');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    try {
      await axios.post(`${API}/motoristas/${motoristId}/upload-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Documento enviado com sucesso!`);
    } catch (error) {
      toast.error('Erro ao enviar documento');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/login')}
          className="mb-6"
          data-testid="back-to-login-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Login
        </Button>

        {step === 1 ? (
          <Card className="glass shadow-xl" data-testid="register-form-card">
            <CardHeader>
              <CardTitle className="text-2xl">Registo de Motorista</CardTitle>
              <CardDescription>Preencha todos os dados para criar a sua conta</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Pessoais */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleChange} required data-testid="register-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required data-testid="register-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha *</Label>
                      <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required data-testid="register-password-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+351 912345678" data-testid="register-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+351 912345678" data-testid="register-whatsapp-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                      <Input id="data_nascimento" name="data_nascimento" type="date" value={formData.data_nascimento} onChange={handleChange} data-testid="register-birth-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nacionalidade">Nacionalidade</Label>
                      <Input id="nacionalidade" name="nacionalidade" value={formData.nacionalidade} onChange={handleChange} data-testid="register-nationality-input" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="morada_completa">Morada Completa</Label>
                    <Input id="morada_completa" name="morada_completa" value={formData.morada_completa} onChange={handleChange} placeholder="Rua, número, andar" data-testid="register-address-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo_postal">Código Postal</Label>
                    <Input id="codigo_postal" name="codigo_postal" value={formData.codigo_postal} onChange={handleChange} placeholder="1000-001" data-testid="register-postal-input" />
                  </div>
                </div>

                {/* Documentação */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Documentação</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_documento">Tipo de Documento</Label>
                      <Select value={formData.tipo_documento} onValueChange={(value) => handleSelectChange('tipo_documento', value)}>
                        <SelectTrigger data-testid="register-doctype-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">Cartão de Cidadão</SelectItem>
                          <SelectItem value="Passaporte">Passaporte</SelectItem>
                          <SelectItem value="Residencia">Autorização de Residência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numero_documento">Número do Documento</Label>
                      <Input id="numero_documento" name="numero_documento" value={formData.numero_documento} onChange={handleChange} data-testid="register-docnumber-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validade_documento">Validade do Documento</Label>
                      <Input id="validade_documento" name="validade_documento" type="date" value={formData.validade_documento} onChange={handleChange} data-testid="register-docvalidity-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">NIF</Label>
                      <Input id="nif" name="nif" value={formData.nif} onChange={handleChange} data-testid="register-nif-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carta_conducao_numero">Nº Carta de Condução</Label>
                      <Input id="carta_conducao_numero" name="carta_conducao_numero" value={formData.carta_conducao_numero} onChange={handleChange} data-testid="register-license-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carta_conducao_validade">Validade Carta</Label>
                      <Input id="carta_conducao_validade" name="carta_conducao_validade" type="date" value={formData.carta_conducao_validade} onChange={handleChange} data-testid="register-license-validity-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenca_tvde_numero">Nº Licença TVDE</Label>
                      <Input id="licenca_tvde_numero" name="licenca_tvde_numero" value={formData.licenca_tvde_numero} onChange={handleChange} data-testid="register-tvde-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenca_tvde_validade">Validade Licença TVDE</Label>
                      <Input id="licenca_tvde_validade" name="licenca_tvde_validade" type="date" value={formData.licenca_tvde_validade} onChange={handleChange} data-testid="register-tvde-validity-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codigo_registo_criminal">Código Registo Criminal</Label>
                      <Input id="codigo_registo_criminal" name="codigo_registo_criminal" value={formData.codigo_registo_criminal} onChange={handleChange} data-testid="register-criminal-input" />
                    </div>
                  </div>
                </div>

                {/* Dados Bancários e Plataformas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Dados Bancários & Plataformas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="iban">IBAN</Label>
                      <Input id="iban" name="iban" value={formData.iban} onChange={handleChange} placeholder="PT50..." data-testid="register-iban-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_uber">Email Uber</Label>
                      <Input id="email_uber" name="email_uber" type="email" value={formData.email_uber} onChange={handleChange} data-testid="register-uber-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone_uber">Telefone Uber</Label>
                      <Input id="telefone_uber" name="telefone_uber" value={formData.telefone_uber} onChange={handleChange} data-testid="register-uber-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_bolt">Email Bolt</Label>
                      <Input id="email_bolt" name="email_bolt" type="email" value={formData.email_bolt} onChange={handleChange} data-testid="register-bolt-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone_bolt">Telefone Bolt</Label>
                      <Input id="telefone_bolt" name="telefone_bolt" value={formData.telefone_bolt} onChange={handleChange} data-testid="register-bolt-phone-input" />
                    </div>
                  </div>
                </div>

                {/* Regime e Pagamento */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Regime & Pagamento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="regime">Regime</Label>
                      <Select value={formData.regime} onValueChange={(value) => handleSelectChange('regime', value)}>
                        <SelectTrigger data-testid="register-regime-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aluguer">Aluguer</SelectItem>
                          <SelectItem value="comissao">Comissão</SelectItem>
                          <SelectItem value="carro_proprio">Carro Próprio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo_pagamento">Tipo de Pagamento</Label>
                      <Select value={formData.tipo_pagamento} onValueChange={(value) => handleSelectChange('tipo_pagamento', value)}>
                        <SelectTrigger data-testid="register-payment-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fatura">Fatura</SelectItem>
                          <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                          <SelectItem value="sem_recibo">Sem Recibo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading} data-testid="register-submit-button">
                  {loading ? 'A registar...' : 'Continuar para Documentos'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass shadow-xl" data-testid="upload-documents-card">
            <CardHeader>
              <CardTitle className="text-2xl">Enviar Documentos</CardTitle>
              <CardDescription>Envie os documentos necessários para completar o registo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documento_identificacao">Documento de Identificação</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="documento_identificacao" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'documento_identificacao')} data-testid="upload-doc-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_photo">Foto da Carta de Condução</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="license_photo" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'license_photo')} data-testid="upload-license-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenca_tvde">Licença TVDE</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="licenca_tvde" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'licenca_tvde')} data-testid="upload-tvde-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registo_criminal">Registo Criminal</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="registo_criminal" type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'registo_criminal')} data-testid="upload-criminal-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cv_file">CV (Opcional)</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="cv_file" type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, 'cv_file')} data-testid="upload-cv-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_photo">Foto de Perfil</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="profile_photo" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'profile_photo')} data-testid="upload-profile-input" />
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="font-medium">Registo Completo!</p>
                </div>
                <p className="text-sm text-emerald-600 mt-2">O seu registo será analisado pela equipa. Receberá uma notificação quando for aprovado.</p>
              </div>
              <Button onClick={() => navigate('/login')} className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="finish-registration-button">
                Ir para Login
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MotoristaRegister;