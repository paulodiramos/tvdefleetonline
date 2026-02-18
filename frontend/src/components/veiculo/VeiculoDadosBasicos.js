import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Car } from 'lucide-react';

// Função para parse de datas seguro
const parseDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

export default function VeiculoDadosBasicos({ 
  vehicle, 
  setVehicle, 
  canEdit, 
  editMode 
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Car className="w-5 h-5" />
          <span>Dados Básicos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-600">Marca</Label>
            {canEdit && editMode ? (
              <Input
                value={vehicle.marca}
                onChange={(e) => setVehicle({...vehicle, marca: e.target.value})}
                placeholder="Ex: Toyota"
              />
            ) : (
              <p className="font-medium">{vehicle.marca}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Modelo</Label>
            {canEdit && editMode ? (
              <Input
                value={vehicle.modelo}
                onChange={(e) => setVehicle({...vehicle, modelo: e.target.value})}
                placeholder="Ex: Corolla"
              />
            ) : (
              <p className="font-medium">{vehicle.modelo}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Versão</Label>
            {canEdit && editMode ? (
              <Input
                value={vehicle.versao || ''}
                onChange={(e) => setVehicle({...vehicle, versao: e.target.value})}
                placeholder="Ex: Hybrid"
              />
            ) : (
              <p className="font-medium">{vehicle.versao || 'N/A'}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Ano</Label>
            {canEdit && editMode ? (
              <Input
                type="number"
                value={vehicle.ano || ''}
                onChange={(e) => setVehicle({...vehicle, ano: parseInt(e.target.value) || null})}
                placeholder="Ex: 2020"
              />
            ) : (
              <p className="font-medium">{vehicle.ano || 'N/A'}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Matrícula</Label>
            {canEdit && editMode ? (
              <Input
                value={vehicle.matricula}
                onChange={(e) => setVehicle({...vehicle, matricula: e.target.value.toUpperCase()})}
                placeholder="Ex: AA-00-BB"
              />
            ) : (
              <p className="font-medium">{vehicle.matricula}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Data de Matrícula</Label>
            {canEdit && editMode ? (
              <Input
                type="date"
                value={vehicle.data_matricula ? vehicle.data_matricula.split('T')[0] : ''}
                onChange={(e) => setVehicle({...vehicle, data_matricula: e.target.value})}
              />
            ) : (
              <p className="font-medium">
                {vehicle.data_matricula ? (
                  parseDate(vehicle.data_matricula)?.toLocaleDateString('pt-PT') || 'Data inválida'
                ) : 'N/A'}
              </p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Validade da Matrícula</Label>
            {canEdit && editMode ? (
              <Input
                type="date"
                value={vehicle.validade_matricula ? vehicle.validade_matricula.split('T')[0] : ''}
                onChange={(e) => setVehicle({...vehicle, validade_matricula: e.target.value})}
              />
            ) : (
              <p className="font-medium">
                {vehicle.validade_matricula ? (
                  parseDate(vehicle.validade_matricula)?.toLocaleDateString('pt-PT') || 'Data inválida'
                ) : 'N/A'}
              </p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Cor</Label>
            {canEdit && editMode ? (
              <Input
                value={vehicle.cor || ''}
                onChange={(e) => setVehicle({...vehicle, cor: e.target.value})}
                placeholder="Ex: Branco"
              />
            ) : (
              <p className="font-medium">{vehicle.cor || 'N/A'}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Combustível</Label>
            {canEdit && editMode ? (
              <select 
                className="w-full p-2 border rounded-md"
                value={vehicle.combustivel || ''}
                onChange={(e) => setVehicle({...vehicle, combustivel: e.target.value})}
              >
                <option value="">Selecionar</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Gasóleo">Gasóleo</option>
                <option value="Elétrico">Elétrico</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Híbrido Plug-in">Híbrido Plug-in</option>
                <option value="GPL">GPL</option>
              </select>
            ) : (
              <p className="font-medium">{vehicle.combustivel || 'N/A'}</p>
            )}
          </div>
          <div>
            <Label className="text-slate-600">Quilometragem Atual</Label>
            {canEdit && editMode ? (
              <Input
                type="number"
                value={vehicle.km_atual || ''}
                onChange={(e) => setVehicle({...vehicle, km_atual: parseInt(e.target.value) || null})}
                placeholder="Ex: 50000"
              />
            ) : (
              <p className="font-medium">
                {vehicle.km_atual ? `${vehicle.km_atual.toLocaleString('pt-PT')} km` : 'N/A'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
