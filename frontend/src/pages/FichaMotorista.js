import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, CreditCard, Car, FileText,
  Save, Edit, Euro, Percent, Calculator, TrendingUp, Wallet,
  Receipt, History, AlertCircle, CheckCircle, Clock, Upload,
  Calendar, Globe, IdCard, Shield, FileCheck, Home, Building,
  MessageCircle, Smartphone
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Helper para classe de input preenchido (cor mais escura quando tem valor)
const getFilledInputClass = (value) => {
  return value && value.toString().trim() !== '' 
    ? 'bg-slate-50 text-slate-900 font-medium border-slate-300' 
    : '';
};

const FichaMotorista = ({ user }) => {
  const { motoristaId } = useParams();
  const navigate = useNavigate();
  
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('dados-pessoais');
  
  // Dados editáveis do motorista
  const [dadosMotorista, setDadosMotorista] = useState({
    // Dados Pessoais
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    
    // Documentos de Identificação
    tipo_documento: 'cc', // cc, residencia, passaporte
    documento_numero: '',
    documento_validade: '',
    
    nif: '',
    seguranca_social: '',
    data_nascimento: '',
    nacionalidade: 'Portuguesa',
    
    // Morada
    morada: '',
    codigo_postal: '',
    localidade: '',
    
    // Registo Criminal
    registo_criminal_codigo: '',
    registo_criminal_validade: '',
    
    // Licença TVDE
    licenca_tvde_numero: '',
    licenca_tvde_validade: '',
    
    // Carta de Condução
    carta_conducao_numero: '',
    carta_conducao_emissao: '',
    carta_conducao_validade: '',
    
    // Dados Bancários
    iban: '',
    
    // Emails e Telefones das Plataformas
    email_uber: '',
    telefone_uber: '',
    email_bolt: '',
    telefone_bolt: '',
    usar_dados_padrao_plataformas: true
  });
  
  // Documentos
  const [documentos, setDocumentos] = useState({
    cc_frente: null,
    cc_verso: null,
    carta_conducao_frente: null,
    carta_conducao_verso: null,
    licenca_tvde: null,
    registo_criminal: null,
    comprovativo_morada: null,
    comprovativo_iban: null
  });
  
  // Campos financeiros
  const [configFinanceira, setConfigFinanceira] = useState({
    acumular_viaverde: false,
    viaverde_acumulado: 0,
    viaverde_fonte: 'ambos',
    gratificacao_tipo: 'na_comissao',
    gratificacao_valor_fixo: 0,
    incluir_iva_rendimentos: true,
    iva_percentagem: 23,
    comissao_personalizada: false,
    comissao_motorista_percentagem: 70,
    comissao_parceiro_percentagem: 30
  });
  
  // Histórico de Via Verde acumulado
  const [historicoViaVerde, setHistoricoViaVerde] = useState([]);
  
  // Veículo atribuído
  const [veiculo, setVeiculo] = useState(null);
  
  // Upload states
  const [uploading, setUploading] = useState({});
  
  // Foto do motorista
  const [fotoMotorista, setFotoMotorista] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const handleFotoUpload = async (file) => {
    if (!file) return;
    
    setUploadingFoto(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/api/motoristas/${motoristaId}/foto`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setFotoMotorista(response.data.url);
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao carregar foto:', error);
      toast.error('Erro ao carregar foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const fetchMotorista = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const motoristaData = response.data;
      setMotorista(motoristaData);
      
      // Preencher dados editáveis
      setDadosMotorista(prev => ({
        ...prev,
        name: motoristaData.name || '',
        email: motoristaData.email || '',
        phone: motoristaData.phone || '',
        whatsapp: motoristaData.whatsapp || motoristaData.phone || '',
        tipo_documento: motoristaData.tipo_documento || 'cc',
        documento_numero: motoristaData.documento_numero || motoristaData.cc_numero || '',
        documento_validade: motoristaData.documento_validade || motoristaData.cc_validade || '',
        nif: motoristaData.nif || '',
        seguranca_social: motoristaData.seguranca_social || '',
        data_nascimento: motoristaData.data_nascimento || '',
        nacionalidade: motoristaData.nacionalidade || 'Portuguesa',
        morada: motoristaData.morada || motoristaData.morada_completa || '',
        codigo_postal: motoristaData.codigo_postal || '',
        localidade: motoristaData.localidade || '',
        registo_criminal_codigo: motoristaData.registo_criminal_codigo || '',
        registo_criminal_validade: motoristaData.registo_criminal_validade || '',
        licenca_tvde_numero: motoristaData.licenca_tvde_numero || '',
        licenca_tvde_validade: motoristaData.licenca_tvde_validade || '',
        carta_conducao_numero: motoristaData.carta_conducao_numero || '',
        carta_conducao_emissao: motoristaData.carta_conducao_emissao || '',
        carta_conducao_validade: motoristaData.carta_conducao_validade || '',
        iban: motoristaData.iban || '',
        email_uber: motoristaData.email_uber || motoristaData.email || '',
        telefone_uber: motoristaData.telefone_uber || motoristaData.phone || '',
        email_bolt: motoristaData.email_bolt || motoristaData.email || '',
        telefone_bolt: motoristaData.telefone_bolt || motoristaData.phone || '',
        usar_dados_padrao_plataformas: motoristaData.usar_dados_padrao_plataformas !== false
      }));
      
      // Carregar documentos existentes
      if (motoristaData.documentos) {
        setDocumentos(prev => ({ ...prev, ...motoristaData.documentos }));
      }
      
      // Carregar foto do motorista
      if (motoristaData.foto_url) {
        setFotoMotorista(motoristaData.foto_url);
      }
      
      // Carregar configurações financeiras se existirem
      if (motoristaData.config_financeira) {
        setConfigFinanceira(prev => ({
          ...prev,
          ...motoristaData.config_financeira
        }));
      }
      
      // Carregar veículo se atribuído
      if (motoristaData.veiculo_atribuido) {
        fetchVeiculo(motoristaData.veiculo_atribuido);
      }
      
    } catch (error) {
      console.error('Erro ao carregar motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  }, [motoristaId]);

  const fetchVeiculo = async (veiculoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/vehicles/${veiculoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculo(response.data);
    } catch (error) {
      console.error('Erro ao carregar veículo:', error);
    }
  };

  const fetchHistoricoViaVerde = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}/viaverde-acumulado`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricoViaVerde(response.data?.historico || []);
      if (response.data?.total_acumulado !== undefined) {
        setConfigFinanceira(prev => ({
          ...prev,
          viaverde_acumulado: response.data.total_acumulado
        }));
      }
    } catch (error) {
      console.log('Histórico Via Verde não disponível');
    }
  }, [motoristaId]);

  useEffect(() => {
    if (motoristaId) {
      fetchMotorista();
      fetchHistoricoViaVerde();
    }
  }, [motoristaId, fetchMotorista, fetchHistoricoViaVerde]);

  const handleSaveDadosMotorista = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Se usar dados padrão, copiar para plataformas
      const dadosParaEnviar = { ...dadosMotorista };
      if (dadosMotorista.usar_dados_padrao_plataformas) {
        dadosParaEnviar.email_uber = dadosMotorista.email;
        dadosParaEnviar.telefone_uber = dadosMotorista.phone;
        dadosParaEnviar.email_bolt = dadosMotorista.email;
        dadosParaEnviar.telefone_bolt = dadosMotorista.phone;
      }
      
      await axios.put(`${API}/api/motoristas/${motoristaId}`, dadosParaEnviar, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Dados guardados com sucesso!');
      setIsEditing(false);
      fetchMotorista();
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfigFinanceira = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/motoristas/${motoristaId}/config-financeira`, configFinanceira, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configurações financeiras guardadas!');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAbaterViaVerde = async () => {
    if (!window.confirm(`Confirma o abate de €${configFinanceira.viaverde_acumulado.toFixed(2)} do Via Verde acumulado?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/motoristas/${motoristaId}/viaverde-abater`, {
        valor: configFinanceira.viaverde_acumulado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConfigFinanceira(prev => ({ ...prev, viaverde_acumulado: 0 }));
      toast.success('Via Verde abatido com sucesso!');
      fetchHistoricoViaVerde();
    } catch (error) {
      console.error('Erro ao abater:', error);
      toast.error('Erro ao abater Via Verde');
    }
  };

  const handleFileUpload = async (tipoDocumento, file) => {
    if (!file) return;
    
    setUploading(prev => ({ ...prev, [tipoDocumento]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo_documento', tipoDocumento);
      formData.append('converter_pdf', 'true'); // Sempre converter para PDF
      
      const response = await axios.post(
        `${API}/api/motoristas/${motoristaId}/documentos/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setDocumentos(prev => ({
        ...prev,
        [tipoDocumento]: response.data.url
      }));
      
      toast.success(`Documento convertido para PDF e guardado!`);
    } catch (error) {
      console.error('Erro ao carregar documento:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setUploading(prev => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ativo: { label: 'Ativo', className: 'bg-green-500 text-white' },
      inativo: { label: 'Inativo', className: 'bg-gray-500 text-white' },
      pendente: { label: 'Pendente', className: 'bg-yellow-500 text-white' },
      suspenso: { label: 'Suspenso', className: 'bg-red-500 text-white' }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const isDocumentoProximoExpirar = (dataValidade) => {
    if (!dataValidade) return false;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    const diffDias = Math.floor((validade - hoje) / (1000 * 60 * 60 * 24));
    return diffDias <= 30 && diffDias >= 0;
  };

  const isDocumentoExpirado = (dataValidade) => {
    if (!dataValidade) return false;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    return validade < hoje;
  };

  const getDiasParaExpirar = (dataValidade) => {
    if (!dataValidade) return null;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    return Math.floor((validade - hoje) / (1000 * 60 * 60 * 24));
  };

  const getValidadeBadge = (dataValidade, mostrarDias = false) => {
    if (!dataValidade) return <Badge variant="outline">Não definida</Badge>;
    const dias = getDiasParaExpirar(dataValidade);
    
    if (dias < 0) {
      return (
        <Badge className="bg-red-500 text-white animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" /> Expirado há {Math.abs(dias)} dias
        </Badge>
      );
    }
    if (dias <= 30) {
      return (
        <Badge className="bg-yellow-500 text-white animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" /> Expira em {dias} dias
        </Badge>
      );
    }
    if (mostrarDias && dias <= 60) {
      return <Badge className="bg-blue-100 text-blue-800">{dataValidade} ({dias} dias)</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">{dataValidade}</Badge>;
  };

  const isAniversario = (dataNascimento) => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    return hoje.getMonth() === nascimento.getMonth() && hoje.getDate() === nascimento.getDate();
  };

  const diasParaAniversario = (dataNascimento) => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    const aniversarioEsteAno = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
    
    if (aniversarioEsteAno < hoje) {
      aniversarioEsteAno.setFullYear(hoje.getFullYear() + 1);
    }
    
    return Math.floor((aniversarioEsteAno - hoje) / (1000 * 60 * 60 * 24));
  };

  const getAniversarioBadge = (dataNascimento) => {
    if (!dataNascimento) return null;
    
    if (isAniversario(dataNascimento)) {
      return (
        <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white animate-bounce">
          🎂 Parabéns! Feliz Aniversário!
        </Badge>
      );
    }
    
    const dias = diasParaAniversario(dataNascimento);
    if (dias !== null && dias <= 7 && dias > 0) {
      return (
        <Badge className="bg-pink-100 text-pink-800">
          🎁 Aniversário em {dias} {dias === 1 ? 'dia' : 'dias'}
        </Badge>
      );
    }
    
    return null;
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const DocumentUploadCard = ({ titulo, tipoDocumento, icone: Icone, descricao }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icone className="w-5 h-5 text-slate-500" />
          <span className="font-medium">{titulo}</span>
        </div>
        {documentos[tipoDocumento] ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" /> PDF
          </Badge>
        ) : (
          <Badge variant="outline">Pendente</Badge>
        )}
      </div>
      <p className="text-sm text-slate-500">{descricao}</p>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(tipoDocumento, e.target.files[0])}
          disabled={uploading[tipoDocumento]}
          className="text-sm"
        />
        {uploading[tipoDocumento] && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-slate-500">A converter para PDF...</span>
          </div>
        )}
      </div>
      {documentos[tipoDocumento] && (
        <a 
          href={`${API}/${documentos[tipoDocumento]}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <FileText className="w-4 h-4" /> Ver PDF
        </a>
      )}
    </div>
  );

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!motorista) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Motorista não encontrado</h2>
          <Button onClick={() => navigate('/motoristas')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/motoristas')} data-testid="btn-voltar">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <div className="flex items-center gap-4">
              {/* Foto do Motorista com Upload */}
              <div className="relative group">
                <Avatar className="h-20 w-20 border-2 border-slate-200">
                  {fotoMotorista ? (
                    <img 
                      src={`${API}/${fotoMotorista}`} 
                      alt={motorista.name}
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                      {getInitials(motorista.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/* Overlay para upload */}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFotoUpload(e.target.files[0])}
                    disabled={uploadingFoto}
                  />
                  {uploadingFoto ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    <Upload className="w-6 h-6 text-white" />
                  )}
                </label>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold" data-testid="motorista-nome">{motorista.name}</h1>
                  {getAniversarioBadge(dadosMotorista.data_nascimento)}
                </div>
                <p className="text-slate-500">{motorista.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(motorista.status_motorista || motorista.status)}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dados-pessoais" data-testid="tab-dados-pessoais">
              <User className="w-4 h-4 mr-2" /> Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="documentos" data-testid="tab-documentos">
              <FileText className="w-4 h-4 mr-2" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="plataformas" data-testid="tab-plataformas">
              <Smartphone className="w-4 h-4 mr-2" /> Plataformas
            </TabsTrigger>
            <TabsTrigger value="veiculo" data-testid="tab-veiculo">
              <Car className="w-4 h-4 mr-2" /> Veículo
            </TabsTrigger>
            <TabsTrigger value="financeiro" data-testid="tab-financeiro">
              <Euro className="w-4 h-4 mr-2" /> Financeiro
            </TabsTrigger>
          </TabsList>

          {/* Tab Dados Pessoais */}
          <TabsContent value="dados-pessoais" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="btn-editar">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveDadosMotorista} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" /> Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input
                      value={dadosMotorista.name}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      data-testid="input-nome"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={dadosMotorista.data_nascimento}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, data_nascimento: e.target.value }))}
                        disabled={!isEditing}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dadosMotorista.data_nascimento && (
                          <Badge variant="outline">
                            {calcularIdade(dadosMotorista.data_nascimento)} anos
                          </Badge>
                        )}
                        {getAniversarioBadge(dadosMotorista.data_nascimento)}
                      </div>
                    </div>
                    <div>
                      <Label>Nacionalidade</Label>
                      <Input
                        value={dadosMotorista.nacionalidade}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, nacionalidade: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>NIF</Label>
                    <Input
                      value={dadosMotorista.nif}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, nif: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <Label>Nº Segurança Social</Label>
                    <Input
                      value={dadosMotorista.seguranca_social}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, seguranca_social: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="12345678901"
                      className={getFilledInputClass(dadosMotorista.seguranca_social)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contactos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5" /> Contactos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email de Contacto
                    </Label>
                    <Input
                      type="email"
                      value={dadosMotorista.email}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Telefone de Contacto
                    </Label>
                    <Input
                      value={dadosMotorista.phone}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="+351 912 345 678"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </Label>
                    <Input
                      value={dadosMotorista.whatsapp}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, whatsapp: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="+351 912 345 678"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> IBAN
                    </Label>
                    <Input
                      value={dadosMotorista.iban}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, iban: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="PT50 0000 0000 0000 0000 0000 0"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Documento de Identificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IdCard className="w-5 h-5" /> Documento de Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select
                      value={dadosMotorista.tipo_documento}
                      onValueChange={(value) => setDadosMotorista(prev => ({ ...prev, tipo_documento: value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cc">Cartão de Cidadão</SelectItem>
                        <SelectItem value="residencia">Autorização de Residência</SelectItem>
                        <SelectItem value="passaporte">Passaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={dadosMotorista.documento_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, documento_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.documento_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, documento_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.documento_validade)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Morada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Home className="w-5 h-5" /> Morada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Morada Completa</Label>
                    <Input
                      value={dadosMotorista.morada}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, morada: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Rua, número, andar..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código Postal</Label>
                      <Input
                        value={dadosMotorista.codigo_postal}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, codigo_postal: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="1234-567"
                      />
                    </div>
                    <div>
                      <Label>Localidade</Label>
                      <Input
                        value={dadosMotorista.localidade}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, localidade: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="Lisboa"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registo Criminal */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Registo Criminal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código de Acesso</Label>
                      <Input
                        value={dadosMotorista.registo_criminal_codigo}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, registo_criminal_codigo: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.registo_criminal_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, registo_criminal_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.registo_criminal_validade)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Licença TVDE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCheck className="w-5 h-5" /> Licença TVDE
                    {(isDocumentoProximoExpirar(dadosMotorista.licenca_tvde_validade) || 
                      isDocumentoExpirado(dadosMotorista.licenca_tvde_validade)) && (
                      <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número da Licença</Label>
                      <Input
                        value={dadosMotorista.licenca_tvde_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, licenca_tvde_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.licenca_tvde_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, licenca_tvde_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.licenca_tvde_validade, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carta de Condução */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Carta de Condução
                    {(isDocumentoProximoExpirar(dadosMotorista.carta_conducao_validade) || 
                      isDocumentoExpirado(dadosMotorista.carta_conducao_validade)) && (
                      <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={dadosMotorista.carta_conducao_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Data de Emissão</Label>
                      <Input
                        type="date"
                        value={dadosMotorista.carta_conducao_emissao}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_emissao: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.carta_conducao_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.carta_conducao_validade, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Documentos</CardTitle>
                <CardDescription>
                  Carregar os documentos necessários para a ficha do motorista
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocumentUploadCard
                    titulo="Documento de Identificação (Frente)"
                    tipoDocumento="cc_frente"
                    icone={IdCard}
                    descricao="CC, Autorização de Residência ou Passaporte - Frente"
                  />
                  <DocumentUploadCard
                    titulo="Documento de Identificação (Verso)"
                    tipoDocumento="cc_verso"
                    icone={IdCard}
                    descricao="CC ou Autorização de Residência - Verso (não necessário para Passaporte)"
                  />
                  <DocumentUploadCard
                    titulo="Carta de Condução (Frente)"
                    tipoDocumento="carta_conducao_frente"
                    icone={CreditCard}
                    descricao="Carta de Condução - Frente"
                  />
                  <DocumentUploadCard
                    titulo="Carta de Condução (Verso)"
                    tipoDocumento="carta_conducao_verso"
                    icone={CreditCard}
                    descricao="Carta de Condução - Verso"
                  />
                  <DocumentUploadCard
                    titulo="Licença TVDE"
                    tipoDocumento="licenca_tvde"
                    icone={FileCheck}
                    descricao="Licença TVDE emitida pelo IMT"
                  />
                  <DocumentUploadCard
                    titulo="Registo Criminal"
                    tipoDocumento="registo_criminal"
                    icone={Shield}
                    descricao="Certificado de Registo Criminal"
                  />
                  <DocumentUploadCard
                    titulo="Comprovativo de Morada"
                    tipoDocumento="comprovativo_morada"
                    icone={Home}
                    descricao="Fatura de serviços ou declaração de morada"
                  />
                  <DocumentUploadCard
                    titulo="Comprovativo de IBAN"
                    tipoDocumento="comprovativo_iban"
                    icone={Building}
                    descricao="Documento bancário com IBAN"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Plataformas */}
          <TabsContent value="plataformas" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveDadosMotorista} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Dados das Plataformas</CardTitle>
                <CardDescription>
                  Configurar os emails e telefones utilizados nas plataformas Uber e Bolt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Usar dados de contacto padrão</Label>
                    <p className="text-sm text-slate-500">
                      Usar o mesmo email e telefone do motorista para todas as plataformas
                    </p>
                  </div>
                  <Switch
                    checked={dadosMotorista.usar_dados_padrao_plataformas}
                    onCheckedChange={(checked) => {
                      setDadosMotorista(prev => ({
                        ...prev,
                        usar_dados_padrao_plataformas: checked,
                        email_uber: checked ? prev.email : prev.email_uber,
                        telefone_uber: checked ? prev.phone : prev.telefone_uber,
                        email_bolt: checked ? prev.email : prev.email_bolt,
                        telefone_bolt: checked ? prev.phone : prev.telefone_bolt
                      }));
                    }}
                    disabled={!isEditing}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Uber */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">U</span>
                        </div>
                        Uber
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email Uber
                        </Label>
                        <Input
                          type="email"
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.email : dadosMotorista.email_uber}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, email_uber: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="email@uber.com"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Phone className="w-4 h-4" /> Telefone Uber
                        </Label>
                        <Input
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.phone : dadosMotorista.telefone_uber}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, telefone_uber: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="+351 912 345 678"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bolt */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">B</span>
                        </div>
                        Bolt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email Bolt
                        </Label>
                        <Input
                          type="email"
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.email : dadosMotorista.email_bolt}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, email_bolt: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="email@bolt.com"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Phone className="w-4 h-4" /> Telefone Bolt
                        </Label>
                        <Input
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.phone : dadosMotorista.telefone_bolt}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, telefone_bolt: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="+351 912 345 678"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Veículo */}
          <TabsContent value="veiculo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" /> Veículo Atribuído
                </CardTitle>
              </CardHeader>
              <CardContent>
                {veiculo ? (
                  <div className="space-y-6">
                    {/* Info Principal */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-2xl font-bold">{veiculo.matricula}</p>
                        <p className="text-lg text-slate-600">{veiculo.marca} {veiculo.modelo}</p>
                      </div>
                      <Badge className="text-lg px-4 py-2">{veiculo.ano}</Badge>
                    </div>

                    {/* Detalhes do Contrato */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">Tipo de Contrato</p>
                        <p className="text-lg font-semibold capitalize">
                          {veiculo.tipo_contrato?.tipo === 'aluguer_sem_caucao' ? 'Aluguer sem Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_com_caucao' ? 'Aluguer com Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_caucao_parcelada' ? 'Aluguer com Caução Parcelada' :
                           veiculo.tipo_contrato?.tipo === 'periodo_epoca' ? 'Período de Época' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epocas_sem_caucao' ? 'Aluguer com Épocas sem Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epocas_caucao' ? 'Aluguer com Épocas e Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epoca_caucao_parcelada' ? 'Aluguer Época com Caução Parcelada' :
                           veiculo.tipo_contrato?.tipo === 'compra_veiculo' ? 'Compra de Veículo' :
                           veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão' :
                           veiculo.tipo_contrato?.tipo === 'motorista_privado' ? 'Motorista Privado' :
                           veiculo.tipo_contrato?.tipo || veiculo.tipo_contrato_veiculo || 'N/A'}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">
                          {veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão Motorista' : 'Valor Aluguer'}
                        </p>
                        <p className="text-lg font-semibold text-green-600">
                          {veiculo.tipo_contrato?.tipo === 'comissao' 
                            ? `${veiculo.tipo_contrato?.comissao_motorista || 0}%`
                            : `€${veiculo.tipo_contrato?.valor_aluguer || veiculo.valor_semanal || 0}`}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">Caução</p>
                        <p className="text-lg font-semibold">
                          {veiculo.tipo_contrato?.valor_caucao 
                            ? `€${veiculo.tipo_contrato.valor_caucao}` 
                            : veiculo.tem_caucao 
                              ? `€${veiculo.valor_caucao || 0}` 
                              : 'Sem caução'}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">
                          {veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão Parceiro' : 'Periodicidade'}
                        </p>
                        <p className="text-lg font-semibold capitalize">
                          {veiculo.tipo_contrato?.tipo === 'comissao'
                            ? `${veiculo.tipo_contrato?.comissao_parceiro || 0}%`
                            : veiculo.tipo_contrato?.periodicidade || 'Semanal'}
                        </p>
                      </div>
                    </div>

                    {/* Info Adicional */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Combustível</p>
                        <Badge variant="outline" className="capitalize">
                          {veiculo.combustivel || 'N/A'}
                        </Badge>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Cor</p>
                        <Badge variant="outline" className="capitalize">
                          {veiculo.cor || 'N/A'}
                        </Badge>
                      </div>
                    </div>

                    {/* Seguro */}
                    {veiculo.insurance && (
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Seguro</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{veiculo.insurance.companhia || 'N/A'}</p>
                            <p className="text-sm text-slate-500">Apólice: {veiculo.insurance.numero_apolice || 'N/A'}</p>
                          </div>
                          {getValidadeBadge(veiculo.insurance.data_validade)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Car className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Sem veículo atribuído</p>
                    <p className="text-sm">Este motorista ainda não tem um veículo atribuído</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Financeiro */}
          <TabsContent value="financeiro" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="btn-editar-financeiro">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveConfigFinanceira} disabled={saving} data-testid="btn-guardar-financeiro">
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Acumulação Via Verde */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" /> Acumulação Via Verde
                  </CardTitle>
                  <CardDescription>
                    Acumula valores de Via Verde dos ganhos até ser cobrado no relatório
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Ativar acumulação</Label>
                    <Switch
                      checked={configFinanceira.acumular_viaverde}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, acumular_viaverde: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-acumular-viaverde"
                    />
                  </div>

                  {configFinanceira.acumular_viaverde && (
                    <>
                      <div>
                        <Label>Fonte dos valores</Label>
                        <Select
                          value={configFinanceira.viaverde_fonte}
                          onValueChange={(value) => 
                            setConfigFinanceira(prev => ({ ...prev, viaverde_fonte: value }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger data-testid="select-viaverde-fonte">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uber">Apenas Uber</SelectItem>
                            <SelectItem value="bolt">Apenas Bolt</SelectItem>
                            <SelectItem value="ambos">Uber + Bolt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Valor Acumulado</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="valor-viaverde-acumulado">
                              €{configFinanceira.viaverde_acumulado.toFixed(2)}
                            </p>
                          </div>
                          {configFinanceira.viaverde_acumulado > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleAbaterViaVerde}
                              data-testid="btn-abater-viaverde"
                            >
                              Abater no Relatório
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Gratificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-purple-600" /> Gratificação
                  </CardTitle>
                  <CardDescription>
                    Configuração de gratificações (gorjetas) em contratos de comissão
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Gratificação</Label>
                    <Select
                      value={configFinanceira.gratificacao_tipo}
                      onValueChange={(value) => 
                        setConfigFinanceira(prev => ({ ...prev, gratificacao_tipo: value }))
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-gratificacao-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na_comissao">Na Comissão (incluído no cálculo)</SelectItem>
                        <SelectItem value="fora_comissao">Fora da Comissão (pago separadamente)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span>Gratificações <strong>incluídas</strong> no cálculo da comissão</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Gratificações <strong>pagas separadamente</strong> (100% motorista)</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuração IVA */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Percent className="w-5 h-5 text-blue-600" /> Configuração IVA
                  </CardTitle>
                  <CardDescription>
                    Define se o IVA é incluído ou excluído dos rendimentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Incluir IVA nos rendimentos</Label>
                    <Switch
                      checked={configFinanceira.incluir_iva_rendimentos}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, incluir_iva_rendimentos: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-incluir-iva"
                    />
                  </div>

                  <div>
                    <Label>Percentagem IVA</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={configFinanceira.iva_percentagem}
                        onChange={(e) => 
                          setConfigFinanceira(prev => ({ 
                            ...prev, 
                            iva_percentagem: parseFloat(e.target.value) || 23 
                          }))
                        }
                        disabled={!isEditing}
                        className="w-24"
                        data-testid="input-iva-percentagem"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.incluir_iva_rendimentos ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span>Rendimentos <strong>com IVA</strong> ({configFinanceira.iva_percentagem}%)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Rendimentos <strong>sem IVA</strong> (líquido)</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comissão Personalizada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-orange-600" /> Comissão
                  </CardTitle>
                  <CardDescription>
                    Percentagens de comissão (se diferente do contrato padrão)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Usar comissão personalizada</Label>
                    <Switch
                      checked={configFinanceira.comissao_personalizada}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, comissao_personalizada: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-comissao-personalizada"
                    />
                  </div>

                  {configFinanceira.comissao_personalizada ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Comissão Motorista</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_motorista_percentagem}
                            onChange={(e) => {
                              const motorista = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_motorista_percentagem: motorista,
                                comissao_parceiro_percentagem: 100 - motorista
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Comissão Parceiro</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_parceiro_percentagem}
                            onChange={(e) => {
                              const parceiro = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_parceiro_percentagem: parceiro,
                                comissao_motorista_percentagem: 100 - parceiro
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">
                        A usar comissão do veículo: <strong>
                          {veiculo ? (
                            veiculo.tipo_contrato?.tipo === 'comissao'
                              ? `${veiculo.tipo_contrato?.comissao_motorista || 0}% / ${veiculo.tipo_contrato?.comissao_parceiro || 0}%`
                              : 'N/A (Tipo Aluguer)'
                          ) : 'N/A'}
                        </strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Resumo da Configuração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Via Verde</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.acumular_viaverde ? 'Acumulado' : 'Direto'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Gratificação</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? 'Na Comissão' : 'Separado'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">IVA</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.incluir_iva_rendimentos ? `${configFinanceira.iva_percentagem}%` : 'Excluído'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Comissão</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.comissao_personalizada 
                        ? `${configFinanceira.comissao_motorista_percentagem}/${configFinanceira.comissao_parceiro_percentagem}`
                        : 'Veículo'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Histórico Via Verde */}
            {configFinanceira.acumular_viaverde && historicoViaVerde.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" /> Histórico Via Verde
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {historicoViaVerde.map((item, index) => (
                      <div key={index} className="flex items-center justify-between border-b py-2">
                        <div>
                          <p className="font-medium">{item.descricao || 'Movimento'}</p>
                          <p className="text-sm text-slate-500">{item.created_at?.substring(0, 10)}</p>
                        </div>
                        <div className={`font-bold ${item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.tipo === 'credito' ? '+' : '-'}€{Math.abs(item.valor).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FichaMotorista;
