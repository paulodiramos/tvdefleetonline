import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle,
  Car, MapPin, CreditCard, Fuel, Download
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ImportarPlataformas = () => {
  const navigate = useNavigate();
  const [plataformaSelecionada, setPlataformaSelecionada] = useState('uber');
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState(null);

  const plataformas = [
    {
      id: 'uber',
      nome: 'Uber',
      icon: Car,
      color: 'bg-black text-white',
      formato: 'data,hora,motorista_email,origem,destino,distancia_km,duracao_min,valor_bruto,comissao,valor_liquido',
      exemplo: '2025-01-15,14:30,motorista@example.com,Rua A Lisboa,Rua B Lisboa,12.5,25,15.50,3.10,12.40',
      campos: [
        { nome: 'data', tipo: 'Data', obrigatorio: true },
        { nome: 'hora', tipo: 'Hora', obrigatorio: true },
        { nome: 'motorista_email', tipo: 'Email', obrigatorio: true },
        { nome: 'origem', tipo: 'Texto', obrigatorio: false },
        { nome: 'destino', tipo: 'Texto', obrigatorio: false },
        { nome: 'distancia_km', tipo: 'Número', obrigatorio: true },
        { nome: 'duracao_min', tipo: 'Número', obrigatorio: false },
        { nome: 'valor_bruto', tipo: 'Número', obrigatorio: true },
        { nome: 'comissao', tipo: 'Número', obrigatorio: false },
        { nome: 'valor_liquido', tipo: 'Número', obrigatorio: true }
      ]
    },
    {
      id: 'bolt',
      nome: 'Bolt',
      icon: Car,
      color: 'bg-green-600 text-white',
      formato: 'data,hora,motorista_email,origem,destino,distancia_km,duracao_min,valor_bruto,comissao,valor_liquido',
      exemplo: '2025-01-15,15:45,motorista@example.com,Praça do Comércio,Parque das Nações,8.2,18,12.80,2.56,10.24',
      campos: [
        { nome: 'data', tipo: 'Data', obrigatorio: true },
        { nome: 'hora', tipo: 'Hora', obrigatorio: true },
        { nome: 'motorista_email', tipo: 'Email', obrigatorio: true },
        { nome: 'origem', tipo: 'Texto', obrigatorio: false },
        { nome: 'destino', tipo: 'Texto', obrigatorio: false },
        { nome: 'distancia_km', tipo: 'Número', obrigatorio: true },
        { nome: 'duracao_min', tipo: 'Número', obrigatorio: false },
        { nome: 'valor_bruto', tipo: 'Número', obrigatorio: true },
        { nome: 'comissao', tipo: 'Número', obrigatorio: false },
        { nome: 'valor_liquido', tipo: 'Número', obrigatorio: true }
      ]
    },
    {
      id: 'viaverde',
      nome: 'Via Verde',
      icon: CreditCard,
      color: 'bg-blue-600 text-white',
      formato: 'data,hora,motorista_email,portagem,valor,via,sentido',
      exemplo: '2025-01-15,16:20,motorista@example.com,A1 Alverca,2.35,A1,Norte-Sul',
      campos: [
        { nome: 'data', tipo: 'Data', obrigatorio: true },
        { nome: 'hora', tipo: 'Hora', obrigatorio: true },
        { nome: 'motorista_email', tipo: 'Email', obrigatorio: true },
        { nome: 'portagem', tipo: 'Texto', obrigatorio: true },
        { nome: 'valor', tipo: 'Número', obrigatorio: true },
        { nome: 'via', tipo: 'Texto', obrigatorio: false },
        { nome: 'sentido', tipo: 'Texto', obrigatorio: false }
      ]
    },
    {
      id: 'gps',
      nome: 'GPS / Trajetos',
      icon: MapPin,
      color: 'bg-purple-600 text-white',
      formato: 'data,motorista_email,km_inicial,km_final,km_percorridos,tempo_total_min',
      exemplo: '2025-01-15,motorista@example.com,45230,45385,155,480',
      campos: [
        { nome: 'data', tipo: 'Data', obrigatorio: true },
        { nome: 'motorista_email', tipo: 'Email', obrigatorio: true },
        { nome: 'km_inicial', tipo: 'Número', obrigatorio: true },
        { nome: 'km_final', tipo: 'Número', obrigatorio: true },
        { nome: 'km_percorridos', tipo: 'Número', obrigatorio: true },
        { nome: 'tempo_total_min', tipo: 'Número', obrigatorio: false }
      ]
    },
    {
      id: 'abastecimento',
      nome: 'Abastecimentos',
      icon: Fuel,
      color: 'bg-red-600 text-white',
      formato: 'data,hora,motorista_email,posto,combustivel,litros,valor_total,km_atual',
      exemplo: '2025-01-15,18:00,motorista@example.com,Galp Benfica,Gasolina 95,45.5,85.75,45385',
      campos: [
        { nome: 'data', tipo: 'Data', obrigatorio: true },
        { nome: 'hora', tipo: 'Hora', obrigatorio: true },
        { nome: 'motorista_email', tipo: 'Email', obrigatorio: true },
        { nome: 'posto', tipo: 'Texto', obrigatorio: false },
        { nome: 'combustivel', tipo: 'Texto', obrigatorio: false },
        { nome: 'litros', tipo: 'Número', obrigatorio: true },
        { nome: 'valor_total', tipo: 'Número', obrigatorio: true },
        { nome: 'km_atual', tipo: 'Número', obrigatorio: false }
      ]
    }
  ];

  const plataformaAtual = plataformas.find(p => p.id === plataformaSelecionada);

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
    setResultado(null);
  };

  const handleImportar = async () => {
    if (!csvFile) {
      toast.error('Selecione um ficheiro CSV');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('plataforma', plataformaSelecionada);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/importar/${plataformaSelecionada}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResultado(response.data);
      toast.success(
        `✅ ${response.data.sucesso} registo(s) importado(s) com sucesso!`
      );
      setCsvFile(null);
      document.getElementById('file-input').value = '';
    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = (plataforma) => {
    const p = plataformas.find(pl => pl.id === plataforma);
    const csvContent = p.formato + '\n' + p.exemplo;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${plataforma}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Template ${p.nome} descarregado!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/relatorios')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Importar Dados por Plataforma
            </h1>
            <p className="text-slate-600">
              Importar viagens, portagens, GPS e abastecimentos
            </p>
          </div>
        </div>

        {/* Seleção de Plataforma */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {plataformas.map((plat) => {
            const Icon = plat.icon;
            const isActive = plataformaSelecionada === plat.id;
            
            return (
              <Card
                key={plat.id}
                className={`cursor-pointer transition-all ${
                  isActive ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
                }`}
                onClick={() => {
                  setPlataformaSelecionada(plat.id);
                  setCsvFile(null);
                  setResultado(null);
                }}
              >
                <CardContent className="p-4 text-center">
                  <div className={`inline-flex p-3 rounded-lg ${plat.color} mb-2`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-sm">{plat.nome}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Área de Importação */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Instruções */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Formato CSV - {plataformaAtual.nome}
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Colunas:</p>
                    <code className="block text-[10px] bg-slate-100 p-2 rounded border text-slate-700 overflow-x-auto">
                      {plataformaAtual.formato}
                    </code>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Exemplo:</p>
                    <code className="block text-[10px] bg-slate-100 p-2 rounded border text-slate-700 overflow-x-auto">
                      {plataformaAtual.exemplo}
                    </code>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate(plataformaSelecionada)}
                    className="w-full"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Descarregar Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Campos */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Descrição dos Campos</h3>
                <div className="space-y-2">
                  {plataformaAtual.campos.map((campo, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-semibold text-slate-700">{campo.nome}</span>
                      <span className="text-slate-500"> ({campo.tipo})</span>
                      {campo.obrigatorio && (
                        <Badge className="ml-2 text-[10px] bg-red-100 text-red-700">Obrigatório</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2: Upload e Resultado */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="file-input">Ficheiro CSV</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="cursor-pointer mt-2"
                  />
                  {csvFile && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Atenção:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Emails dos motoristas devem existir no sistema</li>
                      <li>Primeira linha deve ser o cabeçalho</li>
                      <li>Usar ponto (.) como separador decimal</li>
                      <li>Datas no formato YYYY-MM-DD (2025-01-15)</li>
                      <li>Horas no formato HH:MM (14:30)</li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={handleImportar}
                  disabled={!csvFile || uploading}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A importar...' : `Importar ${plataformaAtual.nome}`}
                </Button>
              </CardContent>
            </Card>

            {/* Resultado */}
            {resultado && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Resultado da Importação</h3>
                  <div className={`p-4 rounded-lg border ${
                    resultado.erros === 0 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="space-y-2">
                      <p className="text-sm">
                        ✅ <strong>{resultado.sucesso}</strong> registo(s) importado(s)
                      </p>
                      {resultado.erros > 0 && (
                        <>
                          <p className="text-sm">
                            ❌ <strong>{resultado.erros}</strong> erro(s)
                          </p>
                          {resultado.erros_detalhes && resultado.erros_detalhes.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-semibold mb-1">Detalhes:</p>
                              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                                {resultado.erros_detalhes.map((erro, idx) => (
                                  <li key={idx} className="text-red-700">• {erro}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarPlataformas;
