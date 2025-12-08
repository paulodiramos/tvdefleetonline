import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Car, ArrowLeft, CheckCircle, Upload, FileText, AlertCircle } from 'lucide-react';

const RegistoMotorista = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    data_nascimento: '',
    nif: '',
    nacionalidade: 'Portuguesa',
    morada_completa: '',
    codigo_postal: '',
    password: '',
    confirmPassword: ''
  });
  
  const [documentos, setDocumentos] = useState({
    carta_conducao: null,
    identificacao: null,
    licenca_tvde: null,
    registo_criminal: null,
    comprovativo_morada: null
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleFileChange = (e, tipoDocumento) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Formato inválido. Use PDF ou imagens (JPG, PNG, WEBP)');
        return;
      }
      
      // Validar tamanho (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB');
        return;
      }
      
      setDocumentos({
        ...documentos,
        [tipoDocumento]: file
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar senhas
    if (formData.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    // Validar documentos obrigatórios
    const docsObrigatorios = ['carta_conducao', 'licenca_tvde', 'registo_criminal', 'comprovativo_morada'];
    const docsFaltando = docsObrigatorios.filter(doc => !documentos[doc]);
    
    if (docsFaltando.length > 0) {
      toast.error('Por favor, carregue todos os documentos obrigatórios');
      return;
    }
    
    // Validar pelo menos 1 documento de identificação
    if (!documentos.identificacao) {
      toast.error('Por favor, carregue um documento de identificação (CC, Passaporte ou Título de Residência)');
      return;
    }
    
    setLoading(true);

    try {
      // 1. Registar utilizador
      const { confirmPassword, ...registoData } = formData;
      const finalData = {
        ...registoData,
        role: 'motorista',
        approved: false
      };

      const response = await axios.post(`${API}/auth/register`, finalData);
      const userId = response.data.user_id || response.data.id;
      
      // 2. Upload de documentos
      const token = localStorage.getItem('token');
      
      for (const [tipoDoc, file] of Object.entries(documentos)) {
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('tipo_documento', tipoDoc);
          formData.append('user_id', userId);
          formData.append('role', 'motorista');
          
          await axios.post(`${API}/api/documentos/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: token ? `Bearer ${token}` : ''
            }
          });
        }
      }
      
      setSuccess(true);
      toast.success('Registo e documentos enviados com sucesso!');
    } catch (error) {
      console.error('Erro no registo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao registar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Registo Enviado!</CardTitle>
            <CardDescription className="text-base">
              O seu pedido de registo foi enviado com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-center">
              A nossa equipa irá analisar os seus dados e entrará em contacto em 24-48 horas.
            </p>
            <p className="text-slate-600 text-center">
              Receberá um email em <strong>{formData.email}</strong> quando a sua conta for aprovada.
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
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
            <Car className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Registo de Motorista</h1>
          </div>
          <p className="text-slate-600">
            Preencha o formulário abaixo para se candidatar como motorista TVDE
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
            <CardDescription>
              Todos os campos são obrigatórios. Os seus dados serão analisados pela nossa equipa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados Básicos */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="João Silva"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="joao@email.com"
                  />
                </div>
              </div>

              {/* Contactos */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+351 912345678"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    type="tel"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="+351 912345678"
                  />
                </div>
              </div>

              {/* Dados Pessoais */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="data_nascimento">Data Nascimento *</Label>
                  <Input
                    id="data_nascimento"
                    name="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={handleChange}
                    required
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
                <div>
                  <Label htmlFor="nacionalidade">Nacionalidade *</Label>
                  <Input
                    id="nacionalidade"
                    name="nacionalidade"
                    value={formData.nacionalidade}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Morada */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="morada_completa">Morada Completa *</Label>
                  <Input
                    id="morada_completa"
                    name="morada_completa"
                    value={formData.morada_completa}
                    onChange={handleChange}
                    required
                    placeholder="Rua, Número, Andar"
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

              {/* Senha */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                  <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Repita a senha"
                    minLength={6}
                  />
                </div>
              </div>

              {/* Documentos Obrigatórios */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Documentos Obrigatórios</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Carregue os seguintes documentos (PDF ou imagens). Serão automaticamente convertidos para PDF.
                </p>

                <div className="space-y-4">
                  {/* Carta de Condução */}
                  <div>
                    <Label htmlFor="carta_conducao" className="flex items-center justify-between">
                      <span>Carta de Condução *</span>
                      {documentos.carta_conducao && (
                        <span className="text-xs text-green-600 font-medium">✓ Carregado</span>
                      )}
                    </Label>
                    <Input
                      id="carta_conducao"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'carta_conducao')}
                      required
                      className="mt-1"
                    />
                    {documentos.carta_conducao && (
                      <p className="text-xs text-slate-500 mt-1">{documentos.carta_conducao.name}</p>
                    )}
                  </div>

                  {/* Identificação */}
                  <div>
                    <Label htmlFor="identificacao" className="flex items-center justify-between">
                      <span>Cartão de Cidadão / Passaporte / Título de Residência *</span>
                      {documentos.identificacao && (
                        <span className="text-xs text-green-600 font-medium">✓ Carregado</span>
                      )}
                    </Label>
                    <Input
                      id="identificacao"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'identificacao')}
                      required
                      className="mt-1"
                    />
                    {documentos.identificacao && (
                      <p className="text-xs text-slate-500 mt-1">{documentos.identificacao.name}</p>
                    )}
                  </div>

                  {/* Licença TVDE */}
                  <div>
                    <Label htmlFor="licenca_tvde" className="flex items-center justify-between">
                      <span>Licença TVDE *</span>
                      {documentos.licenca_tvde && (
                        <span className="text-xs text-green-600 font-medium">✓ Carregado</span>
                      )}
                    </Label>
                    <Input
                      id="licenca_tvde"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'licenca_tvde')}
                      required
                      className="mt-1"
                    />
                    {documentos.licenca_tvde && (
                      <p className="text-xs text-slate-500 mt-1">{documentos.licenca_tvde.name}</p>
                    )}
                  </div>

                  {/* Registo Criminal */}
                  <div>
                    <Label htmlFor="registo_criminal" className="flex items-center justify-between">
                      <span>Registo Criminal *</span>
                      {documentos.registo_criminal && (
                        <span className="text-xs text-green-600 font-medium">✓ Carregado</span>
                      )}
                    </Label>
                    <Input
                      id="registo_criminal"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'registo_criminal')}
                      required
                      className="mt-1"
                    />
                    {documentos.registo_criminal && (
                      <p className="text-xs text-slate-500 mt-1">{documentos.registo_criminal.name}</p>
                    )}
                  </div>

                  {/* Comprovativo de Morada */}
                  <div>
                    <Label htmlFor="comprovativo_morada" className="flex items-center justify-between">
                      <span>Comprovativo de Morada *</span>
                      {documentos.comprovativo_morada && (
                        <span className="text-xs text-green-600 font-medium">✓ Carregado</span>
                      )}
                    </Label>
                    <Input
                      id="comprovativo_morada"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'comprovativo_morada')}
                      required
                      className="mt-1"
                    />
                    {documentos.comprovativo_morada && (
                      <p className="text-xs text-slate-500 mt-1">{documentos.comprovativo_morada.name}</p>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-xs text-yellow-800">
                      <strong>Importante:</strong> Todos os documentos são obrigatórios. Pode carregar imagens (JPG, PNG) ou PDFs. 
                      As imagens serão automaticamente convertidas para PDF.
                    </p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Próximos passos:</strong> Após o registo e envio dos documentos, a nossa equipa irá analisar tudo. 
                  Receberá um email quando a sua conta for aprovada. Poderá então fazer login com o email e senha que escolheu.
                </p>
              </div>

              {/* Buttons */}
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

export default RegistoMotorista;
