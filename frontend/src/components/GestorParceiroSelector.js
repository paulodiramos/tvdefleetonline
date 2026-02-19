import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';

const GestorParceiroSelector = ({ user, onParceiroChange }) => {
  const [parceirosAtribuidos, setParceirosAtribuidos] = useState([]);
  const [parceiroAtivo, setParceiroAtivo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'gestao') {
      fetchParceirosAtribuidos();
    }
  }, [user]);

  const fetchParceirosAtribuidos = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Buscar parceiros atribuídos ao gestor
      const response = await axios.get(`${API}/gestores/${user.id}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const parceiros = response.data.parceiros || [];
      setParceirosAtribuidos(parceiros);
      
      // Buscar parceiro ativo atual
      try {
        const ativoRes = await axios.get(`${API}/gestores/${user.id}/parceiro-ativo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (ativoRes.data.parceiro_ativo_id) {
          const parceiroAtual = parceiros.find(p => p.id === ativoRes.data.parceiro_ativo_id);
          setParceiroAtivo(parceiroAtual || null);
          
          // Notificar o componente pai
          if (onParceiroChange && parceiroAtual) {
            onParceiroChange(parceiroAtual);
          }
        }
      } catch (err) {
        console.log('Nenhum parceiro ativo definido');
      }
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionarParceiro = async (parceiro) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/gestores/${user.id}/selecionar-parceiro`,
        { parceiro_id: parceiro?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setParceiroAtivo(parceiro);
      
      if (onParceiroChange) {
        onParceiroChange(parceiro);
      }
      
      if (parceiro) {
        toast.success(`A gerir: ${parceiro.nome_empresa || parceiro.name}`);
      } else {
        toast.info('Visualização geral ativada');
      }
      
      // Recarregar a página para atualizar os dados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao selecionar parceiro:', error);
      toast.error('Erro ao selecionar parceiro');
    }
  };

  // Só mostrar para gestores
  if (user?.role !== 'gestao') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-lg">
        <Building2 className="w-4 h-4 text-slate-400 animate-pulse" />
        <span className="text-sm text-slate-400">A carregar...</span>
      </div>
    );
  }

  if (parceirosAtribuidos.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Building2 className="w-4 h-4 text-yellow-600" />
        <span className="text-sm text-yellow-700">Sem parceiros atribuídos</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`flex items-center space-x-2 ${parceiroAtivo ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
          data-testid="gestor-parceiro-selector"
        >
          <Building2 className="w-4 h-4" />
          <span className="max-w-[150px] truncate">
            {parceiroAtivo ? (parceiroAtivo.nome_empresa || parceiroAtivo.name) : 'Selecionar Parceiro'}
          </span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Gerir como Parceiro</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Opção para ver todos (sem filtro de parceiro) */}
        <DropdownMenuItem 
          onClick={() => handleSelecionarParceiro(null)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-slate-600">Ver Todos</span>
            {!parceiroAtivo && <Check className="w-4 h-4 text-green-600" />}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {parceirosAtribuidos.map((parceiro) => (
          <DropdownMenuItem 
            key={parceiro.id}
            onClick={() => handleSelecionarParceiro(parceiro)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">
                  {parceiro.nome_empresa || parceiro.name || 'Sem nome'}
                </span>
                <span className="text-xs text-slate-500">
                  {parceiro.email || 'N/A'}
                </span>
              </div>
              {parceiroAtivo?.id === parceiro.id && (
                <Check className="w-4 h-4 text-green-600 ml-2" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GestorParceiroSelector;
