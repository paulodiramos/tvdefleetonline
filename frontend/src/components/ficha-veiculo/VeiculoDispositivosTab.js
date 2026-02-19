import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor } from 'lucide-react';

const VeiculoDispositivosTab = ({ 
  vehicle, 
  setVehicle, 
  editMode, 
  canEdit 
}) => {
  if (!vehicle) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Monitor className="w-5 h-5" />
          <span>Dispositivos Associados</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-500">
          Configure os dispositivos associados a este veículo. Quando um motorista é atribuído, 
          herda automaticamente estes dispositivos.
        </p>
        
        <div className="grid grid-cols-2 gap-6">
          {/* OBU Via Verde */}
          <div className="space-y-2">
            <Label htmlFor="obu_via_verde" className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              OBU Via Verde
            </Label>
            <Input
              id="obu_via_verde"
              placeholder="Número do identificador OBU"
              value={vehicle?.via_verde_id || ''}
              onChange={(e) => setVehicle({...vehicle, via_verde_id: e.target.value})}
              disabled={!canEdit || !editMode}
            />
            <p className="text-xs text-gray-400">Identificador do dispositivo Via Verde</p>
          </div>

          {/* GPS */}
          <div className="space-y-2">
            <Label htmlFor="gps_matricula" className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              GPS (Matrícula)
            </Label>
            <Input
              id="gps_matricula"
              value={vehicle?.matricula || ''}
              disabled={true}
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-400">O GPS é identificado pela matrícula do veículo</p>
          </div>

          {/* Cartão Combustível Fóssil */}
          <div className="space-y-2">
            <Label htmlFor="cartao_fossil" className="flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
              Cartão Combustível Fóssil
            </Label>
            <Input
              id="cartao_fossil"
              placeholder="Número do cartão de frota"
              value={vehicle?.cartao_frota_id || ''}
              onChange={(e) => setVehicle({...vehicle, cartao_frota_id: e.target.value})}
              disabled={!canEdit || !editMode}
            />
            <p className="text-xs text-gray-400">Cartão para abastecimentos de combustível</p>
          </div>

          {/* Cartões Combustível Elétrico - 6 Fornecedores */}
          <div className="space-y-4 mt-6">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              Cartões de Carregamento Elétrico
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prio Electric */}
              <div className="space-y-1">
                <Label htmlFor="cartao_prio" className="text-xs">Prio Electric</Label>
                <Input
                  id="cartao_prio"
                  placeholder="Nº cartão Prio Electric"
                  value={vehicle?.cartao_prio_eletric || vehicle?.cartao_frota_eletric_id || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_prio_eletric: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              {/* Prio Online */}
              <div className="space-y-1">
                <Label htmlFor="cartao_prio_online" className="text-xs">Prio Online</Label>
                <Input
                  id="cartao_prio_online"
                  placeholder="Nº cartão Prio Online"
                  value={vehicle?.cartao_prio_online || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_prio_online: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              {/* Mio */}
              <div className="space-y-1">
                <Label htmlFor="cartao_mio" className="text-xs">Mio</Label>
                <Input
                  id="cartao_mio"
                  placeholder="Nº cartão Mio"
                  value={vehicle?.cartao_mio || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_mio: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              {/* Galp */}
              <div className="space-y-1">
                <Label htmlFor="cartao_galp" className="text-xs">Galp</Label>
                <Input
                  id="cartao_galp"
                  placeholder="Nº cartão Galp"
                  value={vehicle?.cartao_galp || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_galp: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              {/* Atlante */}
              <div className="space-y-1">
                <Label htmlFor="cartao_atlante" className="text-xs">Atlante</Label>
                <Input
                  id="cartao_atlante"
                  placeholder="Nº cartão Atlante"
                  value={vehicle?.cartao_atlante || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_atlante: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              {/* Outro */}
              <div className="space-y-1">
                <Label htmlFor="cartao_outro_nome" className="text-xs">Outro Fornecedor (Nome)</Label>
                <Input
                  id="cartao_outro_nome"
                  placeholder="Nome do fornecedor"
                  value={vehicle?.cartao_eletrico_outro_nome || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_eletrico_outro_nome: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="cartao_outro" className="text-xs">Outro (Nº Cartão)</Label>
                <Input
                  id="cartao_outro"
                  placeholder="Nº cartão"
                  value={vehicle?.cartao_eletrico_outro || ''}
                  onChange={(e) => setVehicle({...vehicle, cartao_eletrico_outro: e.target.value})}
                  disabled={!canEdit || !editMode}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Os valores de todos os cartões serão somados na coluna de carregamentos elétricos</p>
          </div>
        </div>

        {/* Motorista Atribuído */}
        {vehicle?.motorista_atribuido && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Motorista Atribuído</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm"><strong>Nome:</strong> {vehicle.motorista_atribuido_nome}</p>
                {vehicle.motorista_atribuido_desde && (
                  <p className="text-xs text-gray-500">
                    Desde: {new Date(vehicle.motorista_atribuido_desde).toLocaleString('pt-PT')}
                  </p>
                )}
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Dispositivos sincronizados
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VeiculoDispositivosTab;
