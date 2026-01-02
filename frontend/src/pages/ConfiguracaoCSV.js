import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Upload, 
  Settings, 
  Plus, 
  Trash2, 
  Save,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  Edit
} from "lucide-react";

export default function ConfiguracaoCSV({ user }) {
  const [plataformas, setPlataformas] = useState([]);
  const [configuracoes, setConfiguracoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("configs");
  
  // Modal states
  const [showNovaConfig, setShowNovaConfig] = useState(false);
  const [showAnalisar, setShowAnalisar] = useState(false);
  const [showTestar, setShowTestar] = useState(false);
  
  // Form states
  const [selectedPlataforma, setSelectedPlataforma] = useState("");
  const [camposSistema, setCamposSistema] = useState([]);
  const [mapeamentosPadrao, setMapeamentosPadrao] = useState([]);
  const [novaConfig, setNovaConfig] = useState({
    nome_configuracao: "",
    descricao: "",
    delimitador: ",",
    encoding: "utf-8",
    skip_linhas: 0,
    mapeamentos: []
  });
  
  // Análise states
  const [analiseFile, setAnaliseFile] = useState(null);
  const [analiseResultado, setAnaliseResultado] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  
  // Test import states
  const [testeFile, setTesteFile] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    fetchPlataformas();
    fetchConfiguracoes();
  }, []);

  useEffect(() => {
    if (selectedPlataforma) {
      fetchCamposSistema(selectedPlataforma);
      fetchMapeamentosPadrao(selectedPlataforma);
    }
  }, [selectedPlataforma]);

  const fetchPlataformas = async () => {
    try {
      const response = await axios.get(`${API}/csv-config/plataformas`);
      setPlataformas(response.data);
    } catch (error) {
      console.error("Erro ao carregar plataformas:", error);
      toast.error("Erro ao carregar plataformas");
    }
  };

  const fetchConfiguracoes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/csv-config`);
      setConfiguracoes(response.data);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCamposSistema = async (plataforma) => {
    try {
      const response = await axios.get(`${API}/csv-config/campos-sistema/${plataforma}`);
      setCamposSistema(response.data.campos || []);
    } catch (error) {
      console.error("Erro ao carregar campos:", error);
    }
  };

  const fetchMapeamentosPadrao = async (plataforma) => {
    try {
      const response = await axios.get(`${API}/csv-config/mapeamentos-padrao/${plataforma}`);
      setMapeamentosPadrao(response.data.mapeamentos || []);
      setNovaConfig(prev => ({
        ...prev,
        mapeamentos: response.data.mapeamentos || []
      }));
    } catch (error) {
      console.error("Erro ao carregar mapeamentos:", error);
    }
  };

  const handleAnalisarFicheiro = async () => {
    if (!analiseFile) {
      toast.error("Selecione um ficheiro");
      return;
    }

    setAnalisando(true);
    try {
      const formData = new FormData();
      formData.append("file", analiseFile);
      formData.append("delimitador", novaConfig.delimitador || ",");
      formData.append("encoding", novaConfig.encoding || "utf-8");

      const response = await axios.post(`${API}/csv-config/analisar-ficheiro`, formData);
      setAnaliseResultado(response.data);
      toast.success("Ficheiro analisado com sucesso!");
    } catch (error) {
      console.error("Erro ao analisar:", error);
      toast.error("Erro ao analisar ficheiro");
    } finally {
      setAnalisando(false);
    }
  };

  const handleCriarConfig = async () => {
    if (!selectedPlataforma || !novaConfig.nome_configuracao) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const configData = {
        parceiro_id: user?.id,
        plataforma: selectedPlataforma,
        ...novaConfig
      };

      await axios.post(`${API}/csv-config`, configData);
      toast.success("Configuração criada com sucesso!");
      setShowNovaConfig(false);
      fetchConfiguracoes();
      resetForm();
    } catch (error) {
      console.error("Erro ao criar configuração:", error);
      toast.error("Erro ao criar configuração");
    }
  };

  const handleTestarImportacao = async () => {
    if (!testeFile || !selectedConfig) {
      toast.error("Selecione um ficheiro e uma configuração");
      return;
    }

    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("file", testeFile);

      const response = await axios.post(
        `${API}/csv-config/importar/${selectedConfig.id}`,
        formData
      );

      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
      
      setShowTestar(false);
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar ficheiro");
    } finally {
      setImportando(false);
    }
  };

  const handleEliminarConfig = async (configId) => {
    if (!window.confirm("Tem certeza que deseja eliminar esta configuração?")) return;

    try {
      await axios.delete(`${API}/csv-config/${configId}`);
      toast.success("Configuração eliminada");
      fetchConfiguracoes();
    } catch (error) {
      console.error("Erro ao eliminar:", error);
      toast.error("Erro ao eliminar configuração");
    }
  };

  const addMapeamento = () => {
    setNovaConfig(prev => ({
      ...prev,
      mapeamentos: [...prev.mapeamentos, {
        csv_column: "",
        system_field: "",
        transform: "text",
        required: false
      }]
    }));
  };

  const updateMapeamento = (index, field, value) => {
    setNovaConfig(prev => {
      const newMapeamentos = [...prev.mapeamentos];
      newMapeamentos[index] = { ...newMapeamentos[index], [field]: value };
      return { ...prev, mapeamentos: newMapeamentos };
    });
  };

  const removeMapeamento = (index) => {
    setNovaConfig(prev => ({
      ...prev,
      mapeamentos: prev.mapeamentos.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => {
    setSelectedPlataforma("");
    setNovaConfig({
      nome_configuracao: "",
      descricao: "",
      delimitador: ",",
      encoding: "utf-8",
      skip_linhas: 0,
      mapeamentos: []
    });
    setAnaliseResultado(null);
    setAnaliseFile(null);
  };

  const getPlataformaIcon = (id) => {
    const icons = {
      uber: "🚗",
      bolt: "⚡",
      via_verde: "🛣️",
      combustivel: "⛽",
      gps: "📍"
    };
    return icons[id] || "📄";
  };

  return (
    <Layout user={user}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configuração de Extração CSV</h1>
            <p className="text-muted-foreground">
              Configure como extrair dados de ficheiros CSV de diferentes plataformas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAnalisar(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Analisar Ficheiro
            </Button>
            <Button onClick={() => setShowNovaConfig(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="configs">Minhas Configurações</TabsTrigger>
            <TabsTrigger value="plataformas">Plataformas Disponíveis</TabsTrigger>
          </TabsList>

          <TabsContent value="configs" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">A carregar...</div>
            ) : configuracoes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma configuração encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie uma configuração para começar a importar dados de ficheiros CSV
                  </p>
                  <Button onClick={() => setShowNovaConfig(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configuracoes.map((config) => (
                  <Card key={config.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getPlataformaIcon(config.plataforma)}</span>
                          <div>
                            <CardTitle className="text-base">{config.nome_configuracao}</CardTitle>
                            <Badge variant="outline" className="mt-1">
                              {config.plataforma}
                            </Badge>
                          </div>
                        </div>
                        <Badge variant={config.ativo ? "default" : "secondary"}>
                          {config.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {config.descricao && (
                        <p className="text-sm text-muted-foreground">{config.descricao}</p>
                      )}
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mapeamentos:</span>
                          <span>{config.mapeamentos?.length || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delimitador:</span>
                          <span>{config.delimitador === "," ? "Vírgula" : config.delimitador === ";" ? "Ponto e vírgula" : "Tab"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedConfig(config);
                            setShowTestar(true);
                          }}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Testar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminarConfig(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="plataformas" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plataformas.map((plat) => (
                <Card key={plat.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getPlataformaIcon(plat.id)}</span>
                      <div>
                        <CardTitle className="text-lg">{plat.nome}</CardTitle>
                        <CardDescription>{plat.descricao}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">Formatos:</span>
                      {plat.formatos_suportados?.map((fmt) => (
                        <Badge key={fmt} variant="secondary">{fmt}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedPlataforma(plat.id);
                        setShowNovaConfig(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog: Nova Configuração */}
        <Dialog open={showNovaConfig} onOpenChange={setShowNovaConfig}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Configuração de Extração</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Step 1: Plataforma */}
              <div className="space-y-3">
                <Label>Plataforma *</Label>
                <Select value={selectedPlataforma} onValueChange={setSelectedPlataforma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    {plataformas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {getPlataformaIcon(p.id)} {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPlataforma && (
                <>
                  {/* Step 2: Informações básicas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Configuração *</Label>
                      <Input
                        value={novaConfig.nome_configuracao}
                        onChange={(e) => setNovaConfig(prev => ({ ...prev, nome_configuracao: e.target.value }))}
                        placeholder="Ex: Pagamentos Uber Semanal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={novaConfig.descricao}
                        onChange={(e) => setNovaConfig(prev => ({ ...prev, descricao: e.target.value }))}
                        placeholder="Descrição opcional"
                      />
                    </div>
                  </div>

                  {/* Step 3: Configurações de ficheiro */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Delimitador</Label>
                      <Select
                        value={novaConfig.delimitador}
                        onValueChange={(v) => setNovaConfig(prev => ({ ...prev, delimitador: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=",">Vírgula (,)</SelectItem>
                          <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                          <SelectItem value="\t">Tab</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Encoding</Label>
                      <Select
                        value={novaConfig.encoding}
                        onValueChange={(v) => setNovaConfig(prev => ({ ...prev, encoding: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utf-8">UTF-8</SelectItem>
                          <SelectItem value="latin-1">Latin-1</SelectItem>
                          <SelectItem value="windows-1252">Windows-1252</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Linhas a ignorar</Label>
                      <Input
                        type="number"
                        min="0"
                        value={novaConfig.skip_linhas}
                        onChange={(e) => setNovaConfig(prev => ({ ...prev, skip_linhas: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  {/* Step 4: Mapeamentos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Mapeamento de Colunas</Label>
                      <Button variant="outline" size="sm" onClick={addMapeamento}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>

                    {novaConfig.mapeamentos.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground border rounded-lg">
                        <p>Nenhum mapeamento definido</p>
                        <p className="text-sm">Clique em "Adicionar" para mapear colunas do CSV</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {novaConfig.mapeamentos.map((map, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                            <Input
                              placeholder="Coluna CSV"
                              value={map.csv_column}
                              onChange={(e) => updateMapeamento(idx, "csv_column", e.target.value)}
                              className="flex-1"
                            />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Select
                              value={map.system_field}
                              onValueChange={(v) => updateMapeamento(idx, "system_field", v)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {camposSistema.map((c) => (
                                  <SelectItem key={c.field} value={c.field}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={map.transform || "text"}
                              onValueChange={(v) => updateMapeamento(idx, "transform", v)}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Texto</SelectItem>
                                <SelectItem value="money">Dinheiro</SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="date">Data</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMapeamento(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNovaConfig(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCriarConfig} disabled={!selectedPlataforma || !novaConfig.nome_configuracao}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Analisar Ficheiro */}
        <Dialog open={showAnalisar} onOpenChange={setShowAnalisar}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Analisar Ficheiro CSV</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ficheiro CSV</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setAnaliseFile(e.target.files[0])}
                />
              </div>

              <Button onClick={handleAnalisarFicheiro} disabled={!analiseFile || analisando}>
                {analisando ? "A analisar..." : "Analisar Estrutura"}
              </Button>

              {analiseResultado && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Ficheiro:</span>
                      <span className="ml-2 font-medium">{analiseResultado.nome_ficheiro}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Encoding:</span>
                      <span className="ml-2">{analiseResultado.encoding_detectado}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Delimitador:</span>
                      <span className="ml-2">{analiseResultado.delimitador_detectado === "," ? "Vírgula" : "Ponto e vírgula"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Colunas:</span>
                      <span className="ml-2">{analiseResultado.total_colunas}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Colunas Detectadas:</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {analiseResultado.colunas?.map((col, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div>
                            <span className="font-medium">{col.nome_coluna}</span>
                            <Badge variant="outline" className="ml-2">{col.tipo_detectado}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Ex: {col.valores_exemplo?.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Testar Importação */}
        <Dialog open={showTestar} onOpenChange={setShowTestar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Testar Importação</DialogTitle>
            </DialogHeader>

            {selectedConfig && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium">{selectedConfig.nome_configuracao}</p>
                  <p className="text-sm text-muted-foreground">
                    Plataforma: {selectedConfig.plataforma}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ficheiro para importar</Label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setTesteFile(e.target.files[0])}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleTestarImportacao}
                  disabled={!testeFile || importando}
                >
                  {importando ? "A importar..." : "Importar Ficheiro"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
