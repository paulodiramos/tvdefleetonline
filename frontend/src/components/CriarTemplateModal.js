import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus } from 'lucide-react';

const CriarTemplateModal = ({ open, onOpenChange, onSuccess, user }) => {
  const [tipoContrato, setTipoContrato] = useState('');
  const [parceiroId, setParceiroId] = useState('');
  const [parceiros, setParceiros] = useState([]);
  const [novoTipo, setNovoTipo] = useState('');
  const [mostrarNovoTipo, setMostrarNovoTipo] = useState(false);
  const [textoContrato, setTextoContrato] = useState('');
  const [saving, setSaving] = useState(false);
  const [tiposContrato, setTiposContrato] = useState([
    { value: 'aluguer_sem_caucao', label: 'Aluguer Sem Caução' },
    { value: 'aluguer_com_caucao', label: 'Aluguer Com Caução' },
    { value: 'prestacao_servicos', label: 'Prestação de Serviços' },
    { value: 'parceria', label: 'Parceria' },
    { value: 'compra', label: 'Compra' },
    { value: 'venda', label: 'Venda' }
  ]);

  useEffect(() => {
    if (open && user) {
      if (user.role === 'admin' || user.role === 'gestao') {
        fetchParceiros();
      } else if (user.role === 'parceiro') {
        // Buscar o parceiro_id associado ao user logado
        fetchParceiroLogado();
      }
    }
  }, [open]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchParceiroLogado = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Encontrar o parceiro pelo email do user
      const parceiro = response.data.find(p => p.email === user.email);
      if (parceiro) {
        setParceiroId(parceiro.id);
      }
    } catch (error) {
      console.error('Error fetching parceiro:', error);
    }
  };

  const handleAdicionarNovoTipo = () => {
    if (!novoTipo.trim()) {
      toast.error('Digite o nome do novo tipo');
      return;
    }
    const novoTipoObj = {
      value: novoTipo.toLowerCase().replace(/ /g, '_'),
      label: novoTipo
    };
    setTiposContrato([...tiposContrato, novoTipoObj]);
    setTipoContrato(novoTipoObj.value);
    setMostrarNovoTipo(false);
    setNovoTipo('');
    toast.success('Novo tipo adicionado!');
  };

  const variaveisDisponiveis = [
    { key: '{PARCEIRO_NOME}', desc: 'Nome do Parceiro' },
    { key: '{PARCEIRO_NIF}', desc: 'NIF do Parceiro' },
    { key: '{PARCEIRO_MORADA}', desc: 'Morada do Parceiro' },
    { key: '{PARCEIRO_CP}', desc: 'Código Postal do Parceiro' },
    { key: '{PARCEIRO_LOCALIDADE}', desc: 'Localidade do Parceiro' },
    { key: '{PARCEIRO_TELEFONE}', desc: 'Telefone do Parceiro' },
    { key: '{PARCEIRO_EMAIL}', desc: 'Email do Parceiro' },
    { key: '{REP_LEGAL_NOME}', desc: 'Nome do Representante Legal' },
    { key: '{REP_LEGAL_CC}', desc: 'CC do Representante Legal' },
    { key: '{REP_LEGAL_CC_VALIDADE}', desc: 'Validade CC Rep. Legal' },
    { key: '{REP_LEGAL_TELEFONE}', desc: 'Telefone Rep. Legal' },
    { key: '{REP_LEGAL_EMAIL}', desc: 'Email Rep. Legal' },
    { key: '{MOTORISTA_NOME}', desc: 'Nome do Motorista' },
    { key: '{MOTORISTA_CC}', desc: 'CC do Motorista' },
    { key: '{MOTORISTA_CC_VALIDADE}', desc: 'Validade CC Motorista' },
    { key: '{MOTORISTA_MORADA}', desc: 'Morada do Motorista' },
    { key: '{MOTORISTA_TELEFONE}', desc: 'Telefone do Motorista' },
    { key: '{MOTORISTA_EMAIL}', desc: 'Email do Motorista' },
    { key: '{VEICULO_MATRICULA}', desc: 'Matrícula do Veículo' },
    { key: '{VEICULO_MARCA}', desc: 'Marca do Veículo' },
    { key: '{VEICULO_MODELO}', desc: 'Modelo do Veículo' },
    { key: '{DATA_ATUAL}', desc: 'Data Atual' },
    { key: '{DATA_INICIO}', desc: 'Data de Início do Contrato' },
    { key: '{VALOR_MENSAL}', desc: 'Valor Mensal' }
  ];

  const handleSubmit = async () => {
    if (!tipoContrato) {
      toast.error('Selecione o tipo de contrato');
      return;
    }
    if (!parceiroId) {
      toast.error('Selecione um parceiro');
      return;
    }
    if (!textoContrato.trim()) {
      toast.error('Preencha o texto do contrato');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/contratos/templates`,
        {
          tipo_contrato: tipoContrato,
          parceiro_id: parceiroId,
          texto_template: textoContrato,
          ativo: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Template criado com sucesso!');
      setTipoContrato('');
      setParceiroId('');
      setTextoContrato('');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar template');
    } finally {
      setSaving(false);
    }
  };

  const inserirVariavel = (variavel) => {
    const textarea = document.getElementById('texto-contrato');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textoContrato;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setTextoContrato(before + variavel + after);
    
    // Restaurar foco
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variavel.length;
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Criar Template de Contrato</DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            Crie um template base que poderá ser usado depois para gerar contratos com motoristas e veículos específicos
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Tipo de Contrato */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="tipo-contrato" className="text-base font-medium">
                Tipo de Contrato <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarNovoTipo(true)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Novo Tipo
              </Button>
            </div>
            <Select value={tipoContrato} onValueChange={setTipoContrato}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de contrato" />
              </SelectTrigger>
              <SelectContent>
                {tiposContrato.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parceiro Associado */}
          {(user.role === 'admin' || user.role === 'gestao') && (
            <div>
              <Label htmlFor="parceiro" className="text-base font-medium">
                Parceiro Associado <span className="text-red-500">*</span>
              </Label>
              <Select value={parceiroId} onValueChange={setParceiroId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione um parceiro" />
                </SelectTrigger>
                <SelectContent>
                {(user?.role === 'admin' || user?.role === 'gestao') && (
                  <SelectItem value="global">Template Global (todos os parceiros)</SelectItem>
                )}
                {parceiros.map((parceiro) => (
                  <SelectItem key={parceiro.id} value={parceiro.id}>
                    {parceiro.nome_empresa || parceiro.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Cada parceiro pode ter apenas 1 template ativo. Ao criar um novo, o anterior será desativado.
            </p>
            </div>
          )}

          {/* Texto do Contrato */}
          <div>
            <Label htmlFor="texto-contrato" className="text-base font-medium">
              Texto do Contrato <span className="text-red-500">*</span>
            </Label>
            
            {/* Variáveis Disponíveis */}
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Variáveis Disponíveis:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {variaveisDisponiveis.map((variavel) => (
                  <button
                    key={variavel.key}
                    onClick={() => inserirVariavel(variavel.key)}
                    className="text-xs px-2 py-1 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-400 transition-colors text-left"
                    title={variavel.desc}
                    type="button"
                  >
                    <code className="text-blue-600 font-mono">{variavel.key}</code>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Clique numa variável para inseri-la no texto do contrato
              </p>
            </div>

            {/* Text Area */}
            <Textarea
              id="texto-contrato"
              value={textoContrato}
              onChange={(e) => setTextoContrato(e.target.value)}
              placeholder="Cole ou escreva o texto do contrato aqui. Use as variáveis acima para preenchimento automático."
              className="mt-3 min-h-[300px] font-mono text-sm"
            />
          </div>

          {/* Botão Criar */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={saving || !tipoContrato || !parceiroId || !textoContrato.trim()}
              className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2"
            >
              <FileText className="w-4 h-4 mr-2" />
              {saving ? 'A criar...' : 'Criar Template'}
            </Button>
          </div>
        </div>

        {/* Diálogo Novo Tipo */}
        <Dialog open={mostrarNovoTipo} onOpenChange={setMostrarNovoTipo}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Tipo de Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="novo-tipo">Nome do Tipo</Label>
                <Input
                  id="novo-tipo"
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value)}
                  placeholder="Ex: Compra de Viatura, Leasing"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdicionarNovoTipo()}
                  className="mt-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMostrarNovoTipo(false);
                    setNovoTipo('');
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAdicionarNovoTipo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default CriarTemplateModal;
