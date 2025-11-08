import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    license_number: '',
    license_expiry: '',
    address: '',
    emergency_contact: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      toast.success(`${docType} enviado com sucesso!`);
    } catch (error) {
      toast.error('Erro ao enviar documento');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
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
              <CardDescription>Preencha os dados para criar a sua conta</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required data-testid="register-name-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required data-testid="register-email-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required data-testid="register-password-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required data-testid="register-phone-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_number">Número da Carta</Label>
                    <Input id="license_number" name="license_number" value={formData.license_number} onChange={handleChange} required data-testid="register-license-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_expiry">Validade da Carta</Label>
                    <Input id="license_expiry" name="license_expiry" type="date" value={formData.license_expiry} onChange={handleChange} required data-testid="register-license-expiry-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Morada</Label>
                  <Input id="address" name="address" value={formData.address} onChange={handleChange} required data-testid="register-address-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Contacto de Emergência</Label>
                  <Input id="emergency_contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} required data-testid="register-emergency-input" />
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading} data-testid="register-submit-button">
                  {loading ? 'A registar...' : 'Continuar'}
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
              <div className="space-y-2">
                <Label htmlFor="license_photo">Foto da Carta de Condução</Label>
                <div className="flex items-center space-x-2">
                  <Input id="license_photo" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'license_photo')} data-testid="upload-license-input" />
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