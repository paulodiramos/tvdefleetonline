import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Plus, Save, X, Edit, Trash2, Wrench, MapPin, ClipboardCheck } from 'lucide-react';

const VeiculoAgendaTab = ({
  vehicle,
  agenda,
  agendaForm,
  setAgendaForm,
  editingAgendaId,
  canEdit,
  onAddAgenda,
  onUpdateAgenda,
  onDeleteAgenda,
  onEditAgenda,
  onCancelEditAgenda
}) => {
  const getQuickAgendaDefaults = (tipo) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30*24*60*60*1000).toISOString().split('T')[0];
    
    switch(tipo) {
      case 'inspecao':
        return {
          tipo: 'inspecao',
          titulo: 'Inspeção Periódica',
          data: vehicle?.inspection?.proxima_inspecao 
            ? new Date(new Date(vehicle.inspection.proxima_inspecao).getTime() - 7*24*60*60*1000).toISOString().split('T')[0]
            : futureDate,
          hora: '10:00',
          descricao: `Agendar inspeção para ${vehicle?.matricula || 'veículo'}`,
          oficina: '',
          local: ''
        };
      case 'seguro':
        return {
          tipo: 'seguro',
          titulo: 'Renovação Seguro',
          data: vehicle?.insurance?.data_validade 
            ? new Date(new Date(vehicle.insurance.data_validade).getTime() - 30*24*60*60*1000).toISOString().split('T')[0]
            : futureDate,
          hora: '',
          descricao: `Renovar seguro do veículo ${vehicle?.matricula || ''}`,
          oficina: '',
          local: ''
        };
      case 'revisao':
        return {
          tipo: 'revisao',
          titulo: 'Revisão Periódica',
          data: futureDate,
          hora: '09:00',
          descricao: `Revisão programada - KM atual: ${vehicle?.km_atual || 'N/A'}`,
          oficina: '',
          local: ''
        };
      case 'extintor':
        return {
          tipo: 'manutencao',
          titulo: 'Verificação Extintor',
          data: vehicle?.extintor?.data_validade 
            ? new Date(new Date(vehicle.extintor.data_validade).getTime() - 30*24*60*60*1000).toISOString().split('T')[0]
            : futureDate,
          hora: '',
          descricao: 'Verificar e renovar extintor se necessário',
          oficina: '',
          local: ''
        };
      default:
        return agendaForm;
    }
  };

  const hasUpcomingDeadlines = () => {
    const thirtyDaysFromNow = new Date(Date.now() + 30*24*60*60*1000);
    return (
      (vehicle?.inspection?.proxima_inspecao && new Date(vehicle.inspection.proxima_inspecao) <= thirtyDaysFromNow) ||
      (vehicle?.insurance?.data_validade && new Date(vehicle.insurance.data_validade) <= thirtyDaysFromNow) ||
      (vehicle?.extintor?.data_validade && new Date(vehicle.extintor.data_validade) <= thirtyDaysFromNow)
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Agenda do Veículo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Atalhos Rápidos */}
        {canEdit && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Agendar Vistoria Rápida
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white hover:bg-purple-100 border-purple-300"
                onClick={() => setAgendaForm(getQuickAgendaDefaults('inspecao'))}
                data-testid="quick-agenda-inspecao"
              >
                🔍 Inspeção
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white hover:bg-blue-100 border-blue-300"
                onClick={() => setAgendaForm(getQuickAgendaDefaults('seguro'))}
                data-testid="quick-agenda-seguro"
              >
                🛡️ Seguro
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white hover:bg-yellow-100 border-yellow-300"
                onClick={() => setAgendaForm(getQuickAgendaDefaults('revisao'))}
                data-testid="quick-agenda-revisao"
              >
                🔧 Revisão
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white hover:bg-red-100 border-red-300"
                onClick={() => setAgendaForm(getQuickAgendaDefaults('extintor'))}
                data-testid="quick-agenda-extintor"
              >
                🧯 Extintor
              </Button>
            </div>
            
            {hasUpcomingDeadlines() && (
              <div className="mt-3 p-2 bg-orange-100 rounded border border-orange-300">
                <p className="text-xs text-orange-800 font-medium">
                  ⚠️ Atenção: Existem documentos/vistorias a vencer nos próximos 30 dias!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Formulário de Adição/Edição */}
        {canEdit && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              editingAgendaId ? onUpdateAgenda(e) : onAddAgenda(e);
            }} 
            className="space-y-4 border-b pb-4"
          >
            <h3 className="font-semibold">{editingAgendaId ? 'Editar Evento' : 'Adicionar Evento'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <select
                  id="tipo"
                  value={agendaForm.tipo}
                  onChange={(e) => setAgendaForm({...agendaForm, tipo: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="manutencao">Manutenção</option>
                  <option value="inspecao">Inspeção</option>
                  <option value="revisao">Revisão</option>
                  <option value="seguro">Seguro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={agendaForm.titulo}
                  onChange={(e) => setAgendaForm({...agendaForm, titulo: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={agendaForm.data}
                  onChange={(e) => setAgendaForm({...agendaForm, data: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="hora">Hora</Label>
                <Input
                  id="hora"
                  type="time"
                  value={agendaForm.hora}
                  onChange={(e) => setAgendaForm({...agendaForm, hora: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <textarea
                  id="descricao"
                  value={agendaForm.descricao}
                  onChange={(e) => setAgendaForm({...agendaForm, descricao: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  rows="2"
                />
              </div>
              <div>
                <Label htmlFor="oficina">Oficina</Label>
                <Input
                  id="oficina"
                  value={agendaForm.oficina || ''}
                  onChange={(e) => setAgendaForm({...agendaForm, oficina: e.target.value})}
                  placeholder="Nome da oficina"
                />
              </div>
              <div>
                <Label htmlFor="local">Local/Morada</Label>
                <Input
                  id="local"
                  value={agendaForm.local || ''}
                  onChange={(e) => setAgendaForm({...agendaForm, local: e.target.value})}
                  placeholder="Endereço ou localização"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" data-testid="submit-agenda-btn">
                {editingAgendaId ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar à Agenda
                  </>
                )}
              </Button>
              {editingAgendaId && (
                <Button type="button" variant="outline" onClick={onCancelEditAgenda}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}

        {/* Lista de Eventos */}
        <div>
          <h3 className="font-semibold mb-3">Próximos Eventos</h3>
          {agenda && agenda.length > 0 ? (
            <div className="space-y-2">
              {agenda.map((evento) => (
                <div key={evento.id} className="border rounded p-3" data-testid={`agenda-item-${evento.id}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{evento.titulo}</p>
                      <p className="text-sm text-slate-600">{evento.descricao}</p>
                      {(evento.oficina || evento.local) && (
                        <div className="text-sm text-slate-600 mt-1">
                          {evento.oficina && (
                            <span className="inline-flex items-center gap-1 mr-3">
                              <Wrench className="w-3 h-3" />
                              {evento.oficina}
                            </span>
                          )}
                          {evento.local && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {evento.local}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(evento.data).toLocaleDateString('pt-PT')}
                        {evento.hora && ` às ${evento.hora}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditAgenda(evento)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => onDeleteAgenda(evento.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum evento agendado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VeiculoAgendaTab;
