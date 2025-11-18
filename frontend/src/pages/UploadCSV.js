import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, AlertCircle, Download, Car, MapPin, Zap, Fuel as FuelIcon, UserPlus, CarFront } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PLATAFORMAS = [
  { 
    id: 'uber', 
    nome: 'Uber', 
    accept: '.csv', 
    icon: Car,
    endpoint: '/operacional/upload-csv-uber'
  },
  { 
    id: 'bolt', 
    nome: 'Bolt', 
    accept: '.csv', 
    icon: Car,
    endpoint: '/operacional/upload-csv-bolt'
  },
  { 
    id: 'viaverde', 
    nome: 'Via Verde (Portagens)', 
    accept: '.xlsx', 
    icon: MapPin,
    endpoint: '/import/viaverde'
  },
  { 
    id: 'gps', 
    nome: 'GPS / Distância', 
    accept: '.csv', 
    icon: MapPin,
    endpoint: '/import/gps'
  },
  { 
    id: 'combustivel_eletrico', 
    nome: 'Combustível Elétrico', 
    accept: '.xlsx', 
    icon: Zap,
    endpoint: '/import/combustivel-eletrico'
  },
  { 
    id: 'combustivel_fossil', 
    nome: 'Combustível Fóssil', 
    accept: '.xlsx', 
    icon: FuelIcon,
    endpoint: '/import/combustivel-fossil'
  }
];

