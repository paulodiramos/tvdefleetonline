import { useState } from 'react';
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
    emergencia_ligacao: motoristaData?.emergencia_ligacao || '',

    // Seguro de Acidentes Pessoais
    seguro_numero_apolice: motoristaData?.seguro_numero_apolice || '',
    seguro_seguradora: motoristaData?.seguro_seguradora || '',
    seguro_validade: motoristaData?.seguro_validade || '',
  });

  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);

  const canEdit = ['admin', 'gestao', 'operacional'].includes(userRole);
  const isMotorista = userRole === 'motorista';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaData.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Dados guardados com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (docType, file) => {
    if (!file) return;

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
      toast.error('Erro ao enviar documento');
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

  return (
    <div className="space-y-6">
      {/* Avisos */}
      {isMotorista && (
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

      {/* 1. INFORMAÇÕES BÁSICAS */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle>Informações Básicas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!canEdit && !isMotorista}
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
                disabled={!canEdit && !isMotorista}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="+351 912 345 678"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                disabled={!canEdit && !isMotorista}
                placeholder="+351 912 345 678"
              />
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
                disabled={!canEdit && !isMotorista}
                placeholder="1234-567"
                maxLength={8}
              />
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

      {/* Botão Guardar no final */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'A guardar...' : 'Guardar Dados'}
        </Button>
      </div>
    </div>
  );
};

export default MotoristaDadosPessoaisExpanded;
