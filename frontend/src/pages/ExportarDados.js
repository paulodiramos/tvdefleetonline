import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Download,
  Users,
  Car,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  CheckSquare,
  Square,
  Archive
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ExportarDados = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [camposDisponiveis, setCamposDisponiveis] = useState({ motoristas: [], veiculos: [] });
  const [camposMotoristaSelecionados, setCamposMotoristaSelecionados] = useState([]);
  const [camposVeiculoSelecionados, setCamposVeiculoSelecionados] = useState([]);
  const [delimitador, setDelimitador] = useState(';');

  useEffect(() => {
    carregarCampos();
  }, []);

  const carregarCampos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/exportacao/campos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCamposDisponiveis(response.data);
      
      // Selecionar campos default
      setCamposMotoristaSelecionados(
        response.data.motoristas.filter(c => c.default).map(c => c.id)
      );
      setCamposVeiculoSelecionados(
        response.data.veiculos.filter(c => c.default).map(c => c.id)
      );
    } catch (error) {
      console.error('Erro ao carregar campos:', error);
      toast.error('Erro ao carregar campos disponíveis');
    } finally {
      setLoading(false);
    }
  };

  const toggleCampoMotorista = (campoId) => {
    setCamposMotoristaSelecionados(prev => 
      prev.includes(campoId) 
        ? prev.filter(c => c !== campoId)
        : [...prev, campoId]
    );
  };

  const toggleCampoVeiculo = (campoId) => {
    setCamposVeiculoSelecionados(prev => 
      prev.includes(campoId) 
        ? prev.filter(c => c !== campoId)
        : [...prev, campoId]
    );
  };

  const selecionarTodosMot = () => {
    setCamposMotoristaSelecionados(camposDisponiveis.motoristas.map(c => c.id));
  };

  const deselecionarTodosMot = () => {
    setCamposMotoristaSelecionados([]);
  };

  const selecionarTodosVeic = () => {
    setCamposVeiculoSelecionados(camposDisponiveis.veiculos.map(c => c.id));
  };

  const deselecionarTodosVeic = () => {
    setCamposVeiculoSelecionados([]);
  };

  const exportarMotoristas = async () => {
    if (camposMotoristaSelecionados.length === 0) {
      toast.error('Selecione pelo menos um campo para exportar');
      return;
    }

    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const campos = camposMotoristaSelecionados.join(',');
      
      const response = await axios.get(
        `${API}/api/exportacao/motoristas?campos=${campos}&delimitador=${delimitador}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Download do ficheiro
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `motoristas_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Exportação de motoristas concluída!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar motoristas');
    } finally {
      setExporting(false);
    }
  };

  const exportarVeiculos = async () => {
    if (camposVeiculoSelecionados.length === 0) {
      toast.error('Selecione pelo menos um campo para exportar');
      return;
    }

    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const campos = camposVeiculoSelecionados.join(',');
      
      const response = await axios.get(
        `${API}/api/exportacao/veiculos?campos=${campos}&delimitador=${delimitador}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Download do ficheiro
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `veiculos_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Exportação de veículos concluída!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar veículos');
    } finally {
      setExporting(false);
    }
  };

  const exportarTudo = async () => {
    if (camposMotoristaSelecionados.length === 0 && camposVeiculoSelecionados.length === 0) {
      toast.error('Selecione pelo menos um campo para exportar');
      return;
    }

    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const camposMot = camposMotoristaSelecionados.join(',');
      const camposVeic = camposVeiculoSelecionados.join(',');
      
      const response = await axios.get(
        `${API}/api/exportacao/completa?campos_motoristas=${camposMot}&campos_veiculos=${camposVeic}&delimitador=${delimitador}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Download do ficheiro ZIP
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exportacao_completa_${new Date().toISOString().slice(0,10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Exportação completa concluída!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="exportar-dados-page">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Exportar Dados
            </h1>
            <p className="text-slate-500">Exporte os dados de motoristas e veículos para CSV</p>
          </div>
        </div>

        {/* Opções de Formato */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Formato do Ficheiro</CardTitle>
            <CardDescription>Escolha o separador de colunas para compatibilidade com o seu programa</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={delimitador} onValueChange={setDelimitador} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value=";" id="semicolon" data-testid="radio-semicolon" />
                <Label htmlFor="semicolon" className="cursor-pointer">
                  Ponto-e-vírgula (;) - <span className="text-slate-500">Excel português</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="," id="comma" data-testid="radio-comma" />
                <Label htmlFor="comma" className="cursor-pointer">
                  Vírgula (,) - <span className="text-slate-500">Padrão internacional</span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="motoristas" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="motoristas" className="flex items-center gap-2" data-testid="tab-motoristas">
              <Users className="w-4 h-4" />
              Motoristas
            </TabsTrigger>
            <TabsTrigger value="veiculos" className="flex items-center gap-2" data-testid="tab-veiculos">
              <Car className="w-4 h-4" />
              Veículos
            </TabsTrigger>
          </TabsList>

          {/* Motoristas */}
          <TabsContent value="motoristas">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Campos de Motoristas
                    </CardTitle>
                    <CardDescription>
                      Selecione os campos que pretende incluir na exportação
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selecionarTodosMot}>
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselecionarTodosMot}>
                      <Square className="w-4 h-4 mr-1" />
                      Nenhum
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {camposDisponiveis.motoristas.map((campo) => (
                    <div key={campo.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`mot-${campo.id}`}
                        checked={camposMotoristaSelecionados.includes(campo.id)}
                        onCheckedChange={() => toggleCampoMotorista(campo.id)}
                        data-testid={`checkbox-mot-${campo.id}`}
                      />
                      <Label 
                        htmlFor={`mot-${campo.id}`} 
                        className="text-sm cursor-pointer"
                      >
                        {campo.label}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    {camposMotoristaSelecionados.length} campo(s) selecionado(s)
                  </p>
                  <Button 
                    onClick={exportarMotoristas} 
                    disabled={exporting || camposMotoristaSelecionados.length === 0}
                    data-testid="btn-exportar-motoristas"
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Exportar Motoristas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Veículos */}
          <TabsContent value="veiculos">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-green-600" />
                      Campos de Veículos
                    </CardTitle>
                    <CardDescription>
                      Selecione os campos que pretende incluir na exportação
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selecionarTodosVeic}>
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselecionarTodosVeic}>
                      <Square className="w-4 h-4 mr-1" />
                      Nenhum
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {camposDisponiveis.veiculos.map((campo) => (
                    <div key={campo.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`veic-${campo.id}`}
                        checked={camposVeiculoSelecionados.includes(campo.id)}
                        onCheckedChange={() => toggleCampoVeiculo(campo.id)}
                        data-testid={`checkbox-veic-${campo.id}`}
                      />
                      <Label 
                        htmlFor={`veic-${campo.id}`} 
                        className="text-sm cursor-pointer"
                      >
                        {campo.label}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    {camposVeiculoSelecionados.length} campo(s) selecionado(s)
                  </p>
                  <Button 
                    onClick={exportarVeiculos} 
                    disabled={exporting || camposVeiculoSelecionados.length === 0}
                    data-testid="btn-exportar-veiculos"
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Exportar Veículos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Exportar Tudo */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Exportação Completa</h3>
                  <p className="text-sm text-slate-500">
                    Exporte motoristas e veículos num único ficheiro ZIP
                  </p>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={exportarTudo} 
                disabled={exporting || (camposMotoristaSelecionados.length === 0 && camposVeiculoSelecionados.length === 0)}
                data-testid="btn-exportar-tudo"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4 mr-2" />
                )}
                Exportar Tudo (ZIP)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ExportarDados;
