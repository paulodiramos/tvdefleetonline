import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save } from 'lucide-react';

const AgendaEditModal = ({ 
  isOpen, 
  onClose, 
  agendaForm, 
  setAgendaForm, 
  onSubmit, 
  onCancel 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Evento da Agenda</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="modal_tipo">Tipo *</Label>
              <select
                id="modal_tipo"
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
              <Label htmlFor="modal_titulo">Título *</Label>
              <Input
                id="modal_titulo"
                value={agendaForm.titulo}
                onChange={(e) => setAgendaForm({...agendaForm, titulo: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="modal_data">Data *</Label>
              <Input
                id="modal_data"
                type="date"
                value={agendaForm.data}
                onChange={(e) => setAgendaForm({...agendaForm, data: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="modal_hora">Hora</Label>
              <Input
                id="modal_hora"
                type="time"
                value={agendaForm.hora}
                onChange={(e) => setAgendaForm({...agendaForm, hora: e.target.value})}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="modal_descricao">Descrição</Label>
              <textarea
                id="modal_descricao"
                value={agendaForm.descricao}
                onChange={(e) => setAgendaForm({...agendaForm, descricao: e.target.value})}
                className="w-full p-2 border rounded-md"
                rows="3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgendaEditModal;
