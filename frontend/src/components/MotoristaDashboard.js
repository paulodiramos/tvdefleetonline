import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

const MotoristaDashboard = ({ motoristaData, relatorios }) => {
  // Calcular estatísticas
  const totalGanhos = relatorios.reduce((sum, r) => sum + (r.valor_total || 0), 0);
  const recibosEnviados = relatorios.filter(r => r.status === 'enviado' || r.status === 'verificado').length;
  const recibosPendentes = relatorios.filter(r => r.status === 'pendente').length;
  const recibosVerificados = relatorios.filter(r => r.status === 'verificado').length;
  const recibosPagos = relatorios.filter(r => r.status === 'pago').length;
  const recibosRejeitados = relatorios.filter(r => r.status === 'rejeitado').length;
  
  const documentosValidos = motoristaData?.documents ? 
    Object.entries(motoristaData.documents).filter(([key, value]) => value && value !== '').length : 0;
  const totalDocumentos = 15; // Total de documentos principais (expandido)
  
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
        <h1 className="text-3xl font-bold mb-2">Bem-vindo, {motoristaData?.name?.split(' ')[0] || 'Motorista'}!</h1>
        <p className="text-blue-100">Perfil: Motorista Independente</p>
        <Badge className="mt-2 bg-white text-blue-600">Conta Ativa</Badge>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Ganhos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{totalGanhos.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Recibos Enviados</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recibosEnviados}</div>
            <p className="text-xs text-slate-500 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Recibos Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{recibosPendentes}</div>
            <p className="text-xs text-slate-500 mt-1">Aguardando envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentosValidos}/{totalDocumentos}</div>
            <p className="text-xs text-slate-500 mt-1">Documentos válidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado dos Recibos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado dos Recibos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm font-medium text-slate-700">Pendentes de Envio</span>
              </div>
              <span className="text-lg font-bold text-yellow-700">{recibosPendentes}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-slate-700">Enviados</span>
              </div>
              <span className="text-lg font-bold text-blue-700">{recibosEnviados}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-slate-700">Verificados</span>
              </div>
              <span className="text-lg font-bold text-green-700">{recibosVerificados}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-medium text-slate-700">Pagos</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{recibosPagos}</span>
            </div>

            {recibosRejeitados > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-slate-700">Rejeitados</span>
                </div>
                <span className="text-lg font-bold text-red-700">{recibosRejeitados}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas e Notificações */}
      {motoristaData && (
        <div className="space-y-3">
          {recibosPendentes > 0 && (
            <Card className="border-l-4 border-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-slate-800">Recibos Pendentes</h3>
                    <p className="text-sm text-slate-600">Você tem {recibosPendentes} recibo(s) pendente(s) de envio.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {documentosValidos < totalDocumentos && (
            <Card className="border-l-4 border-yellow-500">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-slate-800">Documentos Incompletos</h3>
                    <p className="text-sm text-slate-600">
                      Faltam {totalDocumentos - documentosValidos} documento(s). Complete seu perfil na aba "Dados Pessoais".
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!motoristaData.plano_id && (
            <Card className="border-l-4 border-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-slate-800">Escolha um Plano</h3>
                    <p className="text-sm text-slate-600">
                      Ative um plano para ter acesso a relatórios avançados, alertas de documentos e muito mais.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default MotoristaDashboard;