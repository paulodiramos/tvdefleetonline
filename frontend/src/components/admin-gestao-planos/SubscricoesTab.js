import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Users } from 'lucide-react';

const SubscricoesTab = ({ subscricoes }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscrições Ativas</CardTitle>
        <CardDescription>Lista de todas as subscrições de planos e módulos</CardDescription>
      </CardHeader>
      <CardContent>
        {subscricoes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma subscrição encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilizador</TableHead>
                <TableHead>Plano/Módulos</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próx. Cobrança</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscricoes.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                      <p className="text-xs text-slate-500">{sub.user_tipo}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.plano_nome || 'Módulos individuais'}
                    {sub.modulos_individuais?.length > 0 && (
                      <span className="text-xs text-slate-500 ml-1">
                        +{sub.modulos_individuais.length} módulos
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sub.periodicidade}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">€{sub.preco_final}</TableCell>
                  <TableCell>
                    <Badge className={
                      sub.status === 'ativo' ? 'bg-green-100 text-green-700' :
                      sub.status === 'trial' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {sub.proxima_cobranca ? new Date(sub.proxima_cobranca).toLocaleDateString('pt-PT') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscricoesTab;
