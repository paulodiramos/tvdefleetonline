import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save } from 'lucide-react';

const IntervencaoEditModal = ({ 
  isOpen, 
  onClose, 
  editingIntervencao, 
  setEditingIntervencao, 
  onSave 
}) => {
  if (!editingIntervencao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Intervenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <p className="font-medium">{editingIntervencao.tipo}</p>
          </div>
          <div>
            <Label>Descrição</Label>
            <p className="text-sm">{editingIntervencao.descricao}</p>
          </div>
          <div>
            <Label>Data</Label>
            <p className="text-sm">{new Date(editingIntervencao.data).toLocaleDateString('pt-PT')}</p>
          </div>
          <div>
            <Label htmlFor="intervencao_status">Estado *</Label>
            <select
              id="intervencao_status"
              value={editingIntervencao.status}
              onChange={(e) => setEditingIntervencao({...editingIntervencao, status: e.target.value})}
              className="w-full p-2 border rounded-md"
            >
              <option value="pending">Pendente</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
          {editingIntervencao.criado_por && (
            <div className="text-sm text-slate-600 border-t pt-3">
              <p><strong>Criado por:</strong> {editingIntervencao.criado_por}</p>
              {editingIntervencao.editado_por && (
                <p><strong>Última edição por:</strong> {editingIntervencao.editado_por}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntervencaoEditModal;
