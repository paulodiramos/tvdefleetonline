import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wrench } from 'lucide-react';

export default function VeiculoRevisao({ 
  revisaoForm, 
  setRevisaoForm, 
  canEdit, 
  editMode 
}) {
  return (
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
              value={revisaoForm.proxima_revisao_km}
              onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_km: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="Ex: 150000"
            />
          </div>
          <div>
            <Label htmlFor="proxima_revisao_data">Próxima Revisão (Data)</Label>
            <Input
              id="proxima_revisao_data"
              type="date"
              value={revisaoForm.proxima_revisao_data}
              onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_data: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Defina a próxima revisão por KM ou Data (ou ambos)
        </p>
      </CardContent>
    </Card>
  );
}
