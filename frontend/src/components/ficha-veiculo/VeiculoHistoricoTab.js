import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { History, Plus, Edit, Trash2 } from 'lucide-react';

const VeiculoHistoricoTab = ({
  vehicle,
  historico,
  historicoEditavel,
  historicoForm,
  setHistoricoForm,
  canEdit,
  editMode,
  onAddHistorico,
  onDeleteHistorico,
  onDeleteHistoricoEditavel
}) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('pt-PT');
    } catch {
      return dateStr;
    }
  };

  const getTipoLabel = (tipo) => {
    const tipos = {
      'observacao': '📝 Observação',
      'manutencao': '🔧 Manutenção',
      'seguro': '🛡️ Seguro',
      'inspecao': '🔍 Inspeção',
      'atribuicao': '👤 Atribuição',
      'devolucao': '↩️ Devolução',
      'acidente': '⚠️ Acidente',
      'outro': '📋 Outro'
    };
    return tipos[tipo] || tipo;
  };

  return (
    <div className="space-y-4">
      {/* Formulário de Adição */}
      {canEdit && editMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar ao Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAddHistorico} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hist-data">Data</Label>
                  <Input
                    id="hist-data"
                    type="date"
                    value={historicoForm.data}
                    onChange={(e) => setHistoricoForm({...historicoForm, data: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="hist-tipo">Tipo</Label>
                  <select
                    id="hist-tipo"
                    value={historicoForm.tipo}
                    onChange={(e) => setHistoricoForm({...historicoForm, tipo: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="observacao">Observação</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="seguro">Seguro</option>
                    <option value="inspecao">Inspeção</option>
                    <option value="atribuicao">Atribuição</option>
                    <option value="devolucao">Devolução</option>
                    <option value="acidente">Acidente</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="hist-titulo">Título</Label>
                <Input
                  id="hist-titulo"
                  value={historicoForm.titulo}
                  onChange={(e) => setHistoricoForm({...historicoForm, titulo: e.target.value})}
                  placeholder="Título do evento"
                  required
                />
              </div>
              <div>
                <Label htmlFor="hist-descricao">Descrição</Label>
                <textarea
                  id="hist-descricao"
                  value={historicoForm.descricao}
                  onChange={(e) => setHistoricoForm({...historicoForm, descricao: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Descrição detalhada..."
                />
              </div>
              <Button type="submit" data-testid="add-historico-btn">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar ao Histórico
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Histórico Editável */}
      {historicoEditavel && historicoEditavel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Entradas Manuais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historicoEditavel.map((entry, index) => (
                <div key={entry.id || index} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                          {getTipoLabel(entry.tipo)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(entry.data)}
                        </span>
                      </div>
                      <p className="font-semibold">{entry.titulo}</p>
                      <p className="text-sm text-slate-600 mt-1">{entry.descricao}</p>
                    </div>
                    {canEdit && editMode && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDeleteHistoricoEditavel(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico Automático */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico && historico.length > 0 ? (
            <div className="space-y-3">
              {historico.map((entry, index) => (
                <div key={entry.id || index} className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          {getTipoLabel(entry.tipo)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(entry.data)}
                        </span>
                      </div>
                      <p className="font-semibold">{entry.titulo}</p>
                      <p className="text-sm text-slate-600 mt-1">{entry.descricao}</p>
                      {entry.motorista && (
                        <p className="text-xs text-slate-500 mt-2">
                          Motorista: {entry.motorista}
                        </p>
                      )}
                    </div>
                    {canEdit && editMode && entry.deletable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDeleteHistorico(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum histórico registado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VeiculoHistoricoTab;
