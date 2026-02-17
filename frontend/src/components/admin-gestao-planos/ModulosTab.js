import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Edit, Trash2, Zap, CheckCircle, Star, Euro, Clock 
} from 'lucide-react';

const getTipoCobrancaLabel = (tipo) => {
  const labels = {
    'fixo': 'Fixo',
    'por_veiculo': 'Por Veículo',
    'por_motorista': 'Por Motorista',
    'por_veiculo_motorista': 'Por Veículo + Motorista'
  };
  return labels[tipo] || tipo;
};

const ModulosTab = ({
  modulos,
  onOpenModuloModal,
  onDeleteModulo
}) => {
  const modulosAtivos = modulos.filter(m => m.ativo);
  const modulosDestaque = modulos.filter(m => m.destaque);
  const tiposCobranca = new Set(modulos.map(m => m.tipo_cobranca));

  return (
    <>
      {/* Dashboard Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Total Módulos</p>
                <p className="text-2xl font-bold text-indigo-700">{modulos.length}</p>
              </div>
              <Zap className="w-8 h-8 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Ativos</p>
                <p className="text-2xl font-bold text-emerald-700">{modulosAtivos.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Em Destaque</p>
                <p className="text-2xl font-bold text-amber-700">{modulosDestaque.length}</p>
              </div>
              <Star className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-600 font-medium">Tipos de Cobrança</p>
                <p className="text-2xl font-bold text-rose-700">{tiposCobranca.size}</p>
              </div>
              <Euro className="w-8 h-8 text-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros por Tipo de Cobrança */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
          Todos ({modulos.length})
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-green-100 text-green-700">
          Fixo ({modulos.filter(m => m.tipo_cobranca === 'fixo').length})
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-blue-100 text-blue-700">
          Por Veículo ({modulos.filter(m => m.tipo_cobranca === 'por_veiculo').length})
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100 text-purple-700">
          Por Motorista ({modulos.filter(m => m.tipo_cobranca === 'por_motorista').length})
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-pink-100 text-pink-700">
          Combinado ({modulos.filter(m => m.tipo_cobranca === 'por_veiculo_motorista').length})
        </Badge>
      </div>

      {/* Header e Botão */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-slate-700">Gerir Módulos</h3>
        <Button onClick={() => onOpenModuloModal()} data-testid="novo-modulo-btn">
          <Plus className="w-4 h-4 mr-2" />
          Novo Módulo
        </Button>
      </div>
      
      {/* Lista de Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((modulo) => (
          <Card 
            key={modulo.id} 
            className={`${!modulo.ativo ? 'opacity-50' : ''} ${modulo.destaque ? 'ring-2 ring-amber-300' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: modulo.cor + '20' }}
                  >
                    {modulo.icone}
                  </div>
                  <div>
                    <CardTitle className="text-base">{modulo.nome}</CardTitle>
                    <p className="text-xs text-slate-500">{modulo.codigo}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {modulo.tipo_usuario === 'parceiro' ? 'Parceiro' : 'Motorista'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600 line-clamp-2">{modulo.descricao}</p>
              
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Badge variant="secondary">{getTipoCobrancaLabel(modulo.tipo_cobranca)}</Badge>
                {modulo.destaque && (
                  <Badge className="bg-amber-100 text-amber-700">
                    <Star className="w-3 h-3 mr-1" />
                    Destaque
                  </Badge>
                )}
                {modulo.brevemente && (
                  <Badge className="bg-slate-100 text-slate-700">
                    <Clock className="w-3 h-3 mr-1" />
                    Brevemente
                  </Badge>
                )}
              </div>
              
              {modulo.precos && (
                <div className="p-2 bg-slate-50 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base mensal:</span>
                    <span className="font-semibold">€{modulo.precos.mensal || 0}</span>
                  </div>
                  {modulo.tipo_cobranca === 'por_veiculo' && modulo.precos.por_veiculo_mensal > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Por veículo:</span>
                      <span className="font-semibold">+€{modulo.precos.por_veiculo_mensal}/veículo</span>
                    </div>
                  )}
                  {modulo.tipo_cobranca === 'por_motorista' && modulo.precos.por_motorista_mensal > 0 && (
                    <div className="flex justify-between text-purple-700">
                      <span>Por motorista:</span>
                      <span className="font-semibold">+€{modulo.precos.por_motorista_mensal}/motorista</span>
                    </div>
                  )}
                  {modulo.tipo_cobranca === 'por_veiculo_motorista' && (
                    <>
                      {modulo.precos.por_veiculo_mensal > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Por veículo:</span>
                          <span className="font-semibold">+€{modulo.precos.por_veiculo_mensal}/veículo</span>
                        </div>
                      )}
                      {modulo.precos.por_motorista_mensal > 0 && (
                        <div className="flex justify-between text-purple-700">
                          <span>Por motorista:</span>
                          <span className="font-semibold">+€{modulo.precos.por_motorista_mensal}/motorista</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {modulo.funcionalidades && modulo.funcionalidades.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {modulo.funcionalidades.slice(0, 3).map((func, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {func.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {modulo.funcionalidades.length > 3 && (
                    <Badge variant="outline" className="text-xs text-slate-400">
                      +{modulo.funcionalidades.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0 gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenModuloModal(modulo)}>
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-500"
                onClick={() => onDeleteModulo(modulo.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {modulos.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-500">
            <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum módulo criado</p>
            <p className="text-sm">Clique em "Novo Módulo" para começar</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ModulosTab;
