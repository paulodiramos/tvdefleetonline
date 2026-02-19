import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { History, User } from 'lucide-react';

const VeiculoHistoricoAtribuicoesTab = ({ vehicleId, canEdit, user }) => {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/api/vehicles/${vehicleId}/historico-atribuicoes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistorico(response.data.historico || []);
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        toast.error('Erro ao carregar histórico de atribuições');
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) {
      fetchHistorico();
    }
  }, [vehicleId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="w-5 h-5" />
          <span>Histórico de Atribuições</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum histórico de atribuições encontrado.</p>
            <p className="text-sm">O histórico será registado quando atribuir motoristas a este veículo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historico.map((entry, index) => (
              <div 
                key={entry.id} 
                className={`p-4 rounded-lg border ${!entry.data_fim ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold">{entry.motorista_nome}</span>
                    {!entry.data_fim && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Entrada: {formatDate(entry.data_inicio)}</p>
                    <p>Saída: {entry.data_fim ? formatDate(entry.data_fim) : 'Em curso'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Inicial</p>
                    <p className="font-medium">{entry.km_inicial?.toLocaleString() || '-'}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Final</p>
                    <p className="font-medium">{entry.km_final?.toLocaleString() || '-'}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Percorridos</p>
                    <p className="font-medium text-blue-600">
                      {entry.km_percorridos?.toLocaleString() || '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">Valor Aluguer/Semana</p>
                    <p className="font-medium">{formatCurrency(entry.valor_aluguer_semanal)}</p>
                  </div>
                </div>

                {entry.ganhos_periodo && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">Ganhos no Período</p>
                    <div className="flex gap-4 text-sm">
                      <span className="bg-black text-white px-2 py-1 rounded">
                        Uber: {formatCurrency(entry.ganhos_periodo.uber)}
                      </span>
                      <span className="bg-green-600 text-white px-2 py-1 rounded">
                        Bolt: {formatCurrency(entry.ganhos_periodo.bolt)}
                      </span>
                      <span className="bg-blue-600 text-white px-2 py-1 rounded">
                        Total: {formatCurrency(entry.ganhos_periodo.total)}
                      </span>
                    </div>
                  </div>
                )}

                {entry.dispositivos && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">Dispositivos Associados</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {entry.dispositivos.obu_via_verde && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          Via Verde: {entry.dispositivos.obu_via_verde}
                        </span>
                      )}
                      {entry.dispositivos.cartao_combustivel_fossil && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          Combustível: {entry.dispositivos.cartao_combustivel_fossil}
                        </span>
                      )}
                      {entry.dispositivos.cartao_combustivel_eletrico && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Elétrico: {entry.dispositivos.cartao_combustivel_eletrico}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VeiculoHistoricoAtribuicoesTab;
