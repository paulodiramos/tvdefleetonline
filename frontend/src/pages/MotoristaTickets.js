import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Ticket, Construction } from 'lucide-react';

const MotoristaTickets = ({ user, onLogout }) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tickets de Suporte</h1>
          <p className="text-slate-600 mt-1">Abrir e acompanhar tickets</p>
        </div>

        <Card>
          <CardContent className="text-center py-16">
            <Construction className="w-20 h-20 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Em Desenvolvimento</h2>
            <p className="text-slate-600 mb-4">
              O sistema de tickets está a ser implementado.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-4 max-w-md mx-auto">
              <Ticket className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm text-amber-800">
                <strong>Funcionalidades Previstas:</strong>
              </p>
              <ul className="text-xs text-amber-700 mt-2 space-y-1 text-left">
                <li>• Abrir tickets para problemas com viatura</li>
                <li>• Reportar situações com atividade</li>
                <li>• Solicitar alteração de documentos validados</li>
                <li>• Acompanhar status do ticket</li>
                <li>• Responder e receber respostas</li>
                <li>• Anexar fotos e documentos</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MotoristaTickets;