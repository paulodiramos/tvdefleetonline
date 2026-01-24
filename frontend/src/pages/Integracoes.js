import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, HardDrive, Settings, ArrowRight } from 'lucide-react';

const Integracoes = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Integrações</h1>
          <p className="text-slate-500">Configure as integrações da sua conta</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* WhatsApp Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/configuracoes-parceiro?tab=whatsapp')}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                  <CardDescription>API Oficial da Meta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Envie mensagens e relatórios aos motoristas via WhatsApp Cloud API.
                Grátis até 1000 mensagens/mês.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/configuracoes-parceiro?tab=email')}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Email SMTP</CardTitle>
                  <CardDescription>Gmail, Outlook, etc.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Configure o seu servidor de email para enviar relatórios e notificações aos motoristas.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Terabox Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/configuracoes-parceiro?tab=terabox')}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HardDrive className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Terabox</CardTitle>
                  <CardDescription>Armazenamento Cloud</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Configure o Terabox para guardar documentos e ficheiros na nuvem automaticamente.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-200 rounded-lg">
                <Settings className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-medium text-slate-800">Todas as configurações num só lugar</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Aceda à página de <button onClick={() => navigate('/configuracoes-parceiro')} className="text-blue-600 underline">Configurações do Parceiro</button> para gerir todas as integrações, incluindo credenciais de plataformas (Uber, Bolt, Via Verde).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Integracoes;
