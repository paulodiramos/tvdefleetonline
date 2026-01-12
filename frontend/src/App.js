import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Vehicles from "@/pages/Vehicles";
import Motoristas from "@/pages/Motoristas";
import Financials from "@/pages/Financials";
import PublicSite from "@/pages/PublicSite";
import MotoristaRegister from "@/pages/MotoristaRegister";
import Parceiros from "@/pages/Parceiros";
import Profile from "@/pages/Profile";
import PerfilMotorista from "@/pages/PerfilMotorista";
import MotoristaRecibosGanhos from "@/pages/MotoristaRecibosGanhos";
import MotoristaEnvioRecibo from "@/pages/MotoristaEnvioRecibo";
import MotoristaPerfil from "@/pages/MotoristaPerfil";
import MotoristaPlanosPagina from "@/pages/MotoristaPlanosPagina";
import MotoristaMensagens from "@/pages/MotoristaMensagens";
import MotoristaTickets from "@/pages/MotoristaTickets";
import MotoristaOportunidades from "@/pages/MotoristaOportunidades";
import CriarRelatorioSemanal from "@/pages/CriarRelatorioSemanal";
import RelatoriosSemanais from "@/pages/RelatoriosSemanaisNovo";
import GestaoPagamentosRecibos from "@/pages/GestaoPagamentosRecibos";
import ConfiguracaoSincronizacao from "@/pages/ConfiguracaoSincronizacao";
import CredenciaisParceiros from "@/pages/CredenciaisParceiros";
import ImportarDados from "@/pages/ImportarDados";
import ImportarPlataformas from "@/pages/ImportarPlataformas";
import ImportarMotoristasVeiculos from "@/pages/ImportarMotoristasVeiculos";
import GestaoCredenciais from "@/pages/GestaoCredenciais";
import PagamentosParceiro from "@/pages/PagamentosParceiro";
import ParceiroReports from "@/pages/ParceiroReports";
import PerfilParceiro from "@/pages/PerfilParceiro";
import PerfilParceiroCompleto from "@/pages/PerfilParceiroCompleto";
import GestaoParceirosModulos from "@/pages/GestaoParceirosModulos";
import GestaoUtilizadores from "@/pages/GestaoUtilizadores";
import GestaoPlanosParceiros from "@/pages/GestaoPlanosParceiros";
import DashboardPlanosAtivos from "@/pages/DashboardPlanosAtivos";
import MeuPlanoParceiro from "@/pages/MeuPlanoParceiro";
import MeuPlanoMotorista from "@/pages/MeuPlanoMotorista";
import Pagamentos from "@/pages/Pagamentos";
import UploadCSV from "@/pages/UploadCSV";
import Planos from "@/pages/Planos";
import Configuracoes from "@/pages/Configuracoes";
import CartoesFrota from "@/pages/CartoesFrota";
import Integracoes from "@/pages/Integracoes";
import Comunicacoes from "@/pages/Comunicacoes";
import ConfiguracaoComunicacoes from "@/pages/ConfiguracaoComunicacoes";
import ConfiguracaoCategorias from "@/pages/ConfiguracaoCategorias";
import VehicleData from "@/pages/VehicleData";
import VehiclePhotos from "@/pages/VehiclePhotos";
import VehicleVistorias from "@/pages/VehicleVistorias";
import Vistorias from "@/pages/Vistorias";
import EditParceiro from "@/pages/EditParceiro";
import RecibosPagamentos from "@/pages/RecibosPagamentos";
import FichaVeiculo from "@/pages/FichaVeiculo";
import Usuarios from "@/pages/Usuarios";
import Pendentes from "@/pages/Pendentes";
import Relatorios from "@/pages/Relatorios";
import PublicHome from "@/pages/PublicHome";
import RegistoMotorista from "@/pages/RegistoMotorista";
import MudarSenhaObrigatorioModal from "@/components/MudarSenhaObrigatorioModal";
import RegistoParceiro from "@/pages/RegistoParceiro";
import VeiculosPublico from "@/pages/VeiculosPublico";
import ServicosPublico from "@/pages/ServicosPublico";
import Contratos from "@/pages/Contratos";
import ContratosComTabs from "@/pages/ContratosComTabs";
import ListaContratos from "@/pages/ListaContratos";
import CriarContrato from "@/pages/CriarContrato";
import ConfiguracoesAdmin from "@/pages/ConfiguracoesAdmin";
import SincronizacaoAuto from "@/pages/SincronizacaoAuto";
import Financeiro from "@/pages/Financeiro";
import GestaoPlanos from "@/pages/GestaoPlanos";
import GestaoPlanosMotorista from "@/pages/GestaoPlanosMotorista";
import ConfiguracaoPlanos from "@/pages/ConfiguracaoPlanos";
import ConfiguracaoRelatorios from "@/pages/ConfiguracaoRelatorios";
import GerarRelatorioSemanal from "@/pages/GerarRelatorioSemanal";
import VerificarRecibos from "@/pages/VerificarRecibos";
import PagamentosRelatoriosSemanais from "@/pages/PagamentosRelatoriosSemanais";
import CriarRelatorioOpcoes from "@/pages/CriarRelatorioOpcoes";
import RelatoriosSemanaisLista from "@/pages/RelatoriosSemanaisLista";
import HistoricoRelatorios from "@/pages/HistoricoRelatorios";
import CriarRelatorioManual from "@/pages/CriarRelatorioManual";
import RelatoriosHub from "@/pages/RelatoriosHub";
import ResumoSemanalParceiro from "@/pages/ResumoSemanalParceiro";
import ImportarFicheirosParceiro from "@/pages/ImportarFicheirosParceiro";
import ConfiguracaoMapeamento from "@/pages/ConfiguracaoMapeamento";
import CredenciaisPlataformas from "@/pages/CredenciaisPlataformas";
import ListaImportacoes from "@/pages/ListaImportacoes";
import GestaoExtrasMotorista from "@/pages/GestaoExtrasMotorista";
import MeusPlanos from "@/pages/MeusPlanos";
import MeusRecibosGanhos from "@/pages/MeusRecibosGanhos";
import ValidacaoDocumentosMotorista from "@/pages/ValidacaoDocumentosMotorista";
import MotoristaDocumentos from "@/pages/MotoristaDocumentos";
import Notificacoes from "@/pages/Notificacoes";
import Mensagens from "@/pages/Mensagens";
import TemplatesContratos from "@/pages/TemplatesContratos";
import Termos from "@/pages/Termos";
import Privacidade from "@/pages/Privacidade";
import TermosPrivacidadeAdmin from "@/pages/TermosPrivacidadeAdmin";
import FicheirosImportados from "@/pages/FicheirosImportados";
import ConfiguracaoCSV from "@/pages/ConfiguracaoCSV";
import ImportarDespesas from "@/pages/ImportarDespesas";
import Automacao from "@/pages/Automacao";
import FichaMotorista from "@/pages/FichaMotorista";
import ConfiguracoesParceiro from "@/pages/ConfiguracoesParceiro";
import AutomacaoRPA from "@/pages/AutomacaoRPA";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export { API };

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMudarSenha, setShowMudarSenha] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      
      // Verificar se precisa mudar senha
      if (response.data.senha_provisoria) {
        setShowMudarSenha(true);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem("token", token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(userData);
    
    // Verificar se precisa mudar senha
    if (userData.senha_provisoria) {
      setShowMudarSenha(true);
    }
  };

  const handleSenhaChanged = async () => {
    // Recarregar usuário após mudança de senha
    setShowMudarSenha(false);
    await fetchCurrentUser();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicHome />} />
          <Route path="/registo-motorista" element={<RegistoMotorista />} />
          <Route path="/registo-parceiro" element={<RegistoParceiro />} />
          <Route path="/veiculos" element={<VeiculosPublico />} />
          <Route path="/servicos" element={<ServicosPublico />} />
          <Route path="/servicos/:servico" element={<ServicosPublico />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          
          {/* Auth Routes */}
          <Route
            path="/login"
            element={
              user ? (
                user.role === 'motorista' ? <Navigate to="/profile" /> : <Navigate to="/dashboard" />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/vehicles"
            element={
              user ? <Vehicles user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motoristas"
            element={
              user ? <Motoristas user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motoristas/:motoristaId"
            element={
              user ? <FichaMotorista user={user} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/notificacoes"
            element={
              user ? <Notificacoes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/mensagens"
            element={
              user ? <Mensagens user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/financials"
            element={
              user ? <Financials user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/parceiros"
            element={
              user ? <Parceiros user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/parceiros/modulos"
            element={
              user && (user.role === 'admin' || user.role === 'gestao') ? (
                <GestaoParceirosModulos user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/utilizadores"
            element={
              user && user.role === 'admin' ? (
                <GestaoUtilizadores user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/planos-parceiros"
            element={
              user && user.role === 'admin' ? (
                <GestaoPlanos user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/meu-plano"
            element={
              user && user.role === 'parceiro' ? (
                <MeuPlanoParceiro user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/meu-plano-motorista"
            element={
              user && user.role === 'motorista' ? (
                <MeuPlanoMotorista user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/profile" />
              )
            }
          />
          <Route
            path="/contratos"
            element={
              user ? <ContratosComTabs user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          {/* Redirect old routes to unified system */}
          <Route path="/lista-contratos" element={<Navigate to="/contratos" replace />} />
          <Route path="/templates-contratos" element={<Navigate to="/contratos" replace />} />
          <Route
            path="/criar-contrato"
            element={
              user ? <CriarContrato user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/configuracoes-admin"
            element={
              user ? <ConfiguracoesAdmin user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/sincronizacao-auto"
            element={
              user && (user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') ? <SincronizacaoAuto user={user} onLogout={handleLogout} /> : <Navigate to="/" />
            }
          />
          <Route
            path="/vistorias"
            element={
              user && (user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro') ? <Vistorias user={user} onLogout={handleLogout} /> : <Navigate to="/" />
            }
          />
          <Route
            path="/upload-csv"
            element={
              user ? <UploadCSV user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/financeiro"
            element={
              user ? <Financeiro user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/profile"
            element={
              user ? (
                user.role === 'motorista' ? (
                  <PerfilMotorista user={user} onLogout={handleLogout} />
                ) : user.role === 'parceiro' ? (
                  <PerfilParceiroCompleto user={user} onLogout={handleLogout} />
                ) : (
                  <Profile user={user} onLogout={handleLogout} />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/motorista/recibos"
            element={
              user ? <MotoristaRecibosGanhos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista-ganhos"
            element={
              user ? <MotoristaRecibosGanhos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/envio-recibo"
            element={
              user ? <MotoristaEnvioRecibo user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/perfil"
            element={
              user ? <MotoristaPerfil user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista-documentos"
            element={
              user && user.role === 'motorista' ? <MotoristaDocumentos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/planos"
            element={
              user ? <MotoristaPlanosPagina user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/mensagens"
            element={
              user ? <MotoristaMensagens user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/tickets"
            element={
              user ? <MotoristaTickets user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/motorista/oportunidades"
            element={
              user ? <MotoristaOportunidades user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/pagamentos"
            element={
              user ? <Pagamentos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/upload-csv"
            element={
              user ? <UploadCSV user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/planos"
            element={
              user ? <Planos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/configuracoes"
            element={
              user ? <Configuracoes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/integracoes"
            element={
              user ? <Integracoes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route path="/configuracao-integracao" element={<Navigate to="/integracoes" replace />} />
          <Route
            path="/comunicacoes"
            element={
              user ? <Comunicacoes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route path="/configuracoes-comunicacao" element={<Navigate to="/comunicacoes" replace />} />
          <Route 
            path="/cartoes-frota" 
            element={
              user ? <CartoesFrota user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/termos-privacidade" 
            element={
              user && user.role === 'admin' ? <TermosPrivacidadeAdmin user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            } 
          />
          <Route
            path="/configuracao-comunicacoes"
            element={
              user && user.role === 'admin' ? <ConfiguracaoComunicacoes user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/configuracao-categorias"
            element={
              user && user.role === 'admin' ? <ConfiguracaoCategorias user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/configuracao-relatorios"
            element={
              user && user.role === 'parceiro' ? <ConfiguracaoRelatorios user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/gerar-relatorio-semanal"
            element={
              user && user.role === 'parceiro' ? <GerarRelatorioSemanal user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/verificar-recibos"
            element={
              user && user.role === 'parceiro' ? <VerificarRecibos user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/pagamentos-relatorios-semanais"
            element={
              user && user.role === 'parceiro' ? <PagamentosRelatoriosSemanais user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/criar-relatorio-opcoes"
            element={
              user && user.role === 'parceiro' ? <CriarRelatorioOpcoes user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/relatorios-semanais-lista"
            element={
              user && user.role === 'parceiro' ? <RelatoriosSemanaisLista user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/historico-relatorios"
            element={
              user && user.role === 'parceiro' ? <HistoricoRelatorios user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/criar-relatorio-manual"
            element={
              user && user.role === 'parceiro' ? <CriarRelatorioManual user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/relatorios"
            element={
              user && user.role === 'parceiro' ? <RelatoriosHub user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/resumo-semanal"
            element={
              user && (user.role === 'parceiro' || user.role === 'admin' || user.role === 'gestao') ? <ResumoSemanalParceiro user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/lista-importacoes"
            element={
              user && (user.role === 'parceiro' || user.role === 'admin' || user.role === 'gestao') ? <ListaImportacoes user={user} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/gestao-extras"
            element={
              user && (user.role === 'parceiro' || user.role === 'admin' || user.role === 'gestao') ? <GestaoExtrasMotorista user={user} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/importar-ficheiros"
            element={
              user && (user.role === 'parceiro' || user.role === 'admin' || user.role === 'gestao') ? <ImportarFicheirosParceiro user={user} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/configuracao-mapeamento"
            element={
              user && (user.role === 'admin' || user.role === 'gestao') ? <ConfiguracaoMapeamento user={user} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/credenciais-plataformas"
            element={
              user && user.role === 'parceiro' ? <CredenciaisPlataformas user={user} /> : <Navigate to="/dashboard" />
            }
          />
          <Route
            path="/vehicle-data"
            element={
              user ? <VehicleData user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/vehicle-photos"
            element={
              user ? <VehiclePhotos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/vehicles/:vehicleId/vistorias"
            element={
              user ? <VehicleVistorias user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/edit-parceiro"
            element={
              user ? <EditParceiro user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/recibos-pagamentos"
            element={
              user ? <RecibosPagamentos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/ficha-veiculo/:vehicleId"
            element={
              user ? <FichaVeiculo user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/usuarios"
            element={
              user ? <Usuarios user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/pendentes"
            element={
              user ? <Pendentes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/validacao-documentos/:motoristaId"
            element={
              user ? <ValidacaoDocumentosMotorista user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/gestao-planos"
            element={
              user ? <GestaoPlanos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          {/* Rotas antigas removidas - agora tudo unificado em /gestao-planos e /planos-parceiros */}
          <Route
            path="/meus-planos"
            element={
              user ? <MeusPlanos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/meus-recibos-ganhos"
            element={
              user ? <MeusRecibosGanhos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/recibos-ganhos"
            element={
              user ? <MotoristaRecibosGanhos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/criar-relatorio-semanal"
            element={
              user ? <CriarRelatorioSemanal user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/relatorios-semanais"
            element={
              user && ['admin', 'gestao', 'parceiro'].includes(user.role) ? (
                <RelatoriosSemanais user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/gestao-pagamentos-recibos"
            element={
              user && ['admin', 'gestao', 'parceiro'].includes(user.role) ? (
                <GestaoPagamentosRecibos user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/configuracao-sincronizacao"
            element={
              user && user.role === 'admin' ? (
                <ConfiguracaoSincronizacao user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/credenciais-parceiros"
            element={
              user && user.role === 'admin' ? (
                <CredenciaisParceiros user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/importar-dados"
            element={
              user ? (
                <ImportarDados user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/importar-plataformas"
            element={
              user ? (
                <ImportarPlataformas user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/importar-motoristas-veiculos"
            element={
              user ? (
                <ImportarMotoristasVeiculos user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/ficheiros-importados"
            element={
              user ? (
                <FicheirosImportados user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/configuracao-csv"
            element={
              user ? (
                <ConfiguracaoCSV user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/importar-despesas"
            element={
              user ? (
                <ImportarDespesas user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/automacao"
            element={
              user ? (
                <Automacao user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/automacao-rpa"
            element={
              user && user.role === 'admin' ? (
                <AutomacaoRPA user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/configuracoes-parceiro"
            element={
              user && (user.role === 'parceiro' || user.role === 'admin' || user.role === 'gestao') ? (
                <ConfiguracoesParceiro user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/gestao-credenciais"
            element={
              user ? (
                <GestaoCredenciais user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/pagamentos-parceiro"
            element={
              user ? <PagamentosParceiro user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/verificar-recibos"
            element={
              user ? <VerificarRecibos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
      
      {/* Modal de Mudança de Senha Obrigatória */}
      {user && showMudarSenha && (
        <MudarSenhaObrigatorioModal
          open={showMudarSenha}
          user={user}
          onSuccess={handleSenhaChanged}
        />
      )}
    </div>
  );
}

export default App;