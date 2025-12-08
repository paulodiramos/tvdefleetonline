import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Construction } from 'lucide-react';

const MotoristaMensagens = ({ user, onLogout }) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Mensagens</h1>
          <p className="text-slate-600 mt-1">Sistema de comunicação interna</p>
        </div>

        <Card>
          <CardContent className="text-center py-16">
            <Construction className="w-20 h-20 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Em Desenvolvimento</h2>
            <p className="text-slate-600 mb-4">
              O sistema de mensagens internas está a ser implementado.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 max-w-md mx-auto">
              <MessageSquare className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-blue-800">
                <strong>Funcionalidades Previstas:</strong>
              </p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1 text-left">
                <li>• Chat com Admin, Gestor</li>
                <li>• Mensagens com Parceiro associado</li>
                <li>• Histórico de conversas</li>
                <li>• Notificações de novas mensagens</li>
                <li>• Sistema de inbox simples</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MotoristaMensagens;