const UploadCSV = ({ user, onLogout }) => {
  const [plataformaSelecionada, setPlataformaSelecionada] = useState('uber');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parceiros, setParceiros] = useState([]);
  const [parceiroSelecionado, setParceiroSelecionado] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Modals state
  const [motoristasNaoEncontrados, setMotoristasNaoEncontrados] = useState([]);
  const [veiculosNaoEncontrados, setVeiculosNaoEncontrados] = useState([]);
  const [showMotoristaModal, setShowMotoristaModal] = useState(false);
  const [showVeiculoModal, setShowVeiculoModal] = useState(false);
  
  // Form state for new motorista
  const [novoMotorista, setNovoMotorista] = useState({
    name: '',
    email: '',
    phone: '',
    nif: '',
    morada: ''
  });
  
  // Form state for new vehicle
  const [novoVeiculo, setNovoVeiculo] = useState({
    matricula: '',
    marca: '',
    modelo: '',
    ano: '',
    cor: ''
  });

  const isAdminOrGestao = user?.role === 'admin' || user?.role === 'gestao';

  useEffect(() => {
    if (isAdminOrGestao) {
      fetchParceiros();
    } else {
      setParceiroSelecionado(user.id);
    }
  }, [user]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      if (response.data.length > 0) {
        setParceiroSelecionado(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching parceiros', error);
      toast.error('Erro ao carregar lista de parceiros');
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!periodoInicio || !periodoFim) {
      toast.error('Preencha o período (início e fim)');
      return;
    }

    if (!selectedFile) {
      toast.error('Selecione um ficheiro para upload');
      return;
    }

    if (!parceiroSelecionado) {
      toast.error('Selecione um parceiro');
      return;
    }

    setUploading(true);

    try {
      const plataforma = PLATAFORMAS.find(p => p.id === plataformaSelecionada);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('parceiro_id', parceiroSelecionado);
      formData.append('periodo_inicio', periodoInicio);
      formData.append('periodo_fim', periodoFim);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}${plataforma.endpoint}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Mensagem de sucesso customizada por plataforma
      let successMsg = '';
      switch(plataformaSelecionada) {
        case 'uber':
          successMsg = `✅ Uber: ${response.data.registos_importados} registos, Total: €${response.data.total_pago?.toFixed(2) || 0}`;
          break;
        case 'bolt':
          successMsg = `✅ Bolt: ${response.data.registos_importados} registos, Ganhos: €${response.data.ganhos_liquidos?.toFixed(2) || 0}`;
          break;
        case 'viaverde':
          successMsg = `✅ Via Verde: ${response.data.movimentos_importados} movimentos, Total: €${response.data.total_value?.toFixed(2) || 0}`;
          break;
        case 'gps':
          successMsg = `✅ GPS: ${response.data.registos_importados} registos, Distância: ${response.data.total_distancia_km?.toFixed(2) || 0} km`;
          break;
        case 'combustivel_eletrico':
          successMsg = `✅ Elétrico: ${response.data.transacoes_importadas} transações, Energia: ${response.data.total_energia_kwh?.toFixed(2) || 0} kWh, Custo: €${response.data.total_custo_eur?.toFixed(2) || 0}`;
          break;
        case 'combustivel_fossil':
          successMsg = `✅ Combustível: ${response.data.transacoes_importadas} transações, Litros: ${response.data.total_litros?.toFixed(2) || 0}, Custo: €${response.data.total_valor_eur?.toFixed(2) || 0}`;
          break;
        default:
          successMsg = '✅ Importação concluída com sucesso!';
      }
      
      toast.success(successMsg);
      
      // Check for motoristas/veiculos não encontrados
      if (response.data.motoristas_nao_encontrados && response.data.motoristas_nao_encontrados.length > 0) {
        setMotoristasNaoEncontrados(response.data.motoristas_nao_encontrados);
        setShowMotoristaModal(true);
      }
      
      if (response.data.veiculos_nao_encontrados && response.data.veiculos_nao_encontrados.length > 0) {
        setVeiculosNaoEncontrados(response.data.veiculos_nao_encontrados);
        setShowVeiculoModal(true);
      }
      
      setSelectedFile(null);
      document.getElementById('file-upload').value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const handleCriarMotorista = async (motorista) => {
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: motorista.nome || motorista.name,
        email: motorista.email || `motorista_${Date.now()}@temp.com`,
        phone: motorista.telefone || motorista.phone || '',
        nif: novoMotorista.nif || '',
        morada: novoMotorista.morada || '',
        status: 'ativo',
        parceiro_atribuido: parceiroSelecionado
      };
      
      await axios.post(`${API}/motoristas`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Motorista ${payload.name} criado com sucesso!`);
      
      // Remove from list
      setMotoristasNaoEncontrados(prev => 
        prev.filter(m => m.nome !== motorista.nome && m.name !== motorista.name)
      );
      
      // Reset form
      setNovoMotorista({ name: '', email: '', phone: '', nif: '', morada: '' });
      
      // Close modal if no more motoristas
      if (motoristasNaoEncontrados.length <= 1) {
        setShowMotoristaModal(false);
      }
    } catch (error) {
      console.error('Error creating motorista:', error);
      toast.error('Erro ao criar motorista');
    }
  };

  const handleCriarVeiculo = async (veiculo) => {
    try {
      const token = localStorage.getItem('token');
      const payload = {
        matricula: veiculo.matricula,
        marca: novoVeiculo.marca || '',
        modelo: novoVeiculo.modelo || '',
        ano: novoVeiculo.ano ? parseInt(novoVeiculo.ano) : null,
        cor: novoVeiculo.cor || '',
        status: 'ativo',
        parceiro_id: parceiroSelecionado
      };
      
      await axios.post(`${API}/vehicles`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Veículo ${payload.matricula} criado com sucesso!`);
      
      // Remove from list
      setVeiculosNaoEncontrados(prev => 
        prev.filter(v => v.matricula !== veiculo.matricula)
      );
      
      // Reset form
      setNovoVeiculo({ matricula: '', marca: '', modelo: '', ano: '', cor: '' });
      
      // Close modal if no more vehicles
      if (veiculosNaoEncontrados.length <= 1) {
        setShowVeiculoModal(false);
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast.error('Erro ao criar veículo');
    }
  };

  const handleDownloadTemplate = async (templateName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/templates/csv/${templateName}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${templateName}_exemplo.${templateName === 'prio' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Template ${templateName} descarregado`);
    } catch (error) {
      console.error('Error downloading template', error);
      toast.error('Erro ao descarregar template');
    }
  };

  const plataformaAtual = PLATAFORMAS.find(p => p.id === plataformaSelecionada);
  const IconComponent = plataformaAtual?.icon || Upload;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Importar Dados Financeiros</h1>
          <p className="text-slate-600 mt-2">Upload manual de ficheiros CSV/Excel por plataforma</p>
        </div>

        {/* Card de Configuração */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seletor de Plataforma */}
            <div>
              <Label htmlFor="plataforma">Plataforma *</Label>
              <Select value={plataformaSelecionada} onValueChange={setPlataformaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map(plat => (
                    <SelectItem key={plat.id} value={plat.id}>
                      {plat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Parceiro (apenas para Admin/Gestão) */}
            {isAdminOrGestao && (
              <div>
                <Label htmlFor="parceiro">Parceiro *</Label>
                <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {parceiros.map(parceiro => (
                      <SelectItem key={parceiro.id} value={parceiro.id}>
                        {parceiro.nome_empresa || parceiro.name || parceiro.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodo-inicio">Período Início *</Label>
                <Input
                  id="periodo-inicio"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="periodo-fim">Período Fim *</Label>
                <Input
                  id="periodo-fim"
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <IconComponent className="w-5 h-5" />
                <span>{plataformaAtual?.nome}</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleDownloadTemplate(plataformaSelecionada)}
                type="button"
              >
                <Download className="w-4 h-4 mr-2" />
                Exemplo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label htmlFor="file-upload">
                  Ficheiro {plataformaAtual?.accept.replace('.', '').toUpperCase()}
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept={plataformaAtual?.accept}
                  onChange={handleFileChange}
                  disabled={uploading}
                  required
                />
                {selectedFile && (
                  <p className="text-sm text-slate-600 mt-2">
                    Ficheiro selecionado: <strong>{selectedFile.name}</strong>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={uploading} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'A enviar...' : `Importar ${plataformaAtual?.nome}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Informação adicional */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Notas importantes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Os ficheiros são armazenados de forma segura para auditoria</li>
                  <li>Certifique-se que o período corresponde aos dados do ficheiro</li>
                  <li>Em caso de erro, verifique se o formato do ficheiro está correto</li>
                  <li>Pode descarregar o ficheiro de exemplo para verificar o formato esperado</li>
                  <li>Se motoristas ou veículos não forem encontrados, será solicitado criá-los</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal para Motoristas Não Encontrados */}
      <Dialog open={showMotoristaModal} onOpenChange={setShowMotoristaModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserPlus className="w-5 h-5" />
              <span>Motoristas Não Encontrados</span>
            </DialogTitle>
            <DialogDescription>
              Os seguintes motoristas não foram encontrados no sistema. Crie-os rapidamente:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {motoristasNaoEncontrados.map((motorista, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="font-semibold text-lg">
                    {motorista.nome || motorista.name}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input 
                        value={motorista.email || ''} 
                        placeholder="email@exemplo.com"
                        onChange={(e) => {
                          const updated = [...motoristasNaoEncontrados];
                          updated[index].email = e.target.value;
                          setMotoristasNaoEncontrados(updated);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input 
                        value={motorista.telefone || motorista.phone || ''}
                        placeholder="+351..."
                        onChange={(e) => {
                          const updated = [...motoristasNaoEncontrados];
                          updated[index].telefone = e.target.value;
                          setMotoristasNaoEncontrados(updated);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>NIF (opcional)</Label>
                      <Input 
                        value={novoMotorista.nif}
                        placeholder="123456789"
                        onChange={(e) => setNovoMotorista({...novoMotorista, nif: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Morada (opcional)</Label>
                      <Input 
                        value={novoMotorista.morada}
                        placeholder="Rua..."
                        onChange={(e) => setNovoMotorista({...novoMotorista, morada: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleCriarMotorista(motorista)} 
                    className="w-full"
                    size="sm"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Motorista
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowMotoristaModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Veículos Não Encontrados */}
      <Dialog open={showVeiculoModal} onOpenChange={setShowVeiculoModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CarFront className="w-5 h-5" />
              <span>Veículos Não Encontrados</span>
            </DialogTitle>
            <DialogDescription>
              Os seguintes veículos não foram encontrados no sistema. Crie-os rapidamente:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {veiculosNaoEncontrados.map((veiculo, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="font-semibold text-lg">
                    Matrícula: {veiculo.matricula}
                  </div>
                  {veiculo.condutor_atual && (
                    <p className="text-sm text-slate-600">Condutor atual: {veiculo.condutor_atual}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Marca *</Label>
                      <Input 
                        value={novoVeiculo.marca}
                        placeholder="Toyota, Mercedes..."
                        onChange={(e) => setNovoVeiculo({...novoVeiculo, marca: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Modelo *</Label>
                      <Input 
                        value={novoVeiculo.modelo}
                        placeholder="Corolla, Classe A..."
                        onChange={(e) => setNovoVeiculo({...novoVeiculo, modelo: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Ano</Label>
                      <Input 
                        type="number"
                        value={novoVeiculo.ano}
                        placeholder="2020"
                        onChange={(e) => setNovoVeiculo({...novoVeiculo, ano: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <Input 
                        value={novoVeiculo.cor}
                        placeholder="Branco, Preto..."
                        onChange={(e) => setNovoVeiculo({...novoVeiculo, cor: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleCriarVeiculo(veiculo)} 
                    className="w-full"
                    size="sm"
                    disabled={!novoVeiculo.marca || !novoVeiculo.modelo}
                  >
                    <CarFront className="w-4 h-4 mr-2" />
                    Criar Veículo
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowVeiculoModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default UploadCSV;
