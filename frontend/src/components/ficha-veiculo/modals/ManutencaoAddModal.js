import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, FileText } from 'lucide-react';

const ManutencaoAddModal = ({ 
  isOpen, 
  onClose, 
  novaManutencao, 
  setNovaManutencao, 
  faturaFile,
  setFaturaFile,
  vehicle,
  onSubmit 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registar Manutenção / Custo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Tipo de Intervenção/Custo *</Label>
            <select
              value={novaManutencao.tipo_manutencao}
              onChange={(e) => setNovaManutencao({...novaManutencao, tipo_manutencao: e.target.value})}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Selecione o tipo</option>
              <optgroup label="Manutenção">
                <option value="Revisão">Revisão</option>
                <option value="Troca de Óleo">Troca de Óleo</option>
                <option value="Troca de Filtros">Troca de Filtros</option>
                <option value="Troca de Pneus">Troca de Pneus</option>
                <option value="Travões">Travões</option>
                <option value="Suspensão">Suspensão</option>
                <option value="Embraiagem">Embraiagem</option>
                <option value="Correia de Distribuição">Correia de Distribuição</option>
                <option value="Bateria">Bateria</option>
                <option value="Ar Condicionado">Ar Condicionado</option>
              </optgroup>
              <optgroup label="Reparação">
                <option value="Reparação Mecânica">Reparação Mecânica</option>
                <option value="Reparação Elétrica">Reparação Elétrica</option>
                <option value="Chapa e Pintura">Chapa e Pintura</option>
              </optgroup>
              <optgroup label="Custos/Danos">
                <option value="Multa">Multa</option>
                <option value="Dano">Dano</option>
                <option value="Seguro">Seguro</option>
                <option value="Outro">Outro</option>
              </optgroup>
            </select>
          </div>
          <div>
            <Label>Descrição (o que foi feito)</Label>
            <textarea
              value={novaManutencao.descricao}
              onChange={(e) => setNovaManutencao({...novaManutencao, descricao: e.target.value})}
              className="w-full p-2 border rounded-md min-h-[80px]"
              placeholder="Descreva os trabalhos realizados..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={novaManutencao.data}
                onChange={(e) => setNovaManutencao({...novaManutencao, data: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>KM na Intervenção</Label>
              <Input
                type="number"
                value={novaManutencao.km_realizada}
                onChange={(e) => setNovaManutencao({...novaManutencao, km_realizada: e.target.value})}
                placeholder="Ex: 85000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor/Despesa (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={novaManutencao.valor}
                onChange={(e) => setNovaManutencao({...novaManutencao, valor: e.target.value})}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label>Fornecedor/Oficina</Label>
              <Input
                value={novaManutencao.fornecedor}
                onChange={(e) => setNovaManutencao({...novaManutencao, fornecedor: e.target.value})}
                placeholder="Nome da oficina"
              />
            </div>
          </div>
          
          {/* Secção de Fatura */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
            <Label className="text-blue-900 font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Dados da Fatura (Opcional)
            </Label>
            <p className="text-xs text-blue-700">
              Adicione os dados da fatura para controlo contabilístico
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº Fatura</Label>
                <Input
                  value={novaManutencao.fatura_numero}
                  onChange={(e) => setNovaManutencao({...novaManutencao, fatura_numero: e.target.value})}
                  placeholder="Ex: FT 2024/0001"
                />
              </div>
              <div>
                <Label>Data da Fatura</Label>
                <Input
                  type="date"
                  value={novaManutencao.fatura_data}
                  onChange={(e) => setNovaManutencao({...novaManutencao, fatura_data: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Fornecedor na Fatura</Label>
              <Input
                value={novaManutencao.fatura_fornecedor}
                onChange={(e) => setNovaManutencao({...novaManutencao, fatura_fornecedor: e.target.value})}
                placeholder="NIF e nome do fornecedor"
              />
            </div>
            <div>
              <Label>Ficheiro da Fatura (PDF/Imagem)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFaturaFile(e.target.files[0] || null)}
                className="cursor-pointer"
              />
              {faturaFile && (
                <p className="text-xs text-blue-600 mt-1">
                  Ficheiro selecionado: {faturaFile.name}
                </p>
              )}
            </div>
          </div>
          
          {/* Secção de Responsabilidade */}
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
            <Label className="text-amber-900 font-semibold">Atribuição de Custo</Label>
            <p className="text-xs text-amber-700">
              Defina quem é responsável pelo custo. Multas e danos são tipicamente do motorista. 
              Pneus e seguros podem ser do motorista ou parceiro.
            </p>
            <div>
              <Label>Responsável pelo Custo</Label>
              <select
                value={novaManutencao.responsavel}
                onChange={(e) => setNovaManutencao({...novaManutencao, responsavel: e.target.value})}
                className="w-full p-2 border rounded-md"
              >
                <option value="parceiro">Parceiro (Empresa)</option>
                <option value="motorista">Motorista</option>
              </select>
            </div>
            
            {novaManutencao.responsavel === 'motorista' && vehicle?.motorista_atribuido && (
              <div className="flex items-center gap-3 p-3 bg-white rounded border">
                <input
                  type="checkbox"
                  id="atribuir_motorista"
                  checked={novaManutencao.atribuir_motorista}
                  onChange={(e) => setNovaManutencao({...novaManutencao, atribuir_motorista: e.target.checked})}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <Label htmlFor="atribuir_motorista" className="font-medium cursor-pointer">
                    Deduzir do motorista: {vehicle?.motorista_atribuido_nome}
                  </Label>
                  <p className="text-xs text-slate-500">
                    O valor será registado para desconto no próximo relatório semanal
                  </p>
                </div>
              </div>
            )}
            
            {novaManutencao.responsavel === 'motorista' && !vehicle?.motorista_atribuido && (
              <p className="text-xs text-amber-600 italic">
                ⚠️ Nenhum motorista atribuído a este veículo
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Registar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManutencaoAddModal;
