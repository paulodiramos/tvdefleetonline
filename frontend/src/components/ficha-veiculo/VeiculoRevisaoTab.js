import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Wrench, Calendar, Bell, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';

const VeiculoRevisaoTab = ({ 
  vehicle, 
  revisaoForm, 
  setRevisaoForm,
  alertasConfig,
  setAlertasConfig,
  planoManutencao,
  setPlanoManutencao,
  historicoManutencoes,
  editMode,
  canEdit,
  user,
  onSaveRevisao,
  onAddManutencao,
  onDeleteManutencao
}) => {
  const [novaManutencao, setNovaManutencao] = useState({
    tipo: '',
    km_proximo: '',
    data_proxima: '',
    observacoes: ''
  });

  const tiposManutencao = [
    { value: 'oleo', label: 'Mudança de Óleo' },
    { value: 'filtros', label: 'Substituição de Filtros' },
    { value: 'travoes', label: 'Revisão de Travões' },
    { value: 'pneus', label: 'Rotação/Substituição de Pneus' },
    { value: 'correias', label: 'Correias' },
    { value: 'baterias', label: 'Bateria' },
    { value: 'ar_condicionado', label: 'Ar Condicionado' },
    { value: 'injecao', label: 'Sistema de Injeção' },
    { value: 'suspensao', label: 'Suspensão' },
    { value: 'outro', label: 'Outro' }
  ];

  const handleToggleAlerta = (tipo, enabled) => {
    if (setAlertasConfig) {
      setAlertasConfig(prev => ({
        ...prev,
        [tipo]: { ...prev[tipo], enabled }
      }));
    }
  };

  const handleAddManutencao = () => {
    if (!novaManutencao.tipo) {
      toast.error('Selecione o tipo de manutenção');
      return;
    }
    if (!novaManutencao.km_proximo && !novaManutencao.data_proxima) {
      toast.error('Defina KM ou Data da próxima manutenção');
      return;
    }
    
    if (onAddManutencao) {
      onAddManutencao(novaManutencao);
    }
    setNovaManutencao({ tipo: '', km_proximo: '', data_proxima: '', observacoes: '' });
  };

  if (!vehicle) return null;

  return (
    <div className="space-y-4">
      {/* Próxima Revisão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="w-5 h-5" />
            <span>Próxima Revisão</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proxima_revisao_km">Próxima Revisão (KM)</Label>
              <Input
                id="proxima_revisao_km"
                type="number"
                value={revisaoForm?.proxima_revisao_km || ''}
                onChange={(e) => setRevisaoForm && setRevisaoForm({...revisaoForm, proxima_revisao_km: e.target.value})}
                disabled={!canEdit || !editMode}
                placeholder="Ex: 150000"
              />
            </div>
            <div>
              <Label htmlFor="proxima_revisao_data">Próxima Revisão (Data)</Label>
              <Input
                id="proxima_revisao_data"
                type="date"
                value={revisaoForm?.proxima_revisao_data || ''}
                onChange={(e) => setRevisaoForm && setRevisaoForm({...revisaoForm, proxima_revisao_data: e.target.value})}
                disabled={!canEdit || !editMode}
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Defina a próxima revisão por KM ou Data (ou ambos)
          </p>
        </CardContent>
      </Card>

      {/* Plano de Manutenções e Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Plano de Manutenções e Alertas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alertas" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="alertas">Alertas</TabsTrigger>
              <TabsTrigger value="plano">Plano de Manutenção</TabsTrigger>
            </TabsList>

            {/* Tab Alertas */}
            <TabsContent value="alertas" className="space-y-4">
              {canEdit && editMode && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <strong>Modo Edição Ativo:</strong> Pode configurar os alertas deste veículo
                  </p>
                </div>
              )}
              <div className="bg-amber-50 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Configurar Alertas para este Veículo
                </h4>
                <div className="space-y-3">
                  {/* Alerta de Revisão */}
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div>
                      <p className="font-medium">Alerta de Revisão</p>
                      <p className="text-sm text-slate-500">Notificar antes da próxima revisão</p>
                    </div>
                    <Switch
                      checked={alertasConfig?.revisao?.enabled || false}
                      onCheckedChange={(checked) => handleToggleAlerta('revisao', checked)}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  {/* Alerta de KM */}
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div>
                      <p className="font-medium">Alerta por KM</p>
                      <p className="text-sm text-slate-500">Notificar quando atingir KM definido</p>
                    </div>
                    <Switch
                      checked={alertasConfig?.km?.enabled || false}
                      onCheckedChange={(checked) => handleToggleAlerta('km', checked)}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                  {/* Alerta de Pneus */}
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div>
                      <p className="font-medium">Alerta de Pneus</p>
                      <p className="text-sm text-slate-500">Notificar para substituição de pneus</p>
                    </div>
                    <Switch
                      checked={alertasConfig?.pneus?.enabled || false}
                      onCheckedChange={(checked) => handleToggleAlerta('pneus', checked)}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab Plano */}
            <TabsContent value="plano" className="space-y-4">
              {canEdit && editMode && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Adicionar Manutenção</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>Tipo</Label>
                      <select
                        className="w-full p-2 border rounded"
                        value={novaManutencao.tipo}
                        onChange={(e) => setNovaManutencao({...novaManutencao, tipo: e.target.value})}
                      >
                        <option value="">Selecionar...</option>
                        {tiposManutencao.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>KM Próximo</Label>
                      <Input
                        type="number"
                        value={novaManutencao.km_proximo}
                        onChange={(e) => setNovaManutencao({...novaManutencao, km_proximo: e.target.value})}
                        placeholder="Ex: 150000"
                      />
                    </div>
                    <div>
                      <Label>Data Próxima</Label>
                      <Input
                        type="date"
                        value={novaManutencao.data_proxima}
                        onChange={(e) => setNovaManutencao({...novaManutencao, data_proxima: e.target.value})}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddManutencao} className="w-full">
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Manutenções Planeadas */}
              <div className="space-y-2">
                <h4 className="font-semibold">Manutenções Planeadas</h4>
                {planoManutencao && planoManutencao.length > 0 ? (
                  planoManutencao.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded border">
                      <div>
                        <p className="font-medium">
                          {tiposManutencao.find(t => t.value === m.tipo)?.label || m.tipo}
                        </p>
                        <p className="text-sm text-slate-500">
                          {m.km_proximo && `${m.km_proximo} KM`}
                          {m.km_proximo && m.data_proxima && ' ou '}
                          {m.data_proxima && new Date(m.data_proxima).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      {canEdit && editMode && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onDeleteManutencao && onDeleteManutencao(idx)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-center py-4">
                    Nenhuma manutenção planeada
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Histórico de Manutenções */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Manutenções</CardTitle>
        </CardHeader>
        <CardContent>
          {historicoManutencoes && historicoManutencoes.length > 0 ? (
            <div className="space-y-2">
              {historicoManutencoes.map((h, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded border">
                  <div>
                    <p className="font-medium">
                      {tiposManutencao.find(t => t.value === h.tipo)?.label || h.tipo}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(h.data).toLocaleDateString('pt-PT')} - {h.km_realizado} KM
                    </p>
                    {h.observacoes && <p className="text-sm text-slate-400">{h.observacoes}</p>}
                  </div>
                  <Badge variant="outline" className="bg-green-50">
                    Concluída
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">
              Nenhuma manutenção registada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VeiculoRevisaoTab;
