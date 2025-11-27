import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Construction } from 'lucide-react';

const MotoristaOportunidades = ({ user, onLogout }) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Oportunidades de Veículos</h1>
          <p className="text-slate-600 mt-1">Veículos disponíveis para associação</p>
        </div>

        <Card>
          <CardContent className="text-center py-16">
            <Construction className="w-20 h-20 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Em Desenvolvimento</h2>
            <p className="text-slate-600 mb-4">
              O sistema de oportunidades está a ser implementado.
            </p>
            <div className="bg-green-50 border border-green-200 rounded p-4 max-w-md mx-auto">
              <Car className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-800">
                <strong>Funcionalidades Previstas:</strong>
              </p>
              <ul className="text-xs text-green-700 mt-2 space-y-1 text-left">
                <li>• Lista de veículos disponíveis (todos os parceiros)</li>
                <li>• Filtros por marca, modelo, ano</li>
                <li>• Condições: Aluguer / Comissão / Venda</li>
                <li>• Informações sobre caução</li>
                <li>• Galeria de fotos do veículo</li>
                <li>• Enviar interesse ao parceiro via mensagens</li>
                <li>• Visível apenas sem veículo/parceiro atribuído</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MotoristaOportunidades;