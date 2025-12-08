import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, FileText, Save } from 'lucide-react';

const ContratosParceiroTab = ({ parceiroId, parceiroData, onUpdate, userRole }) => {
  const [contratoTexto, setContratoTexto] = useState('');
  const [contratosTipos, setContratosTipos] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [novoTipo, setNovoTipo] = useState({
    nome: '',
    tipo: 'aluguer',
    valor_aluguer: '',
    periodicidade: 'semanal',
    valor_caucao: '',
    comissao_parceiro: '',
    comissao_motorista: ''
  });

  useEffect(() => {
    if (parceiroData) {
      setContratoTexto(parceiroData.contrato_texto || '');
      setContratosTipos(parceiroData.contratos_tipos || []);
    }
  }, [parceiroData]);

  const canEdit = userRole === 'admin' || userRole === 'gestao' || 
                  (userRole === 'parceiro' && parceiroData?.id === user?.associated_partner_id);

  const handleSaveContrato = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/parceiros/${parceiroId}`,
        {
          contrato_texto: contratoTexto,
          contratos_tipos: contratosTipos
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Contrato atualizado com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving contrato:', error);
      toast.error('Erro ao salvar contrato');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTipo = () => {
    if (!novoTipo.nome || !novoTipo.tipo) {
      toast.error('Preencha o nome e tipo do contrato');
      return;
    }

    const tipoContrato = {
      nome: novoTipo.nome,
      tipo: novoTipo.tipo,
      valores: {}
    };

    // Add relevant values based on tipo
    if (novoTipo.tipo === 'aluguer' || novoTipo.tipo === 'aluguer_sem_caucao') {
      tipoContrato.valores.valor_aluguer = parseFloat(novoTipo.valor_aluguer) || 0;
      tipoContrato.valores.periodicidade = novoTipo.periodicidade;
    } else if (novoTipo.tipo === 'aluguer_com_caucao') {
      tipoContrato.valores.valor_aluguer = parseFloat(novoTipo.valor_aluguer) || 0;
      tipoContrato.valores.valor_caucao = parseFloat(novoTipo.valor_caucao) || 0;
      tipoContrato.valores.periodicidade = novoTipo.periodicidade;
    } else if (novoTipo.tipo === 'comissao') {
      tipoContrato.valores.comissao_parceiro = parseFloat(novoTipo.comissao_parceiro) || 0;
      tipoContrato.valores.comissao_motorista = parseFloat(novoTipo.comissao_motorista) || 0;
    }

    if (editingIndex !== null) {
      const updated = [...contratosTipos];
      updated[editingIndex] = tipoContrato;
      setContratosTipos(updated);
      setEditingIndex(null);
    } else {
      setContratosTipos([...contratosTipos, tipoContrato]);
    }

    setShowAddModal(false);
    setNovoTipo({
      nome: '',
      tipo: 'aluguer',
      valor_aluguer: '',
      periodicidade: 'semanal',
      valor_caucao: '',
      comissao_parceiro: '',
      comissao_motorista: ''
    });
  };

  const handleEditTipo = (index) => {
    const tipo = contratosTipos[index];
    setNovoTipo({
      nome: tipo.nome,
      tipo: tipo.tipo,
      valor_aluguer: tipo.valores.valor_aluguer || '',
      periodicidade: tipo.valores.periodicidade || 'semanal',
      valor_caucao: tipo.valores.valor_caucao || '',
      comissao_parceiro: tipo.valores.comissao_parceiro || '',
      comissao_motorista: tipo.valores.comissao_motorista || ''
    });
    setEditingIndex(index);
    setShowAddModal(true);
  };

  const handleDeleteTipo = (index) => {
    if (window.confirm('Tem certeza que deseja remover este tipo de contrato?')) {
      const updated = contratosTipos.filter((_, i) => i !== index);
      setContratosTipos(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Texto Base do Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Texto Base do Contrato</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Texto do Contrato</Label>
              <Textarea
                value={contratoTexto}
                onChange={(e) => setContratoTexto(e.target.value)}
                placeholder="Insira o texto base do contrato do parceiro..."
                rows={10}
                disabled={!canEdit}
              />
              <p className="text-xs text-slate-500 mt-1">
                Este texto será a base para todos os contratos gerados com este parceiro
              </p>
            </div>
            
            {canEdit && (
              <Button onClick={handleSaveContrato} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'A guardar...' : 'Guardar Contrato'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Contrato */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tipos de Contrato Disponíveis</CardTitle>
          {canEdit && (
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tipo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {contratosTipos.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Nenhum tipo de contrato configurado ainda
            </p>
          ) : (
            <div className="space-y-3">
              {contratosTipos.map((tipo, index) => (
                <div key={index} className="border rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{tipo.nome}</h3>
                    <p className="text-sm text-slate-600 capitalize">Tipo: {tipo.tipo.replace(/_/g, ' ')}</p>
                    
                    <div className="mt-2 space-y-1 text-sm">
                      {tipo.valores.valor_aluguer && (
                        <p>• Valor Aluguer: €{tipo.valores.valor_aluguer} ({tipo.valores.periodicidade})</p>
                      )}
                      {tipo.valores.valor_caucao && (
                        <p>• Caução: €{tipo.valores.valor_caucao}</p>
                      )}
                      {tipo.valores.comissao_parceiro && (
                        <p>• Comissão Parceiro: {tipo.valores.comissao_parceiro}%</p>
                      )}
                      {tipo.valores.comissao_motorista && (
                        <p>• Comissão Motorista: {tipo.valores.comissao_motorista}%</p>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditTipo(index)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteTipo(index)}>
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar/Editar Tipo */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Editar' : 'Adicionar'} Tipo de Contrato</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome do Tipo *</Label>
              <Input
                value={novoTipo.nome}
                onChange={(e) => setNovoTipo({...novoTipo, nome: e.target.value})}
                placeholder="Ex: Aluguer Semanal Básico"
              />
            </div>

            <div>
              <Label>Categoria do Contrato *</Label>
              <select
                value={novoTipo.tipo}
                onChange={(e) => setNovoTipo({...novoTipo, tipo: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="aluguer">Aluguer Simples</option>
                <option value="aluguer_sem_caucao">Aluguer Sem Caução</option>
                <option value="aluguer_com_caucao">Aluguer Com Caução</option>
                <option value="comissao">Comissão</option>
                <option value="compra_veiculo">Compra de Veículo</option>
                <option value="motorista_privado">Motorista Privado</option>
              </select>
            </div>

            {/* Campos específicos por tipo */}
            {(novoTipo.tipo.includes('aluguer')) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor do Aluguer (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={novoTipo.valor_aluguer}
                      onChange={(e) => setNovoTipo({...novoTipo, valor_aluguer: e.target.value})}
                      placeholder="250.00"
                    />
                  </div>
                  <div>
                    <Label>Periodicidade</Label>
                    <select
                      value={novoTipo.periodicidade}
                      onChange={(e) => setNovoTipo({...novoTipo, periodicidade: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>

                {novoTipo.tipo === 'aluguer_com_caucao' && (
                  <div>
                    <Label>Valor da Caução (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={novoTipo.valor_caucao}
                      onChange={(e) => setNovoTipo({...novoTipo, valor_caucao: e.target.value})}
                      placeholder="500.00"
                    />
                  </div>
                )}
              </>
            )}

            {novoTipo.tipo === 'comissao' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Comissão Parceiro (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoTipo.comissao_parceiro}
                    onChange={(e) => setNovoTipo({...novoTipo, comissao_parceiro: e.target.value})}
                    placeholder="20"
                  />
                </div>
                <div>
                  <Label>Comissão Motorista (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoTipo.comissao_motorista}
                    onChange={(e) => setNovoTipo({...novoTipo, comissao_motorista: e.target.value})}
                    placeholder="80"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTipo}>
              {editingIndex !== null ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContratosParceiroTab;
