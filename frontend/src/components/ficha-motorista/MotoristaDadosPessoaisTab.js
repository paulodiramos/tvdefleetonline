import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, Mail, Phone, CreditCard, Home, Shield, FileCheck, IdCard, 
  MessageCircle, AlertCircle, Save, Edit 
} from 'lucide-react';

// Helper para classe de input preenchido
const getFilledInputClass = (value) => {
  return value && value.toString().trim() !== '' 
    ? 'bg-slate-50 text-slate-900 font-medium border-slate-300' 
    : '';
};

const MotoristaDadosPessoaisTab = ({
  dadosMotorista,
  setDadosMotorista,
  isEditing,
  setIsEditing,
  saving,
  onSave,
  calcularIdade,
  getAniversarioBadge,
  getValidadeBadge,
  isDocumentoProximoExpirar,
  isDocumentoExpirado
}) => {
  return (
    <>
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
            <Button onClick={onSave} disabled={saving}>
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
                className={getFilledInputClass(dadosMotorista.iban)}
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

        {/* Contacto de Emergência */}
        <Card className="md:col-span-2 border-orange-200 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
              <Shield className="w-5 h-5" /> Contacto de Emergência
            </CardTitle>
            <CardDescription>Pessoa a contactar em caso de emergência</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Nome Completo</Label>
                <Input
                  placeholder="Nome do contacto"
                  value={dadosMotorista.emergencia_nome}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_nome: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_nome)}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  placeholder="+351 9XX XXX XXX"
                  value={dadosMotorista.emergencia_telefone}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_telefone: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_telefone)}
                />
              </div>
              <div>
                <Label>Parentesco/Ligação</Label>
                <Input
                  placeholder="Ex: Cônjuge, Pai, Mãe, Irmão..."
                  value={dadosMotorista.emergencia_parentesco}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_parentesco: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_parentesco)}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={dadosMotorista.emergencia_email}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_email: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_email)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Morada</Label>
                <Input
                  placeholder="Morada completa"
                  value={dadosMotorista.emergencia_morada}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_morada: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_morada)}
                />
              </div>
              <div>
                <Label>Código Postal</Label>
                <Input
                  placeholder="XXXX-XXX"
                  value={dadosMotorista.emergencia_codigo_postal}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_codigo_postal: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_codigo_postal)}
                />
              </div>
              <div>
                <Label>Localidade</Label>
                <Input
                  placeholder="Cidade"
                  value={dadosMotorista.emergencia_localidade}
                  onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_localidade: e.target.value }))}
                  disabled={!isEditing}
                  className={getFilledInputClass(dadosMotorista.emergencia_localidade)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MotoristaDadosPessoaisTab;
