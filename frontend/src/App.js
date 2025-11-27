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
import CriarRelatorioSemanal from "@/pages/CriarRelatorioSemanal";
import PagamentosParceiro from "@/pages/PagamentosParceiro";
import ParceiroReports from "@/pages/ParceiroReports";
import Pagamentos from "@/pages/Pagamentos";
import UploadCSV from "@/pages/UploadCSV";
import Planos from "@/pages/Planos";
import Configuracoes from "@/pages/Configuracoes";
import VehicleData from "@/pages/VehicleData";
import VehiclePhotos from "@/pages/VehiclePhotos";
import EditParceiro from "@/pages/EditParceiro";
import RecibosPagamentos from "@/pages/RecibosPagamentos";
import FichaVeiculo from "@/pages/FichaVeiculo";
import Usuarios from "@/pages/Usuarios";
import PublicHome from "@/pages/PublicHome";
import RegistoMotorista from "@/pages/RegistoMotorista";
import RegistoParceiro from "@/pages/RegistoParceiro";
import VeiculosPublico from "@/pages/VeiculosPublico";
import ServicosPublico from "@/pages/ServicosPublico";
import Contratos from "@/pages/Contratos";
import CriarContrato from "@/pages/CriarContrato";
import ConfiguracoesAdmin from "@/pages/ConfiguracoesAdmin";
import SincronizacaoAuto from "@/pages/SincronizacaoAuto";
import Financeiro from "@/pages/Financeiro";
import GestaoPlanos from "@/pages/GestaoPlanos";
import GestaoPlanosMotorista from "@/pages/GestaoPlanosMotorista";
import MeusPlanos from "@/pages/MeusPlanos";
import MeusRecibosGanhos from "@/pages/MeusRecibosGanhos";
import VerificarRecibos from "@/pages/VerificarRecibos";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export { API };

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
            path="/contratos"
            element={
              user ? <Contratos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
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
              user ? <SincronizacaoAuto user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/upload-csv"
            element={
              user ? <Financeiro user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
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
                ) : (
                  <Profile user={user} onLogout={handleLogout} />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/relatorios"
            element={
              user ? <ParceiroReports user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
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
            path="/gestao-planos"
            element={
              user ? <GestaoPlanos user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/gestao-planos-motorista"
            element={
              user ? <GestaoPlanosMotorista user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
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
            path="/criar-relatorio-semanal"
            element={
              user ? <CriarRelatorioSemanal user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
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
    </div>
  );
}

export default App;