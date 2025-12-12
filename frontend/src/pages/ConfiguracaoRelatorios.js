import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { FileText, Save, Settings } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ConfiguracaoRelatorios = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/parceiros/${user.id}/config-relatorio`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConfig(response.data);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/parceiros/${user.id}/config-relatorio`,
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Configuração salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field) => {
    setConfig({ ...config, [field]: !config[field] });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Configuração de Relatórios
              </h1>
              <p className="text-slate-600">
                Personalize os campos que aparecem nos relatórios semanais dos motoristas
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Configuração'}
          </Button>
        </div>

        {/* Cabeçalho do Relatório */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cabeçalho do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_numero_relatorio}
                  onChange={() => handleToggle('incluir_numero_relatorio')}
                  className="w-4 h-4"
                />
                <span>Número do Relatório</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_data_emissao}
                  onChange={() => handleToggle('incluir_data_emissao')}
                  className="w-4 h-4"
                />
                <span>Data de Emissão</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_periodo}
                  onChange={() => handleToggle('incluir_periodo')}
                  className="w-4 h-4"
                />
                <span>Período (Semana/Ano)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_nome_parceiro}
                  onChange={() => handleToggle('incluir_nome_parceiro')}
                  className="w-4 h-4"
                />
                <span>Nome do Parceiro</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_nome_motorista}
                  onChange={() => handleToggle('incluir_nome_motorista')}
                  className="w-4 h-4"
                />
                <span>Nome do Motorista</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_veiculo}
                  onChange={() => handleToggle('incluir_veiculo')}
                  className="w-4 h-4"
                />
                <span>Veículo (Marca/Modelo/Matrícula)</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas de Viagens */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Estatísticas de Viagens e Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_viagens_bolt}
                  onChange={() => handleToggle('incluir_viagens_bolt')}
                  className="w-4 h-4"
                />
                <span>Número de Viagens Bolt</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_viagens_uber}
                  onChange={() => handleToggle('incluir_viagens_uber')}
                  className="w-4 h-4"
                />
                <span>Número de Viagens Uber</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_viagens_totais}
                  onChange={() => handleToggle('incluir_viagens_totais')}
                  className="w-4 h-4"
                />
                <span>Viagens Totais da Semana</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_horas_bolt}
                  onChange={() => handleToggle('incluir_horas_bolt')}
                  className="w-4 h-4"
                />
                <span>Horas Totais Bolt</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_horas_uber}
                  onChange={() => handleToggle('incluir_horas_uber')}
                  className="w-4 h-4"
                />
                <span>Horas Totais Uber</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_horas_totais}
                  onChange={() => handleToggle('incluir_horas_totais')}
                  className="w-4 h-4"
                />
                <span>Horas Totais da Semana</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Ganhos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ganhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_ganhos_uber}
                  onChange={() => handleToggle('incluir_ganhos_uber')}
                  className="w-4 h-4"
                />
                <span>Ganhos Uber</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_ganhos_bolt}
                  onChange={() => handleToggle('incluir_ganhos_bolt')}
                  className="w-4 h-4"
                />
                <span>Ganhos Bolt</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_ganhos_totais}
                  onChange={() => handleToggle('incluir_ganhos_totais')}
                  className="w-4 h-4"
                />
                <span>Ganhos Totais</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_valor_aluguer}
                  onChange={() => handleToggle('incluir_valor_aluguer')}
                  className="w-4 h-4"
                />
                <span>Valor Aluguer/Comissão/Compra</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_combustivel}
                  onChange={() => handleToggle('incluir_combustivel')}
                  className="w-4 h-4"
                />
                <span>Combustível</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_via_verde}
                  onChange={() => handleToggle('incluir_via_verde')}
                  className="w-4 h-4"
                />
                <span>Via Verde</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_caucao}
                  onChange={() => handleToggle('incluir_caucao')}
                  className="w-4 h-4"
                />
                <span>Caução</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_caucao_parcelada}
                  onChange={() => handleToggle('incluir_caucao_parcelada')}
                  className="w-4 h-4"
                />
                <span>Caução Parcelada</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_danos}
                  onChange={() => handleToggle('incluir_danos')}
                  className="w-4 h-4"
                />
                <span>Danos</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_danos_acumulados}
                  onChange={() => handleToggle('incluir_danos_acumulados')}
                  className="w-4 h-4"
                />
                <span>Danos Acumulados</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_danos_descricao}
                  onChange={() => handleToggle('incluir_danos_descricao')}
                  className="w-4 h-4"
                />
                <span>Descrição dos Danos</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_danos_parcelados}
                  onChange={() => handleToggle('incluir_danos_parcelados')}
                  className="w-4 h-4"
                />
                <span>Danos Parcelados</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_extras}
                  onChange={() => handleToggle('incluir_extras')}
                  className="w-4 h-4"
                />
                <span>Extras (Débitos/Créditos)</span>
              </label>
            </div>
            <div className="mt-4">
              <Label>Atraso Via Verde (semanas)</Label>
              <Input
                type="number"
                value={config?.via_verde_atraso_semanas || 1}
                onChange={(e) =>
                  setConfig({ ...config, via_verde_atraso_semanas: parseInt(e.target.value) })
                }
                className="w-32"
                min="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Total do Recibo</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.incluir_total_recibo}
                onChange={() => handleToggle('incluir_total_recibo')}
                className="w-4 h-4"
              />
              <span>Total Recibo (Ganhos - Despesas)</span>
            </label>
          </CardContent>
        </Card>

        {/* Tabela de Combustível */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tabela Detalhada de Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.incluir_tabela_combustivel}
                  onChange={() => handleToggle('incluir_tabela_combustivel')}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Incluir Tabela de Combustível</span>
              </label>
            </div>
            {config?.incluir_tabela_combustivel && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_matricula}
                    onChange={() => handleToggle('incluir_combustivel_matricula')}
                    className="w-4 h-4"
                  />
                  <span>Matrícula</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_local}
                    onChange={() => handleToggle('incluir_combustivel_local')}
                    className="w-4 h-4"
                  />
                  <span>Local</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_data_hora}
                    onChange={() => handleToggle('incluir_combustivel_data_hora')}
                    className="w-4 h-4"
                  />
                  <span>Data e Hora</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_cartao}
                    onChange={() => handleToggle('incluir_combustivel_cartao')}
                    className="w-4 h-4"
                  />
                  <span>Cartão</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_quantidade}
                    onChange={() => handleToggle('incluir_combustivel_quantidade')}
                    className="w-4 h-4"
                  />
                  <span>Quantidade</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.incluir_combustivel_valor}
                    onChange={() => handleToggle('incluir_combustivel_valor')}
                    className="w-4 h-4"
                  />
                  <span>Valor com IVA</span>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formato e Observações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Formato do Número do Relatório</Label>
                <Input
                  type="text"
                  value={config?.formato_numero_relatorio || 'xxxxx/ano'}
                  onChange={(e) =>
                    setConfig({ ...config, formato_numero_relatorio: e.target.value })
                  }
                  placeholder="xxxxx/ano"
                  className="max-w-md"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Exemplo: xxxxx/ano gera "00001/2025"
                </p>
              </div>
              <div>
                <Label>Texto Padrão de Observações</Label>
                <textarea
                  value={config?.texto_observacoes_padrao || ''}
                  onChange={(e) =>
                    setConfig({ ...config, texto_observacoes_padrao: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Texto que aparece por padrão nas observações do relatório..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Guardar (Bottom) */}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Configuração'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracaoRelatorios;
