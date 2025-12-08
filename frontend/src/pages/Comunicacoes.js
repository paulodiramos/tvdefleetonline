import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Mail, MessageSquare, AlertTriangle } from 'lucide-react';

const Comunicacoes = ({ user, onLogout }) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Comunicações</h1>
          <p className="text-slate-600 mt-1">Configure as comunicações automáticas do sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Notificações por Email</CardTitle>
              <CardDescription>Configure emails automáticos enviados pelo sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Mensagens WhatsApp</CardTitle>
              <CardDescription>Configure mensagens automáticas via WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Notificações Push</CardTitle>
              <CardDescription>Alertas em tempo real no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Alertas de Sistema</CardTitle>
              <CardDescription>Configure alertas de documentos, pagamentos, etc</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Comunicacoes;
