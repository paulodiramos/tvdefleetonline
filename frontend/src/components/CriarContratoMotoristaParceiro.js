import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Save, Loader2 } from 'lucide-react';

const CriarContratoMotoristaParceiro = ({ user, parceiroId, onContratoCreated }) => {
  const [templates, setTemplates] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Use parceiroId do prop ou user.id se for parceiro
  const actualParceiroId = parceiroId || (user?.role === 'parceiro' ? user.id : null);

  const [form, setForm] = useState({
    template_id: '',
    motorista_id: '',
    veiculo_id: ''
  });

  useEffect(() => {
    if (actualParceiroId) {
      fetchData();
    }
  }, [actualParceiroId]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('token');

      // Buscar templates do parceiro
      const templatesRes = await axios.get(`${API}/templates-contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filtrar templates do parceiro
      const myTemplates = templatesRes.data.filter(t => 
        t.parceiro_id === actualParceiroId || t.tipo_contrato === 'motorista'
      );
      setTemplates(myTemplates);

      // Buscar motoristas do parceiro
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myMotoristas = motoristasRes.data.filter(m => m.parceiro_id === actualParceiroId);
      setMotoristas(myMotoristas);

      // Buscar veículos do parceiro
      const veiculosRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myVeiculos = veiculosRes.data.filter(v => v.parceiro_id === actualParceiroId);
      setVeiculos(myVeiculos);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.template_id || !form.motorista_id || !form.veiculo_id) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const payload = {
        parceiro_id: actualParceiroId,
        motorista_id: form.motorista_id,
        veiculo_id: form.veiculo_id,
        template_id: form.template_id
      };

      await axios.post(`${API}/contratos`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Contrato criado com sucesso!');
      
      // Reset form
      setForm({
        template_id: '',
        motorista_id: '',
        veiculo_id: ''
      });

      if (onContratoCreated) {
        onContratoCreated();
      }

    } catch (error) {
      console.error('Error creating contract:', error);
      const errorMsg = error.response?.data?.detail || 'Erro ao criar contrato';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <span>Gerar Contrato de Motorista</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template */}
          <div>
            <Label>Template de Contrato *</Label>
            <Select
              value={form.template_id}
              onValueChange={(value) => setForm({ ...form, template_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum template disponível
                  </SelectItem>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                Crie um template primeiro na aba "Templates"
              </p>
            )}
          </div>

          {/* Motorista */}
          <div>
            <Label>Motorista *</Label>
            <Select
              value={form.motorista_id}
              onValueChange={(value) => setForm({ ...form, motorista_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motorista" />
              </SelectTrigger>
              <SelectContent>
                {motoristas.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum motorista disponível
                  </SelectItem>
                ) : (
                  motoristas.map((motorista) => (
                    <SelectItem key={motorista.id} value={motorista.id}>
                      {motorista.name} - {motorista.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Veículo */}
          <div>
            <Label>Veículo *</Label>
            <Select
              value={form.veiculo_id}
              onValueChange={(value) => setForm({ ...form, veiculo_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculos.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum veículo disponível
                  </SelectItem>
                ) : (
                  veiculos.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      {veiculo.matricula} - {veiculo.marca} {veiculo.modelo}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              disabled={loading || templates.length === 0 || motoristas.length === 0 || veiculos.length === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Gerar Contrato
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">ℹ️ Informação</p>
            <p>
              O contrato será gerado automaticamente com base no template selecionado,
              vinculando o motorista ao veículo escolhido.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CriarContratoMotoristaParceiro;
