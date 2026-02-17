import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';

const PromocoesTab = ({ planos }) => {
  const planosComPromocoes = planos.filter(p => p.promocoes?.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Promoções e Campanhas</CardTitle>
            <CardDescription>Gerir promoções ativas em planos</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {planosComPromocoes.map(plano => (
            <div key={plano.id} className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                {plano.icone} {plano.nome}
              </h4>
              <div className="space-y-2">
                {plano.promocoes.map((promo, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                      <Badge className={
                        promo.tipo === 'pioneiro' ? 'bg-purple-100 text-purple-700' :
                        promo.tipo === 'lancamento' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }>
                        {promo.tipo}
                      </Badge>
                      <span className="font-medium">{promo.nome}</span>
                      {promo.desconto_percentagem > 0 && (
                        <span className="text-green-600 font-semibold">-{promo.desconto_percentagem}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      {promo.codigo_promocional && (
                        <Badge variant="outline">{promo.codigo_promocional}</Badge>
                      )}
                      {promo.data_fim && (
                        <span>até {new Date(promo.data_fim).toLocaleDateString('pt-PT')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {planosComPromocoes.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma promoção ativa</p>
              <p className="text-sm">Adicione promoções através da edição de planos</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PromocoesTab;
