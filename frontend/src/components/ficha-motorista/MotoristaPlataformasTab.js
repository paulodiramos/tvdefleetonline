import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Save, Edit, Mail, Phone, Hash, CreditCard, Zap 
} from 'lucide-react';

const MotoristaPlataformasTab = ({
  dadosMotorista,
  setDadosMotorista,
  isEditing,
  setIsEditing,
  saving,
  onSave
}) => {
  return (
    <>
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
            <Button onClick={onSave} disabled={saving}>
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
                    <Hash className="w-4 h-4" /> ID Uber (UUID)
                  </Label>
                  <Input
                    value={dadosMotorista.uuid_motorista_uber || ''}
                    onChange={(e) => setDadosMotorista(prev => ({ ...prev, uuid_motorista_uber: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="UUID do motorista na Uber"
                    className="font-mono text-sm"
                    data-testid="input-uuid-uber"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para identificar o motorista nas importações Uber
                  </p>
                </div>
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
                    <Hash className="w-4 h-4" /> ID Bolt
                  </Label>
                  <Input
                    value={dadosMotorista.identificador_motorista_bolt || ''}
                    onChange={(e) => setDadosMotorista(prev => ({ ...prev, identificador_motorista_bolt: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="ID do motorista na Bolt"
                    className="font-mono text-sm"
                    data-testid="input-id-bolt"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para identificar o motorista nas importações Bolt
                  </p>
                </div>
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

            {/* Energia */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Energia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Contacto de Energia
                  </Label>
                  <Input
                    value={dadosMotorista.contacto_energia || ''}
                    onChange={(e) => setDadosMotorista(prev => ({ ...prev, contacto_energia: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="ID do cartão ou contacto de energia"
                    data-testid="input-contacto-energia"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para identificar o motorista nas importações de carregamentos elétricos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default MotoristaPlataformasTab;
