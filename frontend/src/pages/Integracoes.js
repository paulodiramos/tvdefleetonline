import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plug, Mail, MessageSquare, CreditCard, Cloud } from 'lucide-react';

const Integracoes = ({ user, onLogout }) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-slate-600 mt-1">Configure integrações com serviços externos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>Configure servidor SMTP para envio de emails</CardDescription>
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
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Integração com API do WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Pagamentos</CardTitle>
              <CardDescription>Integração com gateways de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Cloud className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Cloud Storage</CardTitle>
              <CardDescription>Armazenamento em nuvem para documentos</CardDescription>
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

export default Integracoes;
