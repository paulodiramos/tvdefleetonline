import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Edit, Trash2, Star, Users, Car, Gift, Folder, CheckCircle, Crown, AlertCircle, TrendingUp 
} from 'lucide-react';
import { calcularSemIva, formatarEuros } from '@/utils/iva';

const getCategoriaColor = (categoria) => {
  const colors = {
    'standard': 'bg-slate-100 text-slate-700',
    'premium': 'bg-amber-100 text-amber-700',
    'enterprise': 'bg-purple-100 text-purple-700',
    'custom': 'bg-blue-100 text-blue-700'
  };
  return colors[categoria?.toLowerCase()] || 'bg-slate-100 text-slate-700';
};

const PlanosTab = ({
  planos,
  onOpenPlanoModal,
  onDeletePlano
}) => {
  const parceiroPlanos = planos.filter(p => p.tipo_usuario === 'parceiro');
  const motoristaPlanos = planos.filter(p => p.tipo_usuario === 'motorista');

  const renderPlanoCard = (plano) => (
    <Card key={plano.id} className={`relative overflow-hidden ${!plano.ativo ? 'opacity-50' : ''}`}>
      {plano.destaque && (
        <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-2 py-1 rounded-bl">
          <Star className="w-3 h-3 inline mr-1" />
          Destaque
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: plano.cor + '20', color: plano.cor }}
          >
            {plano.icone}
          </div>
          <div>
            <CardTitle className="text-lg">{plano.nome}</CardTitle>
            <Badge className={getCategoriaColor(plano.categoria)}>
              {plano.categoria}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">{plano.descricao}</p>
        
        <div className="p-3 bg-slate-50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Preços</p>
            <Badge variant="outline" className="text-xs">c/IVA</Badge>
          </div>
          {/* Base */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600 font-medium">Base:</span>
            <div className="text-right">
              <span>€{formatarEuros(plano.precos_plano?.base_mensal || plano.precos?.mensal || 0)}/mês</span>
              <span className="text-xs text-slate-400 ml-1">
                (€{formatarEuros(calcularSemIva(plano.precos_plano?.base_mensal || plano.precos?.mensal || 0))} s/IVA)
              </span>
            </div>
          </div>
          {/* Por Veículo */}
          {(plano.precos_plano?.por_veiculo_mensal > 0) && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Car className="w-3 h-3 text-green-600" />
                <span className="text-green-600 font-medium">Por Veículo:</span>
              </span>
              <div className="text-right">
                <span>+€{formatarEuros(plano.precos_plano?.por_veiculo_mensal || 0)}/mês</span>
              </div>
            </div>
          )}
          {/* Por Motorista */}
          {(plano.precos_plano?.por_motorista_mensal > 0) && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-600" />
                <span className="text-purple-600 font-medium">Por Motorista:</span>
              </span>
              <div className="text-right">
                <span>+€{formatarEuros(plano.precos_plano?.por_motorista_mensal || 0)}/mês</span>
              </div>
            </div>
          )}
        </div>
        
        {plano.limites && (plano.limites.max_veiculos || plano.limites.max_motoristas) && (
          <div className="flex gap-4 text-sm">
            {plano.limites.max_veiculos && (
              <span className="flex items-center gap-1">
                <Car className="w-4 h-4 text-slate-400" />
                {plano.limites.max_veiculos} veículos
              </span>
            )}
            {plano.limites.max_motoristas && (
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4 text-slate-400" />
                {plano.limites.max_motoristas} motoristas
              </span>
            )}
          </div>
        )}
        
        {plano.modulos_incluidos?.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Módulos incluídos:</p>
            <div className="flex flex-wrap gap-1">
              {plano.modulos_incluidos.slice(0, 3).map(m => (
                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
              ))}
              {plano.modulos_incluidos.length > 3 && (
                <Badge variant="outline" className="text-xs">+{plano.modulos_incluidos.length - 3}</Badge>
              )}
            </div>
          </div>
        )}
        
        {plano.permite_trial && (
          <Badge className="bg-green-100 text-green-700">
            <Gift className="w-3 h-3 mr-1" />
            Trial {plano.dias_trial} dias
          </Badge>
        )}
      </CardContent>
      <CardFooter className="pt-0 gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenPlanoModal(plano)}>
          <Edit className="w-4 h-4 mr-1" />
          Editar
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-500"
          onClick={() => onDeletePlano(plano.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => onOpenPlanoModal()} data-testid="novo-plano-btn">
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parceiroPlanos.length > 0 && (
          <>
            <div className="col-span-full">
              <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Planos para Parceiros
              </h3>
            </div>
            {parceiroPlanos.map(renderPlanoCard)}
          </>
        )}
        
        {motoristaPlanos.length > 0 && (
          <>
            <div className="col-span-full mt-6">
              <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Car className="w-5 h-5" />
                Planos para Motoristas
              </h3>
            </div>
            {motoristaPlanos.map(renderPlanoCard)}
          </>
        )}
        
        {planos.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-500">
            <Crown className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum plano criado</p>
            <p className="text-sm">Clique em "Novo Plano" para começar</p>
          </div>
        )}
      </div>
    </>
  );
};

export default PlanosTab;
