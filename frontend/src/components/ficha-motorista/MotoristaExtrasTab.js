import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Edit, Trash2, Receipt, AlertCircle, CheckCircle, Clock, Loader2, Banknote 
} from 'lucide-react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
};

const getTipoBadge = (tipo) => {
  const tipoConfig = {
    'debito': { label: 'Débito', className: 'bg-red-100 text-red-700' },
    'credito': { label: 'Crédito', className: 'bg-green-100 text-green-700' },
    'divida': { label: 'Dívida', className: 'bg-amber-100 text-amber-700' },
    'adiantamento': { label: 'Adiantamento', className: 'bg-blue-100 text-blue-700' },
    'multa': { label: 'Multa', className: 'bg-purple-100 text-purple-700' },
    'bonus': { label: 'Bónus', className: 'bg-emerald-100 text-emerald-700' }
  };
  const config = tipoConfig[tipo] || { label: tipo, className: 'bg-slate-100 text-slate-700' };
  return <Badge className={config.className}>{config.label}</Badge>;
};

const MotoristaExtrasTab = ({
  extras,
  extrasLoading,
  totalExtras,
  totalPendentes,
  onOpenExtraModal,
  onTogglePago,
  onDeleteExtra
}) => {
  const extrasArray = Array.isArray(extras) ? extras : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Extras, Dívidas e Créditos</h2>
          <p className="text-sm text-slate-500">Gerir valores a debitar ou creditar ao motorista</p>
        </div>
        <Button onClick={() => onOpenExtraModal()} data-testid="btn-novo-extra">
          <Plus className="w-4 h-4 mr-2" /> Novo Extra
        </Button>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Total Registado</div>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-700 mt-1">
              {formatCurrency(Math.abs(totalExtras || 0))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-amber-700">Pendente</div>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {formatCurrency(Math.abs(totalPendentes || 0))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-green-700">Registos</div>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-700 mt-1">
              {extrasArray.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Extras */}
      <Card>
        <CardContent className="p-0">
          {extrasLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : extrasArray.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
              <Banknote className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm">Nenhum extra registado</p>
              <Button variant="link" onClick={() => onOpenExtraModal()} className="mt-2">
                <Plus className="w-4 h-4 mr-1" /> Adicionar primeiro extra
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Semana</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extrasArray.map((extra) => (
                  <TableRow key={extra.id}>
                    <TableCell>{getTipoBadge(extra.tipo)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{extra.descricao}</p>
                        {extra.parcelas_total && (
                          <p className="text-xs text-slate-500">
                            Parcela {extra.parcela_atual || 1}/{extra.parcelas_total}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {extra.semana && extra.ano ? (
                        <span className="text-sm">S{extra.semana}/{extra.ano}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${extra.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                      {extra.tipo === 'credito' ? '+' : '-'}{formatCurrency(extra.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTogglePago(extra)}
                        className={extra.pago ? 'text-green-600' : 'text-amber-600'}
                      >
                        {extra.pago ? (
                          <><CheckCircle className="w-4 h-4 mr-1" /> Pago</>
                        ) : (
                          <><Clock className="w-4 h-4 mr-1" /> Pendente</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenExtraModal(extra)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => onDeleteExtra(extra.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default MotoristaExtrasTab;
