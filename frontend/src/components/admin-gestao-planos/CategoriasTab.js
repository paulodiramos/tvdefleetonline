import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Edit, Trash2, Folder, CheckCircle, Crown, AlertCircle, TrendingUp 
} from 'lucide-react';

const CategoriasTab = ({
  categorias,
  planos,
  onOpenCategoriaModal,
  onDeleteCategoria
}) => {
  const categoriasAtivas = categorias.filter(c => c.ativo);
  const planosSemCategoria = planos.filter(p => 
    !p.categoria_id && !categorias.some(c => c.nome?.toLowerCase() === p.categoria?.toLowerCase())
  );

  return (
    <>
      {/* Dashboard Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Categorias</p>
                <p className="text-2xl font-bold text-blue-700">{categorias.length}</p>
              </div>
              <Folder className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Categorias Ativas</p>
                <p className="text-2xl font-bold text-green-700">{categoriasAtivas.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Total Planos</p>
                <p className="text-2xl font-bold text-purple-700">{planos.length}</p>
              </div>
              <Crown className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Sem Categoria</p>
                <p className="text-2xl font-bold text-amber-700">{planosSemCategoria.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Categoria */}
      {categorias.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Distribuição de Planos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoriasAtivas.map(categoria => {
                const planosNaCategoria = planos.filter(p => 
                  p.categoria_id === categoria.id || 
                  p.categoria?.toLowerCase() === categoria.nome?.toLowerCase()
                ).length;
                const percentagem = planos.length > 0 ? (planosNaCategoria / planos.length) * 100 : 0;
                
                return (
                  <div key={`dist-${categoria.id}`} className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: categoria.cor + '20' }}
                    >
                      {categoria.icone}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{categoria.nome}</span>
                        <span className="text-xs text-slate-500">{planosNaCategoria} plano(s)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentagem}%`, 
                            backgroundColor: categoria.cor 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header e Botão */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-slate-700">Gerir Categorias</h3>
        <Button onClick={() => onOpenCategoriaModal()} data-testid="nova-categoria-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>
      
      {/* Lista de Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorias.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">
            <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma categoria criada</p>
            <p className="text-sm">Crie categorias para organizar os planos</p>
          </div>
        ) : (
          categorias.map((categoria) => (
            <Card key={categoria.id} className={`${!categoria.ativo ? 'opacity-50' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: categoria.cor + '20' }}
                    >
                      {categoria.icone}
                    </div>
                    <div>
                      <CardTitle className="text-base">{categoria.nome}</CardTitle>
                      <p className="text-xs text-slate-500">Ordem: {categoria.ordem || 0}</p>
                    </div>
                  </div>
                  {!categoria.ativo && (
                    <Badge variant="outline" className="text-slate-400">Inativa</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{categoria.descricao || 'Sem descrição'}</p>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {planos.filter(p => 
                      p.categoria_id === categoria.id || 
                      p.categoria?.toLowerCase() === categoria.nome?.toLowerCase()
                    ).length} plano(s)
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="pt-0 gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenCategoriaModal(categoria)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500"
                  onClick={() => onDeleteCategoria(categoria.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </>
  );
};

export default CategoriasTab;
