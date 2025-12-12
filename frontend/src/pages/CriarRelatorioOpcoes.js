import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  FileText, Upload, RefreshCw, ArrowLeft, Edit, 
  FileSpreadsheet, Clock, CheckCircle 
} from 'lucide-react';

const CriarRelatorioOpcoes = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Botão Voltar */}
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Criar Relatório Semanal
              </h1>
              <p className="text-slate-600">
                Escolha o método de criação do relatório
              </p>
            </div>
          </div>
        </div>

        {/* Opções de Criação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Opção 1: Manual */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Edit className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Manual</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Introduza todos os dados manualmente
                </p>
                <ul className="text-xs text-slate-500 text-left space-y-1 mb-6">
                  <li>✓ Viagens Uber e Bolt</li>
                  <li>✓ Via Verde</li>
                  <li>✓ Abastecimentos</li>
                  <li>✓ GPS e outros custos</li>
                  <li>✓ Danos e Extras</li>
                </ul>
                <Button 
                  className="w-full"
                  onClick={() => navigate('/criar-relatorio-manual')}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Criar Manual
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Opção 2: Semi-Manual */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Upload className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Semi-Manual</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Importe dados via ficheiros CSV
                </p>
                <ul className="text-xs text-slate-500 text-left space-y-1 mb-6">
                  <li>✓ Upload CSV Uber</li>
                  <li>✓ Upload CSV Bolt</li>
                  <li>✓ Upload CSV Via Verde</li>
                  <li>✓ Upload CSV Abastecimentos</li>
                  <li>✓ Complementar manualmente</li>
                </ul>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => navigate('/criar-relatorio-csv')}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Importar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Opção 3: Automático */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Automático</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Sincronização com plataformas
                </p>
                <ul className="text-xs text-slate-500 text-left space-y-1 mb-6">
                  <li>✓ Sincronização Uber</li>
                  <li>✓ Sincronização Bolt</li>
                  <li>✓ Sincronização Via Verde</li>
                  <li>✓ Agendamento automático</li>
                  <li>✓ Sem intervenção manual</li>
                </ul>
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => navigate('/sincronizacao-auto')}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Configurar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informação Adicional */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <CheckCircle className="w-5 h-5" />
              Como Funciona o Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <p className="font-semibold">Criar Relatório</p>
                <p className="text-xs text-slate-600">Manual/CSV/Auto</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <p className="font-semibold">Revisar</p>
                <p className="text-xs text-slate-600">Editar dados</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <p className="font-semibold">Aprovar</p>
                <p className="text-xs text-slate-600">Gerar relatório</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <p className="font-semibold">Aguardar Recibo</p>
                <p className="text-xs text-slate-600">Motorista anexa</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <p className="font-semibold">Verificar</p>
                <p className="text-xs text-slate-600">Analisar recibo</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  6
                </div>
                <p className="font-semibold">Pagar</p>
                <p className="text-xs text-slate-600">Finalizar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acesso Rápido */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Acesso Rápido</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start"
              onClick={() => navigate('/relatorios-semanais-lista')}
            >
              <FileText className="w-5 h-5 mb-2 text-blue-600" />
              <span className="font-semibold">Relatórios Pendentes</span>
              <span className="text-xs text-slate-600">Ver todos os relatórios</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start"
              onClick={() => navigate('/verificar-recibos')}
            >
              <CheckCircle className="w-5 h-5 mb-2 text-orange-600" />
              <span className="font-semibold">Verificar Recibos</span>
              <span className="text-xs text-slate-600">Recibos pendentes</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start"
              onClick={() => navigate('/pagamentos-relatorios-semanais')}
            >
              <CheckCircle className="w-5 h-5 mb-2 text-green-600" />
              <span className="font-semibold">Pagamentos</span>
              <span className="text-xs text-slate-600">Aprovar pagamentos</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start"
              onClick={() => navigate('/historico-relatorios')}
            >
              <Clock className="w-5 h-5 mb-2 text-purple-600" />
              <span className="font-semibold">Histórico</span>
              <span className="text-xs text-slate-600">Ver histórico completo</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriarRelatorioOpcoes;
