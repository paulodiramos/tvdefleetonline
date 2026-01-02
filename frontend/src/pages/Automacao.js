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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Bot, 
  Settings, 
  Plus, 
  Trash2, 
  Play,
  Pause,
  Eye,
  Edit,
  Key,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  GripVertical,
  RefreshCw
} from "lucide-react";

export default function Automacao({ user }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [automacoes, setAutomacoes] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [tiposAcao, setTiposAcao] = useState([]);
  
  // Modal states
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false);
  const [showNovaAutomacao, setShowNovaAutomacao] = useState(false);
  const [showCredenciais, setShowCredenciais] = useState(false);
  const [showExecutar, setShowExecutar] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState(false);
  
  // Form states
  const [selectedFornecedor, setSelectedFornecedor] = useState(null);
  const [selectedAutomacao, setSelectedAutomacao] = useState(null);
  const [novoFornecedor, setNovoFornecedor] = useState({
    nome: "",
    tipo: "",
    url_login: "",
    descricao: "",
    requer_2fa: false
  });
  const [credenciaisForm, setCredenciaisForm] = useState({
    email: "",
    password: "",
    codigo_2fa_secret: ""
  });

  useEffect(() => {
    fetchDashboard();
    fetchFornecedores();
    fetchAutomacoes();
    fetchExecucoes();
    fetchTiposAcao();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/automacao/dashboard`);
      setDashboard(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    }
  };

  const fetchFornecedores = async () => {
    try {
      const response = await axios.get(`${API}/automacao/fornecedores`);
      setFornecedores(response.data);
    } catch (error) {
      console.error("Erro ao carregar fornecedores:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutomacoes = async () => {
    try {
      const response = await axios.get(`${API}/automacao/scripts`);
      setAutomacoes(response.data);
    } catch (error) {
      console.error("Erro ao carregar automações:", error);
    }
  };

  const fetchExecucoes = async () => {
    try {
      const response = await axios.get(`${API}/automacao/execucoes`);
      setExecucoes(response.data);
    } catch (error) {
      console.error("Erro ao carregar execuções:", error);
    }
  };

  const fetchTiposAcao = async () => {
    try {
      const response = await axios.get(`${API}/automacao/scripts/tipos-acao`);
      setTiposAcao(response.data);
    } catch (error) {
      console.error("Erro ao carregar tipos de ação:", error);
    }
  };

  const handleInicializarPadrao = async () => {
    try {
      await axios.post(`${API}/automacao/fornecedores/inicializar-padrao`);
      toast.success("Fornecedores padrão inicializados!");
      fetchFornecedores();
    } catch (error) {
      toast.error("Erro ao inicializar fornecedores");
    }
  };

  const handleCriarFornecedor = async () => {
    if (!novoFornecedor.nome || !novoFornecedor.tipo || !novoFornecedor.url_login) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await axios.post(`${API}/automacao/fornecedores`, novoFornecedor);
      toast.success("Fornecedor criado com sucesso!");
      setShowNovoFornecedor(false);
      setNovoFornecedor({ nome: "", tipo: "", url_login: "", descricao: "", requer_2fa: false });
      fetchFornecedores();
    } catch (error) {
      toast.error("Erro ao criar fornecedor");
    }
  };

  const handleGuardarCredenciais = async () => {
    if (!credenciaisForm.email || !credenciaisForm.password) {
      toast.error("Preencha email e password");
      return;
    }

    try {
      await axios.post(`${API}/automacao/credenciais`, {
        parceiro_id: user.id,
        fornecedor_id: selectedFornecedor.id,
        email: credenciaisForm.email,
        password: credenciaisForm.password,
        codigo_2fa_secret: credenciaisForm.codigo_2fa_secret || null
      });
      toast.success("Credenciais guardadas com sucesso!");
      setShowCredenciais(false);
      setCredenciaisForm({ email: "", password: "", codigo_2fa_secret: "" });
    } catch (error) {
      toast.error("Erro ao guardar credenciais");
    }
  };

  const handleExecutar = async () => {
    if (!selectedAutomacao) {
      toast.error("Selecione uma automação");
      return;
    }

    try {
      const response = await axios.post(`${API}/automacao/executar`, {
        automacao_id: selectedAutomacao.id,
        parceiro_id: user.id
      });
      toast.success(response.data.message);
      setShowExecutar(false);
      fetchExecucoes();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao executar automação");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pendente: { variant: "secondary", icon: Clock },
      em_execucao: { variant: "default", icon: RefreshCw },
      sucesso: { variant: "success", icon: CheckCircle2 },
      erro: { variant: "destructive", icon: XCircle },
      cancelado: { variant: "outline", icon: Pause }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      uber: "🚗",
      bolt: "⚡",
      via_verde: "🛣️",
      gps: "📍",
      combustivel: "⛽",
      carregamento_eletrico: "🔌"
    };
    return icons[tipo] || "📄";
  };

  const isAdmin = user?.role === "admin";

  return (
    <Layout user={user}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6" />
              Sistema de Automação RPA
            </h1>
            <p className="text-muted-foreground">
              Automatize downloads de ficheiros CSV de diferentes plataformas
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleInicializarPadrao}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Inicializar Padrão
              </Button>
              <Button onClick={() => setShowNovoFornecedor(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Fornecedor
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            {isAdmin && <TabsTrigger value="automacoes">Automações</TabsTrigger>}
            <TabsTrigger value="credenciais">Minhas Credenciais</TabsTrigger>
            <TabsTrigger value="execucoes">Execuções</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            {dashboard && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Fornecedores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboard.total_fornecedores}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Automações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboard.total_automacoes}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Execuções
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboard.total_execucoes}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Taxa de Sucesso
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {dashboard.taxa_sucesso?.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Execuções Recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.execucoes_recentes?.length > 0 ? (
                      <div className="space-y-2">
                        {dashboard.execucoes_recentes.map((exec) => (
                          <div key={exec.id} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <p className="font-medium">{exec.automacao_nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(exec.created_at).toLocaleString()}
                              </p>
                            </div>
                            {getStatusBadge(exec.status)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhuma execução recente
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Fornecedores Tab */}
          <TabsContent value="fornecedores" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">A carregar...</div>
            ) : fornecedores.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum fornecedor configurado</h3>
                  <p className="text-muted-foreground mb-4">
                    {isAdmin 
                      ? "Clique em 'Inicializar Padrão' para criar os fornecedores principais" 
                      : "Aguarde o administrador configurar os fornecedores"}
                  </p>
                  {isAdmin && (
                    <Button onClick={handleInicializarPadrao}>
                      Inicializar Fornecedores Padrão
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fornecedores.map((fornecedor) => (
                  <Card key={fornecedor.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getTipoIcon(fornecedor.tipo)}</span>
                          <div>
                            <CardTitle className="text-base">{fornecedor.nome}</CardTitle>
                            <Badge variant="outline" className="mt-1">{fornecedor.tipo}</Badge>
                          </div>
                        </div>
                        {fornecedor.requer_2fa && (
                          <Badge variant="secondary">2FA</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {fornecedor.descricao && (
                        <p className="text-sm text-muted-foreground">{fornecedor.descricao}</p>
                      )}
                      <div className="text-xs text-muted-foreground truncate">
                        {fornecedor.url_login}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedFornecedor(fornecedor);
                            setShowCredenciais(true);
                          }}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Credenciais
                        </Button>
                        {fornecedor.automacao_id && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const automacao = automacoes.find(a => a.id === fornecedor.automacao_id);
                              if (automacao) {
                                setSelectedAutomacao(automacao);
                                setShowExecutar(true);
                              }
                            }}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Executar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Automações Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="automacoes" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowNovaAutomacao(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Automação
                </Button>
              </div>

              {automacoes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma automação configurada</h3>
                    <p className="text-muted-foreground">
                      Crie uma automação para começar a automatizar downloads
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {automacoes.map((automacao) => (
                    <Card key={automacao.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{automacao.nome}</CardTitle>
                            <CardDescription>
                              {automacao.descricao} • {automacao.passos?.length || 0} passos
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={automacao.testada ? "success" : "secondary"}>
                              {automacao.testada ? "Testada" : "Não testada"}
                            </Badge>
                            <Badge>{automacao.tipo_fornecedor}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {automacao.passos?.slice(0, 5).map((passo, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                              <span className="font-mono">{idx + 1}.</span>
                              <span>{passo.nome || passo.tipo}</span>
                            </div>
                          ))}
                          {automacao.passos?.length > 5 && (
                            <div className="text-xs text-muted-foreground px-2 py-1">
                              +{automacao.passos.length - 5} mais
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAutomacao(automacao);
                              setShowDetalhes(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Passos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Credenciais Tab */}
          <TabsContent value="credenciais" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Credenciais</CardTitle>
                <CardDescription>
                  Gerencie as suas credenciais de acesso às plataformas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {fornecedores.map((fornecedor) => (
                    <div
                      key={fornecedor.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTipoIcon(fornecedor.tipo)}</span>
                        <div>
                          <p className="font-medium">{fornecedor.nome}</p>
                          <p className="text-sm text-muted-foreground">{fornecedor.tipo}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFornecedor(fornecedor);
                          setShowCredenciais(true);
                        }}
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Configurar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Execuções Tab */}
          <TabsContent value="execucoes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
              </CardHeader>
              <CardContent>
                {execucoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma execução registada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {execucoes.map((exec) => (
                      <div
                        key={exec.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{exec.automacao_nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(exec.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {exec.progresso > 0 && exec.status === "em_execucao" && (
                            <span className="text-sm">{exec.progresso}%</span>
                          )}
                          {getStatusBadge(exec.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal: Novo Fornecedor */}
        <Dialog open={showNovoFornecedor} onOpenChange={setShowNovoFornecedor}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={novoFornecedor.nome}
                  onChange={(e) => setNovoFornecedor({...novoFornecedor, nome: e.target.value})}
                  placeholder="Ex: Galp, Frotcom..."
                />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={novoFornecedor.tipo}
                  onValueChange={(v) => setNovoFornecedor({...novoFornecedor, tipo: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gps">📍 GPS/Rastreamento</SelectItem>
                    <SelectItem value="combustivel">⛽ Combustível</SelectItem>
                    <SelectItem value="carregamento_eletrico">🔌 Carregamento Elétrico</SelectItem>
                    <SelectItem value="outro">📄 Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL de Login *</Label>
                <Input
                  value={novoFornecedor.url_login}
                  onChange={(e) => setNovoFornecedor({...novoFornecedor, url_login: e.target.value})}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={novoFornecedor.descricao}
                  onChange={(e) => setNovoFornecedor({...novoFornecedor, descricao: e.target.value})}
                  placeholder="Descrição do fornecedor..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requer_2fa"
                  checked={novoFornecedor.requer_2fa}
                  onChange={(e) => setNovoFornecedor({...novoFornecedor, requer_2fa: e.target.checked})}
                />
                <Label htmlFor="requer_2fa">Requer autenticação 2FA</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovoFornecedor(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarFornecedor}>
                Criar Fornecedor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Credenciais */}
        <Dialog open={showCredenciais} onOpenChange={setShowCredenciais}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Credenciais - {selectedFornecedor?.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email / Username *</Label>
                <Input
                  value={credenciaisForm.email}
                  onChange={(e) => setCredenciaisForm({...credenciaisForm, email: e.target.value})}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={credenciaisForm.password}
                  onChange={(e) => setCredenciaisForm({...credenciaisForm, password: e.target.value})}
                  placeholder="••••••••"
                />
              </div>
              {selectedFornecedor?.requer_2fa && (
                <div>
                  <Label>Código 2FA Secret (opcional)</Label>
                  <Input
                    value={credenciaisForm.codigo_2fa_secret}
                    onChange={(e) => setCredenciaisForm({...credenciaisForm, codigo_2fa_secret: e.target.value})}
                    placeholder="TOTP Secret Key"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se tiver autenticação por app (Google Auth), insira o secret key
                  </p>
                </div>
              )}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                <strong>🔒 Segurança:</strong> As suas credenciais são encriptadas e guardadas de forma segura.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCredenciais(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardarCredenciais}>
                <Key className="h-4 w-4 mr-2" />
                Guardar Credenciais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Executar */}
        <Dialog open={showExecutar} onOpenChange={setShowExecutar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Executar Automação</DialogTitle>
            </DialogHeader>
            {selectedAutomacao && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium">{selectedAutomacao.nome}</p>
                  <p className="text-sm text-muted-foreground">{selectedAutomacao.descricao}</p>
                </div>
                <p className="text-sm">
                  Esta automação irá fazer login na plataforma e descarregar os ficheiros automaticamente.
                </p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  Certifique-se que as suas credenciais estão configuradas corretamente.
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExecutar(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExecutar}>
                <Play className="h-4 w-4 mr-2" />
                Executar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Detalhes da Automação */}
        <Dialog open={showDetalhes} onOpenChange={setShowDetalhes}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedAutomacao?.nome}</DialogTitle>
            </DialogHeader>
            {selectedAutomacao && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground">{selectedAutomacao.descricao}</p>
                <div>
                  <h4 className="font-medium mb-2">Passos da Automação:</h4>
                  <div className="space-y-2">
                    {selectedAutomacao.passos?.map((passo, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                        <span className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{passo.nome || passo.tipo}</p>
                          {passo.seletor && (
                            <p className="text-xs text-muted-foreground font-mono">{passo.seletor}</p>
                          )}
                          {passo.valor && (
                            <p className="text-xs text-muted-foreground">{passo.valor}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {passo.tipo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
