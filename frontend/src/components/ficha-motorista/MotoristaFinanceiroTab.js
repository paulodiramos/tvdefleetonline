import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Save, Edit, Euro, Percent, Calculator, TrendingUp, Wallet,
  Receipt, History, AlertCircle, CheckCircle
} from 'lucide-react';

const MotoristaFinanceiroTab = ({
  configFinanceira,
  setConfigFinanceira,
  historicoViaVerde,
  veiculo,
  isEditing,
  setIsEditing,
  saving,
  onSave,
  onAbaterViaVerde
}) => {
  return (
    <>
      <div className="flex justify-end">
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} data-testid="btn-editar-financeiro">
            <Edit className="w-4 h-4 mr-2" /> Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving} data-testid="btn-guardar-financeiro">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Acumulação Via Verde */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" /> Acumulação Via Verde
            </CardTitle>
            <CardDescription>
              Acumula valores de Via Verde dos ganhos até ser cobrado no relatório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Ativar acumulação</Label>
              <Switch
                checked={configFinanceira.acumular_viaverde}
                onCheckedChange={(checked) => 
                  setConfigFinanceira(prev => ({ ...prev, acumular_viaverde: checked }))
                }
                disabled={!isEditing}
                data-testid="switch-acumular-viaverde"
              />
            </div>

            {configFinanceira.acumular_viaverde && (
              <>
                <div>
                  <Label>Fonte dos valores</Label>
                  <Select
                    value={configFinanceira.viaverde_fonte}
                    onValueChange={(value) => 
                      setConfigFinanceira(prev => ({ ...prev, viaverde_fonte: value }))
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger data-testid="select-viaverde-fonte">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uber">Apenas Uber</SelectItem>
                      <SelectItem value="bolt">Apenas Bolt</SelectItem>
                      <SelectItem value="ambos">Uber + Bolt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Valor Acumulado</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="valor-viaverde-acumulado">
                        €{configFinanceira.viaverde_acumulado?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    {configFinanceira.viaverde_acumulado > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={onAbaterViaVerde}
                        data-testid="btn-abater-viaverde"
                      >
                        Abater no Relatório
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Gratificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" /> Gratificação
            </CardTitle>
            <CardDescription>
              Configuração de gratificações (gorjetas) em contratos de comissão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo de Gratificação</Label>
              <Select
                value={configFinanceira.gratificacao_tipo}
                onValueChange={(value) => 
                  setConfigFinanceira(prev => ({ ...prev, gratificacao_tipo: value }))
                }
                disabled={!isEditing}
              >
                <SelectTrigger data-testid="select-gratificacao-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="na_comissao">Na Comissão (incluído no cálculo)</SelectItem>
                  <SelectItem value="fora_comissao">Fora da Comissão (pago separadamente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {configFinanceira.gratificacao_tipo === 'na_comissao' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <span>Gratificações <strong>incluídas</strong> no cálculo da comissão</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span>Gratificações <strong>pagas separadamente</strong> (100% motorista)</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuração IVA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="w-5 h-5 text-blue-600" /> Configuração IVA
            </CardTitle>
            <CardDescription>
              Define se o IVA é incluído ou excluído dos rendimentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Incluir IVA nos rendimentos</Label>
              <Switch
                checked={configFinanceira.incluir_iva_rendimentos}
                onCheckedChange={(checked) => 
                  setConfigFinanceira(prev => ({ ...prev, incluir_iva_rendimentos: checked }))
                }
                disabled={!isEditing}
                data-testid="switch-incluir-iva"
              />
            </div>

            <div>
              <Label>Percentagem IVA</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={configFinanceira.iva_percentagem}
                  onChange={(e) => 
                    setConfigFinanceira(prev => ({ 
                      ...prev, 
                      iva_percentagem: parseFloat(e.target.value) || 23 
                    }))
                  }
                  disabled={!isEditing}
                  className="w-24"
                  data-testid="input-iva-percentagem"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {configFinanceira.incluir_iva_rendimentos ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span>Rendimentos <strong>com IVA</strong> ({configFinanceira.iva_percentagem}%)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span>Rendimentos <strong>sem IVA</strong> (líquido)</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comissão Personalizada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-orange-600" /> Comissão
            </CardTitle>
            <CardDescription>
              Percentagens de comissão (se diferente do contrato padrão)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Usar comissão personalizada</Label>
              <Switch
                checked={configFinanceira.comissao_personalizada}
                onCheckedChange={(checked) => 
                  setConfigFinanceira(prev => ({ ...prev, comissao_personalizada: checked }))
                }
                disabled={!isEditing}
                data-testid="switch-comissao-personalizada"
              />
            </div>

            {configFinanceira.comissao_personalizada ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Comissão Motorista</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="1"
                      value={configFinanceira.comissao_motorista_percentagem}
                      onChange={(e) => {
                        const motorista = parseFloat(e.target.value) || 0;
                        setConfigFinanceira(prev => ({ 
                          ...prev, 
                          comissao_motorista_percentagem: motorista,
                          comissao_parceiro_percentagem: 100 - motorista
                        }));
                      }}
                      disabled={!isEditing}
                      className="w-20"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
                <div>
                  <Label>Comissão Parceiro</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="1"
                      value={configFinanceira.comissao_parceiro_percentagem}
                      onChange={(e) => {
                        const parceiro = parseFloat(e.target.value) || 0;
                        setConfigFinanceira(prev => ({ 
                          ...prev, 
                          comissao_parceiro_percentagem: parceiro,
                          comissao_motorista_percentagem: 100 - parceiro
                        }));
                      }}
                      disabled={!isEditing}
                      className="w-20"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">
                  A usar comissão do veículo: <strong>
                    {veiculo ? (
                      veiculo.tipo_contrato?.tipo === 'comissao'
                        ? `${veiculo.tipo_contrato?.comissao_motorista || 0}% / ${veiculo.tipo_contrato?.comissao_parceiro || 0}%`
                        : 'N/A (Tipo Aluguer)'
                    ) : 'N/A'}
                  </strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo Financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Resumo da Configuração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <p className="text-sm text-slate-500">Via Verde</p>
              <p className="text-lg font-bold">
                {configFinanceira.acumular_viaverde ? 'Acumulado' : 'Direto'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <p className="text-sm text-slate-500">Gratificação</p>
              <p className="text-lg font-bold">
                {configFinanceira.gratificacao_tipo === 'na_comissao' ? 'Na Comissão' : 'Separado'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <p className="text-sm text-slate-500">IVA</p>
              <p className="text-lg font-bold">
                {configFinanceira.incluir_iva_rendimentos ? `${configFinanceira.iva_percentagem}%` : 'Excluído'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <p className="text-sm text-slate-500">Comissão</p>
              <p className="text-lg font-bold">
                {configFinanceira.comissao_personalizada 
                  ? `${configFinanceira.comissao_motorista_percentagem}/${configFinanceira.comissao_parceiro_percentagem}`
                  : 'Veículo'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico Via Verde */}
      {configFinanceira.acumular_viaverde && historicoViaVerde && historicoViaVerde.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" /> Histórico Via Verde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historicoViaVerde.map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b py-2">
                  <div>
                    <p className="font-medium">{item.descricao || 'Movimento'}</p>
                    <p className="text-sm text-slate-500">
                      {item.created_at?.substring(0, 10)} {item.created_at?.substring(11, 16) || ''}
                    </p>
                  </div>
                  <div className={`font-bold ${item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.tipo === 'credito' ? '+' : '-'}€{Math.abs(item.valor).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default MotoristaFinanceiroTab;
