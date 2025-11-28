import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Download, Save, AlertCircle, CheckCircle, User, FileText, CreditCard, Shield, Phone, MapPin } from 'lucide-react';

const MotoristaDadosPessoaisExpanded = ({ motoristaData, onUpdate, userRole }) => {
  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    // Informações Básicas
    name: motoristaData?.name || '',
    data_nascimento: motoristaData?.data_nascimento || '',
    nacionalidade: motoristaData?.nacionalidade || 'Portuguesa',
    email: motoristaData?.email || '',
    phone: motoristaData?.phone || '',
    whatsapp: motoristaData?.whatsapp || '',
    morada_completa: motoristaData?.morada_completa || '',
    codigo_postal: motoristaData?.codigo_postal || '',
    localidade: motoristaData?.localidade || '',

    // Documento de Identificação
    tipo_documento: motoristaData?.tipo_documento || 'cc',
    numero_documento: motoristaData?.numero_documento || '',
    validade_documento: motoristaData?.validade_documento || '',

    // Documentos Fiscais
    nif: motoristaData?.nif || '',
    numero_seguranca_social: motoristaData?.numero_seguranca_social || '',
    numero_cartao_utente: motoristaData?.numero_cartao_utente || '',

    // Carta de Condução
    numero_carta: motoristaData?.numero_carta || '',
    categoria_carta_conducao: motoristaData?.categoria_carta_conducao || '',
    emissao_carta: motoristaData?.emissao_carta || '',
    validade_carta: motoristaData?.validade_carta || '',

    // Licença TVDE
    numero_licenca_tvde: motoristaData?.numero_licenca_tvde || '',
    validade_licenca_tvde: motoristaData?.validade_licenca_tvde || '',

    // Registo Criminal
    codigo_registo_criminal: motoristaData?.codigo_registo_criminal || '',
    validade_registo_criminal: motoristaData?.validade_registo_criminal || '',

    // Plataformas
    email_uber: motoristaData?.email_uber || '',
    telefone_uber: motoristaData?.telefone_uber || '',
    email_bolt: motoristaData?.email_bolt || '',
    telefone_bolt: motoristaData?.telefone_bolt || '',

    // Dados Bancários
    nome_banco: motoristaData?.nome_banco || '',
    iban: motoristaData?.iban || '',

    // Tipo de Pagamento
    tipo_pagamento: motoristaData?.tipo_pagamento || 'recibo_verde',
    tipo_pagamento_outro: motoristaData?.tipo_pagamento_outro || '',

    // Contacto de Emergência
    emergencia_nome: motoristaData?.emergencia_nome || '',
    emergencia_telefone: motoristaData?.emergencia_telefone || '',
    emergencia_email: motoristaData?.emergencia_email || '',
    emergencia_morada: motoristaData?.emergencia_morada || '',
    emergencia_codigo_postal: motoristaData?.emergencia_codigo_postal || '',
    emergencia_localidade: motoristaData?.emergencia_localidade || '',
    emergencia_ligacao: motoristaData?.emergencia_ligacao || '',

    // Seguro de Acidentes Pessoais
    seguro_numero_apolice: motoristaData?.seguro_numero_apolice || '',
    seguro_seguradora: motoristaData?.seguro_seguradora || '',
    seguro_validade: motoristaData?.seguro_validade || '',
  });

  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const canEdit = ['admin', 'gestao', 'operacional', 'parceiro'].includes(userRole);
  const isMotorista = userRole === 'motorista';
  const documentosAprovados = motoristaData?.documentos_aprovados || false;
  
  // Campos que o motorista pode editar mesmo após aprovação
  const camposEditaveisAposAprovacao = [
    'codigo_registo_criminal', 'validade_registo_criminal',
    'iban', 'nome_banco'
  ];
  
  // Função para verificar se o campo pode ser editado
  const canEditField = (fieldName) => {
    if (canEdit) return true; // Admin, Gestor, Operacional, Parceiro sempre podem editar
    if (isMotorista) {
      if (!documentosAprovados) return true; // Se não aprovado, pode editar tudo
      return camposEditaveisAposAprovacao.includes(fieldName); // Se aprovado, só campos permitidos
    }
    return false;
  };

  // Validação de campos
  const validateField = (field, value) => {
    const validations = {
      nif: /^\d{9}$/,
      numero_seguranca_social: /^\d{11}$/,
      numero_cartao_utente: /^\d{9}$/,
      numero_licenca_tvde: /^\d+\/\d{4}$/,
      codigo_registo_criminal: /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{5}$/,
      iban: /^[A-Z]{2}\d{2}(\s?\d{4}){5}(\s?\d{1,2})?$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      emergencia_email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      phone: /^\+\d{1,3}\s?\d{9}$/,
      whatsapp: /^\+\d{1,3}\s?\d{9}$/,
      telefone_uber: /^\+\d{1,3}\s?\d{9}$/,
      telefone_bolt: /^\+\d{1,3}\s?\d{9}$/,
      emergencia_telefone: /^\+\d{1,3}\s?\d{9}$/,
      codigo_postal: /^\d{4}-\d{3}$/,
      emergencia_codigo_postal: /^\d{4}-\d{3}$/,
    };

    if (!value) return true; // Campo vazio é válido (opcional)
    
    if (validations[field]) {
      return validations[field].test(value);
    }
    return true;
  };

  const getFieldErrorMessage = (field) => {
    const messages = {
      nif: 'NIF deve ter exatamente 9 dígitos',
      numero_seguranca_social: 'Número de Segurança Social deve ter 11 dígitos',
      numero_cartao_utente: 'Cartão de Utente deve ter 9 dígitos',
      numero_licenca_tvde: 'Formato: números/ano (ex: 12345/2024)',
      codigo_registo_criminal: 'Formato: xxxx-xxxx-xxxx-xxxxx',
      iban: 'Formato: PT50 0035 0268 00038229130 61',
      email: 'Email inválido (deve conter @ e domínio)',
      emergencia_email: 'Email inválido (deve conter @ e domínio)',
      phone: 'Formato: +351 912345678',
      whatsapp: 'Formato: +351 912345678',
      telefone_uber: 'Formato: +351 912345678',
      telefone_bolt: 'Formato: +351 912345678',
      emergencia_telefone: 'Formato: +351 912345678',
      codigo_postal: 'Formato: 1234-567',
      emergencia_codigo_postal: 'Formato: 1234-567',
    };
    return messages[field] || 'Campo inválido';
  };
  
  const canEditDocument = (docType) => {
    // IBAN e Registo Criminal sempre podem ser editados
    if (docType === 'comprovativo_iban' || docType === 'registo_criminal') {
      return true;
    }
    
    // Admin/Gestor/Operacional/Parceiro sempre podem editar
    if (canEdit) {
      return true;
    }
    
    // Motorista: verificar se documento está validado
    if (isMotorista) {
      const validacao = motoristaData?.documents_validacao?.[docType];
      // Se não tem validação ou não está validado, pode editar
      return !validacao || !validacao.validado;
    }
    
    return false;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
    // Validar campo em tempo real
    const isValid = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: isValid ? null : getFieldErrorMessage(field)
    }));
  };

  const handleSave = async () => {
    // Validar todos os campos antes de guardar
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      if (formData[field] && !validateField(field, formData[field])) {
        newErrors[field] = getFieldErrorMessage(field);
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor, corrija os erros antes de guardar');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaData.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Dados guardados com sucesso!');
      setHasUnsavedChanges(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  // Exportar função para verificar mudanças não guardadas
  useEffect(() => {
    window.hasUnsavedChanges = () => hasUnsavedChanges;
    
    return () => {
      window.hasUnsavedChanges = null;
    };
  }, [hasUnsavedChanges]);

  const handleFileUpload = async (docType, file) => {
    if (!file) return;

    // Verificar se motorista pode fazer upload após aprovação
    const documentosPermitidosAposAprovacao = ['comprovativo_iban', 'registo_criminal', 'comprovativo_seguro'];
    
    if (isMotorista && documentosAprovados && !documentosPermitidosAposAprovacao.includes(docType)) {
      toast.error('Documentos aprovados. Apenas IBAN, Registo Criminal e Seguro podem ser alterados. Contacte o gestor.');
      return;
    }

    setUploading(prev => ({ ...prev, [docType]: true }));

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('doc_type', docType);

      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/motoristas/${motoristaData.id}/upload-document`,
        formDataUpload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Documento enviado com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar documento');
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const triggerFileUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleFileUpload(docType, file);
    };
    input.click();
  };

  const handleDownload = (docUrl) => {
    if (!docUrl) {
      toast.error('Documento não encontrado');
      return;
    }
    window.open(`${API.replace('/api', '')}/${docUrl}`, '_blank');
  };

  const handleDownloadDocumento = async (docType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/motoristas/${motoristaData.id}/documento/${docType}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${motoristaData.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Documento descarregado com sucesso!');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao descarregar documento');
    }
  };

  const handleDownloadContrato = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/motoristas/${motoristaData.id}/contrato/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${motoristaData.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Contrato descarregado com sucesso!');
    } catch (error) {
      console.error('Error downloading contract:', error);
      if (error.response?.status === 404) {
        toast.error('Contrato não encontrado');
      } else {
        toast.error('Erro ao descarregar contrato');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Avisos */}
      {isMotorista && !documentosAprovados && (
        <Card className="border-l-4 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Importante:</p>
                <p>Após preencher os dados, estes serão validados por um administrador ou gestor antes de serem confirmados.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {isMotorista && documentosAprovados && (
        <Card className="border-l-4 border-green-500">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold mb-1">Documentos Aprovados:</p>
                <p>Os seus documentos foram validados. Apenas o Registo Criminal e IBAN podem ser alterados. Para outras alterações, contacte o gestor ou administrador.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentos em Falta */}
      {isMotorista && (() => {
        const documentosObrigatorios = [
          { key: 'cc_frente', label: 'Cartão de Cidadão - Frente' },
          { key: 'cc_verso', label: 'Cartão de Cidadão - Verso' },
          { key: 'carta_conducao_frente', label: 'Carta de Condução - Frente' },
          { key: 'carta_conducao_verso', label: 'Carta de Condução - Verso' },
          { key: 'licenca_tvde', label: 'Licença TVDE' },
          { key: 'registo_criminal', label: 'Registo Criminal' },
          { key: 'comprovativo_iban', label: 'Comprovativo IBAN' },
          { key: 'comprovativo_morada', label: 'Comprovativo de Morada' }
        ];
        
        // Se documentos_aprovados = true, considerar tudo validado
        const documentosEmFalta = motoristaData?.documentos_aprovados 
          ? [] 
          : documentosObrigatorios.filter(doc => {
              const hasDocument = motoristaData?.documents?.[doc.key];
              const isValidated = motoristaData?.documents_validacao?.[doc.key]?.validado;
              // Documento está em falta se não foi carregado OU se foi carregado mas não foi validado
              return !hasDocument || !isValidated;
            });

        if (documentosEmFalta.length > 0) {
          return (
            <Card className="border-l-4 border-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-2">Documentos em Falta ({documentosEmFalta.length}):</p>
                    <ul className="list-disc list-inside space-y-1">
                      {documentosEmFalta.map(doc => (
                        <li key={doc.key}>{doc.label}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">Por favor, carregue todos os documentos obrigatórios para completar o seu perfil.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        } else {
          return (
            <Card className="border-l-4 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold mb-2">Documentos Completos (0 em falta)</p>
                    <p>Todos os documentos obrigatórios foram carregados e validados.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
      })()}

      {/* Seção de Downloads */}
      {isMotorista && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-blue-600" />
              <CardTitle>Meus Downloads</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Contrato */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-800">Contrato</p>
                  <p className="text-xs text-slate-600">Contrato assinado com parceiro</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadContrato}
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Descarregar
              </Button>
            </div>

            {/* Recibos */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-800">Recibos</p>
                  <p className="text-xs text-slate-600">Recibos de ganhos semanais</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = '/recibos-ganhos'}
                className="border-green-500 text-green-600 hover:bg-green-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Recibos
              </Button>
            </div>

            {/* Relatórios de Ganhos */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-800">Relatórios de Ganhos</p>
                  <p className="text-xs text-slate-600">Histórico de ganhos semanais</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = '/recibos-ganhos'}
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Relatórios
              </Button>
            </div>

            {/* Documentos Aprovados */}
            {documentosAprovados && (
              <div className="pt-3">
                <p className="text-sm font-semibold text-slate-700 mb-3">Documentos Aprovados:</p>
                <div className="space-y-2">
                  {[
                    { type: 'documento_identificacao_frente', label: 'CC Frente' },
                    { type: 'documento_identificacao_verso', label: 'CC Verso' },
                    { type: 'comprovativo_morada', label: 'Comprovativo Morada' },
                    { type: 'carta_conducao_frente', label: 'Carta Frente' },
                    { type: 'carta_conducao_verso', label: 'Carta Verso' },
                    { type: 'licenca_tvde', label: 'Licença TVDE' },
                    { type: 'registo_criminal', label: 'Registo Criminal' },
                    { type: 'comprovativo_iban', label: 'Comprovativo IBAN' },
                    { type: 'comprovativo_seguro', label: 'Comprovativo Seguro' }
                  ].map(doc => (
                    motoristaData?.documents?.[doc.type] && (
                      <Button
                        key={doc.type}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadDocumento(doc.type)}
                        className="w-full justify-start text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {doc.label}
                      </Button>
                    )
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 1. INFORMAÇÕES BÁSICAS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle>Informações Básicas</CardTitle>
            </div>
            {(canEdit || isMotorista) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? 'Cancelar Edição' : 'Editar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!editMode}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Data de Nascimento *</Label>
              <Input
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => handleChange('data_nascimento', e.target.value)}
                disabled={!canEdit && !isMotorista}
              />
            </div>
            <div>
              <Label>Nacionalidade *</Label>
              <Select 
                value={formData.nacionalidade} 
                onValueChange={(val) => handleChange('nacionalidade', val)}
                disabled={!canEdit && !isMotorista}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a nacionalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Portuguesa">Portuguesa</SelectItem>
                  <SelectItem value="Brasileira">Brasileira</SelectItem>
                  <SelectItem value="Angolana">Angolana</SelectItem>
                  <SelectItem value="Cabo-verdiana">Cabo-verdiana</SelectItem>
                  <SelectItem value="Moçambicana">Moçambicana</SelectItem>
                  <SelectItem value="Outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={!editMode}
                placeholder="email@exemplo.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!editMode}
                placeholder="+351 912345678"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                disabled={!editMode}
                placeholder="+351 912345678"
                className={errors.whatsapp ? 'border-red-500' : ''}
              />
              {errors.whatsapp && <p className="text-xs text-red-500 mt-1">{errors.whatsapp}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>Morada Completa *</Label>
              <Input
                value={formData.morada_completa}
                onChange={(e) => handleChange('morada_completa', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="Rua, Número, Andar"
              />
            </div>
            <div>
              <Label>Código Postal *</Label>
              <Input
                value={formData.codigo_postal}
                onChange={(e) => handleChange('codigo_postal', e.target.value)}
                disabled={!editMode}
                placeholder="1234-567"
                maxLength={8}
                className={errors.codigo_postal ? 'border-red-500' : ''}
              />
              {errors.codigo_postal && <p className="text-xs text-red-500 mt-1">{errors.codigo_postal}</p>}
            </div>
            <div>
              <Label>Localidade *</Label>
              <Input
                value={formData.localidade}
                onChange={(e) => handleChange('localidade', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="Lisboa, Porto, etc."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. DOCUMENTO DE IDENTIFICAÇÃO */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <CardTitle>Documento de Identificação</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Documento *</Label>
              <Select 
                value={formData.tipo_documento} 
                onValueChange={(val) => handleChange('tipo_documento', val)}
                disabled={!canEdit && !isMotorista}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cc">Cartão de Cidadão</SelectItem>
                  <SelectItem value="residencia">Título de Residência</SelectItem>
                  <SelectItem value="passaporte">Passaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número do Documento *</Label>
              <Input
                value={formData.numero_documento}
                onChange={(e) => handleChange('numero_documento', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="Número"
              />
            </div>
            <div>
              <Label>Validade *</Label>
              <Input
                type="date"
                value={formData.validade_documento}
                onChange={(e) => handleChange('validade_documento', e.target.value)}
                disabled={!canEdit && !isMotorista}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <Label className="mb-2 block">Documento - Frente *</Label>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerFileUpload('documento_identificacao_frente')}
                  disabled={uploading.documento_identificacao_frente}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading.documento_identificacao_frente ? 'A enviar...' : 'Carregar'}
                </Button>
                {motoristaData?.documents?.documento_identificacao_frente && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(motoristaData.documents.documento_identificacao_frente)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {(formData.tipo_documento === 'cc' || formData.tipo_documento === 'residencia') && (
              <div className="border rounded p-4">
                <Label className="mb-2 block">Documento - Verso *</Label>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerFileUpload('documento_identificacao_verso')}
                    disabled={uploading.documento_identificacao_verso}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading.documento_identificacao_verso ? 'A enviar...' : 'Carregar'}
                  </Button>
                  {motoristaData?.documents?.documento_identificacao_verso && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(motoristaData.documents.documento_identificacao_verso)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border rounded p-4">
            <Label className="mb-2 block">Comprovativo de Morada *</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerFileUpload('comprovativo_morada')}
                disabled={uploading.comprovativo_morada}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading.comprovativo_morada ? 'A enviar...' : 'Carregar'}
              </Button>
              {motoristaData?.documents?.comprovativo_morada && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(motoristaData.documents.comprovativo_morada)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. DOCUMENTOS FISCAIS */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-green-600" />
            <CardTitle>Documentos Fiscais e Identificação</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>NIF * (9 dígitos)</Label>
              <Input
                value={formData.nif}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleChange('nif', value);
                }}
                disabled={!editMode}
                placeholder="123456789"
                maxLength={9}
                className={errors.nif ? 'border-red-500' : ''}
              />
              {errors.nif && <p className="text-xs text-red-500 mt-1">{errors.nif}</p>}
            </div>
            <div>
              <Label>Número Segurança Social * (11 dígitos)</Label>
              <Input
                value={formData.numero_seguranca_social}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleChange('numero_seguranca_social', value);
                }}
                disabled={!editMode}
                placeholder="12345678901"
                maxLength={11}
                className={errors.numero_seguranca_social ? 'border-red-500' : ''}
              />
              {errors.numero_seguranca_social && <p className="text-xs text-red-500 mt-1">{errors.numero_seguranca_social}</p>}
            </div>
            <div>
              <Label>Cartão de Utente SNS (9 dígitos)</Label>
              <Input
                value={formData.numero_cartao_utente}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleChange('numero_cartao_utente', value);
                }}
                disabled={!editMode}
                placeholder="123456789"
                maxLength={9}
                className={errors.numero_cartao_utente ? 'border-red-500' : ''}
              />
              {errors.numero_cartao_utente && <p className="text-xs text-red-500 mt-1">{errors.numero_cartao_utente}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. CARTA DE CONDUÇÃO */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-orange-600" />
            <CardTitle>Carta de Condução</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Número da Carta *</Label>
              <Input
                value={formData.numero_carta}
                onChange={(e) => handleChange('numero_carta', e.target.value)}
                disabled={!editMode}
                placeholder="Número"
              />
            </div>
            <div>
              <Label>Categoria *</Label>
              <Input
                value={formData.categoria_carta_conducao}
                onChange={(e) => handleChange('categoria_carta_conducao', e.target.value)}
                disabled={!editMode}
                placeholder="B, B+E, C, D"
              />
            </div>
            <div>
              <Label>Data de Emissão *</Label>
              <Input
                type="date"
                value={formData.emissao_carta}
                onChange={(e) => handleChange('emissao_carta', e.target.value)}
                disabled={!editMode}
              />
            </div>
            <div>
              <Label>Validade *</Label>
              <Input
                type="date"
                value={formData.validade_carta}
                onChange={(e) => handleChange('validade_carta', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <Label className="mb-2 block">Carta - Frente *</Label>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerFileUpload('carta_conducao_frente')}
                  disabled={uploading.carta_conducao_frente}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading.carta_conducao_frente ? 'A enviar...' : 'Carregar'}
                </Button>
                {motoristaData?.documents?.carta_conducao_frente && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(motoristaData.documents.carta_conducao_frente)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="border rounded p-4">
              <Label className="mb-2 block">Carta - Verso *</Label>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerFileUpload('carta_conducao_verso')}
                  disabled={uploading.carta_conducao_verso}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading.carta_conducao_verso ? 'A enviar...' : 'Carregar'}
                </Button>
                {motoristaData?.documents?.carta_conducao_verso && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(motoristaData.documents.carta_conducao_verso)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. LICENÇA TVDE */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <CardTitle>Licença TVDE</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Número da Licença TVDE * (formato: números/ano)</Label>
              <Input
                value={formData.numero_licenca_tvde}
                onChange={(e) => handleChange('numero_licenca_tvde', e.target.value)}
                disabled={!editMode}
                placeholder="12345/2024"
                className={errors.numero_licenca_tvde ? 'border-red-500' : ''}
              />
              {errors.numero_licenca_tvde && <p className="text-xs text-red-500 mt-1">{errors.numero_licenca_tvde}</p>}
            </div>
            <div>
              <Label>Validade *</Label>
              <Input
                type="date"
                value={formData.validade_licenca_tvde}
                onChange={(e) => handleChange('validade_licenca_tvde', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>

          <div className="border rounded p-4">
            <Label className="mb-2 block">Documento Licença TVDE *</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerFileUpload('licenca_tvde')}
                disabled={uploading.licenca_tvde}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading.licenca_tvde ? 'A enviar...' : 'Carregar'}
              </Button>
              {motoristaData?.documents?.licenca_tvde && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(motoristaData.documents.licenca_tvde)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. REGISTO CRIMINAL */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-red-600" />
            <CardTitle>Registo Criminal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Código do Registo Criminal * (formato: xxxx-xxxx-xxxx-xxxxx)</Label>
              <Input
                value={formData.codigo_registo_criminal}
                onChange={(e) => handleChange('codigo_registo_criminal', e.target.value.toUpperCase())}
                disabled={!editMode}
                placeholder="ABCD-1234-EFGH-5678I"
                maxLength={24}
                className={errors.codigo_registo_criminal ? 'border-red-500' : ''}
              />
              {errors.codigo_registo_criminal && <p className="text-xs text-red-500 mt-1">{errors.codigo_registo_criminal}</p>}
            </div>
            <div>
              <Label>Validade *</Label>
              <Input
                type="date"
                value={formData.validade_registo_criminal}
                onChange={(e) => handleChange('validade_registo_criminal', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>

          <div className="border rounded p-4">
            <Label className="mb-2 block">Documento Registo Criminal *</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerFileUpload('registo_criminal')}
                disabled={uploading.registo_criminal}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading.registo_criminal ? 'A enviar...' : 'Carregar'}
              </Button>
              {motoristaData?.documents?.registo_criminal && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(motoristaData.documents.registo_criminal)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. PLATAFORMAS (UBER / BOLT) */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-indigo-600" />
            <CardTitle>Plataformas Uber e Bolt</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">Preencha apenas se usar email ou telefone diferente do principal</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700">Uber</h3>
              <div>
                <Label>Email Uber</Label>
                <Input
                  type="email"
                  value={formData.email_uber}
                  onChange={(e) => handleChange('email_uber', e.target.value)}
                  disabled={!canEdit && !isMotorista}
                  placeholder="email.uber@exemplo.com"
                />
              </div>
              <div>
                <Label>Telefone Uber</Label>
                <Input
                  value={formData.telefone_uber}
                  onChange={(e) => handleChange('telefone_uber', e.target.value)}
                  disabled={!editMode}
                  placeholder="+351 912345678"
                  className={errors.telefone_uber ? 'border-red-500' : ''}
                />
                {errors.telefone_uber && <p className="text-xs text-red-500 mt-1">{errors.telefone_uber}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700">Bolt</h3>
              <div>
                <Label>Email Bolt</Label>
                <Input
                  type="email"
                  value={formData.email_bolt}
                  onChange={(e) => handleChange('email_bolt', e.target.value)}
                  disabled={!editMode}
                  placeholder="email.bolt@exemplo.com"
                />
              </div>
              <div>
                <Label>Telefone Bolt</Label>
                <Input
                  value={formData.telefone_bolt}
                  onChange={(e) => handleChange('telefone_bolt', e.target.value)}
                  disabled={!editMode}
                  placeholder="+351 912345678"
                  className={errors.telefone_bolt ? 'border-red-500' : ''}
                />
                {errors.telefone_bolt && <p className="text-xs text-red-500 mt-1">{errors.telefone_bolt}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8. DADOS BANCÁRIOS */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-teal-600" />
            <CardTitle>Dados Bancários</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Banco *</Label>
              <Input
                value={formData.nome_banco}
                onChange={(e) => handleChange('nome_banco', e.target.value)}
                disabled={!editMode}
                placeholder="Ex: Caixa Geral de Depósitos"
              />
            </div>
            <div>
              <Label>IBAN * (formato: PT50 0000 0000 0000 0000 0000 0)</Label>
              <Input
                value={formData.iban}
                onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                disabled={!editMode}
                placeholder="PT50 0035 0268 00038229130 61"
                maxLength={34}
                className={errors.iban ? 'border-red-500' : ''}
              />
              {errors.iban && <p className="text-xs text-red-500 mt-1">{errors.iban}</p>}
            </div>
          </div>

          <div className="border rounded p-4">
            <Label className="mb-2 block">Comprovativo IBAN *</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerFileUpload('comprovativo_iban')}
                disabled={uploading.comprovativo_iban}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading.comprovativo_iban ? 'A enviar...' : 'Carregar'}
              </Button>
              {motoristaData?.documents?.comprovativo_iban && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(motoristaData.documents.comprovativo_iban)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 9. TIPO DE PAGAMENTO */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <CardTitle>Sistema de Pagamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tipo de Pagamento *</Label>
            <Select 
              value={formData.tipo_pagamento} 
              onValueChange={(val) => handleChange('tipo_pagamento', val)}
              disabled={!canEdit && !isMotorista}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                <SelectItem value="fatura">Fatura</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo_pagamento === 'outro' && (
            <div>
              <Label>Especifique o Tipo de Pagamento</Label>
              <Textarea
                value={formData.tipo_pagamento_outro}
                onChange={(e) => handleChange('tipo_pagamento_outro', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="Descreva o tipo de pagamento..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10. CONTACTO DE EMERGÊNCIA */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-slate-600" />
            <CardTitle>Contacto de Emergência (Opcional)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={formData.emergencia_nome}
                onChange={(e) => handleChange('emergencia_nome', e.target.value)}
                disabled={!editMode}
                placeholder="Nome do contacto"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.emergencia_telefone}
                onChange={(e) => handleChange('emergencia_telefone', e.target.value)}
                disabled={!editMode}
                placeholder="+351 912345678"
                className={errors.emergencia_telefone ? 'border-red-500' : ''}
              />
              {errors.emergencia_telefone && <p className="text-xs text-red-500 mt-1">{errors.emergencia_telefone}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.emergencia_email}
                onChange={(e) => handleChange('emergencia_email', e.target.value)}
                disabled={!editMode}
                placeholder="email@exemplo.com"
                className={errors.emergencia_email ? 'border-red-500' : ''}
              />
              {errors.emergencia_email && <p className="text-xs text-red-500 mt-1">{errors.emergencia_email}</p>}
            </div>
            <div>
              <Label>Ligação</Label>
              <Select 
                value={formData.emergencia_ligacao} 
                onValueChange={(val) => handleChange('emergencia_ligacao', val)}
                disabled={!editMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de ligação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mae">Mãe</SelectItem>
                  <SelectItem value="pai">Pai</SelectItem>
                  <SelectItem value="irmao">Irmão/Irmã</SelectItem>
                  <SelectItem value="conjuge">Cônjuge</SelectItem>
                  <SelectItem value="filho">Filho/Filha</SelectItem>
                  <SelectItem value="amigo">Amigo/Amiga</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Morada</Label>
              <Input
                value={formData.emergencia_morada}
                onChange={(e) => handleChange('emergencia_morada', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="Morada completa"
              />
            </div>
            <div>
              <Label>Código Postal</Label>
              <Input
                value={formData.emergencia_codigo_postal}
                onChange={(e) => handleChange('emergencia_codigo_postal', e.target.value)}
                disabled={!editMode}
                placeholder="1234-567"
                maxLength={8}
                className={errors.emergencia_codigo_postal ? 'border-red-500' : ''}
              />
              {errors.emergencia_codigo_postal && <p className="text-xs text-red-500 mt-1">{errors.emergencia_codigo_postal}</p>}
            </div>
            <div>
              <Label>Localidade</Label>
              <Input
                value={formData.emergencia_localidade}
                onChange={(e) => handleChange('emergencia_localidade', e.target.value)}
                disabled={!editMode}
                placeholder="Lisboa, Porto, etc."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 11. SEGURO DE ACIDENTES PESSOAIS */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-slate-600" />
            <CardTitle>Seguro de Acidentes Pessoais (Opcional)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Número da Apólice</Label>
              <Input
                value={formData.seguro_numero_apolice}
                onChange={(e) => handleChange('seguro_numero_apolice', e.target.value)}
                disabled={!editMode}
                placeholder="Número da apólice"
              />
            </div>
            <div>
              <Label>Seguradora</Label>
              <Input
                value={formData.seguro_seguradora}
                onChange={(e) => handleChange('seguro_seguradora', e.target.value)}
                disabled={!editMode}
                placeholder="Nome da seguradora"
              />
            </div>
            <div>
              <Label>Validade</Label>
              <Input
                type="date"
                value={formData.seguro_validade}
                onChange={(e) => handleChange('seguro_validade', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>

          <div className="border rounded p-4">
            <Label className="mb-2 block">Comprovativo de Seguro</Label>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerFileUpload('seguro_comprovativo')}
                disabled={uploading.seguro_comprovativo}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading.seguro_comprovativo ? 'A enviar...' : 'Carregar'}
              </Button>
              {motoristaData?.documents?.seguro_comprovativo && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(motoristaData.documents.seguro_comprovativo)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Guardar no final */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'A guardar...' : 'Guardar Todos os Dados'}
        </Button>
      </div>
    </div>
  );
};

export default MotoristaDadosPessoaisExpanded;
