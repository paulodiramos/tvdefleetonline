import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Percent, DollarSign, CheckCircle, Trash2 } from 'lucide-react';

const DescontosTab = ({
  subscricoes,
  onOpenPrecoFixoModal,
  onRemovePrecoFixo,
  onRemoveDesconto
}) => {
  const subscricoesComPrecoFixo = subscricoes.filter(s => s.preco_fixo?.ativo);
  const subscricoesComDesconto = subscricoes.filter(s => s.desconto_especial?.ativo);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              Descontos e Preços Especiais
            </CardTitle>
            <CardDescription>Gerir descontos percentuais e preços fixos para parceiros</CardDescription>
          </div>
          <Button 
            onClick={onOpenPrecoFixoModal} 
            className="bg-green-600 hover:bg-green-700"
            data-testid="definir-preco-fixo-btn"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Definir Preço Fixo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Preços Fixos Ativos */}
        <div className="mb-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Preços Fixos Ativos
          </h4>
          <div className="space-y-2">
            {subscricoesComPrecoFixo.length > 0 ? (
              subscricoesComPrecoFixo.map(sub => (
                <div 
                  key={`fixo-${sub.id}`} 
                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                      <p className="text-sm text-slate-500">{sub.plano_nome}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">
                      Preço Fixo
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">€{sub.preco_fixo.valor}</p>
                      <p className="text-xs text-slate-500">{sub.preco_fixo.motivo || 'Sem motivo'}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onRemovePrecoFixo(sub.user_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-2">Nenhum preço fixo definido</p>
            )}
          </div>
        </div>
        
        {/* Descontos Percentuais Ativos */}
        <div className="mb-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Descontos Percentuais Ativos
          </h4>
          <div className="space-y-2">
            {subscricoesComDesconto.length > 0 ? (
              subscricoesComDesconto.map(sub => (
                <div 
                  key={`desc-${sub.id}`} 
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                      <p className="text-sm text-slate-500">{sub.plano_nome}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      -{sub.desconto_especial.percentagem}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-green-600">€{sub.preco_final}</p>
                      <p className="text-xs text-slate-500">{sub.desconto_especial.motivo}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onRemoveDesconto(sub.user_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-2">Nenhum desconto percentual ativo</p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
          <h4 className="font-medium mb-2 text-slate-700">Diferença entre Preço Fixo e Desconto</h4>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <strong className="text-blue-600">Preço Fixo:</strong> Sobrepõe qualquer cálculo de plano. 
              O parceiro paga exatamente o valor definido, independentemente de veículos ou motoristas.
            </p>
            <p>
              <strong className="text-green-600">Desconto Percentual:</strong> Aplica uma redução percentual 
              sobre o preço calculado do plano. O valor final varia conforme a utilização.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DescontosTab;
