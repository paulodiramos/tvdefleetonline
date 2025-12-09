import { useState } from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, FilePlus } from 'lucide-react';
import ListaContratos from './ListaContratos';
import TemplatesContratos from './TemplatesContratos';

const ContratosComTabs = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('contratos');
  
  // Verificar se é parceiro - mostrar apenas templates
  const isParceiro = user.role === 'parceiro';
  const isAdminOrGestor = user.role === 'admin' || user.role === 'gestao';

  // Se for parceiro, mostrar só templates
  if (isParceiro) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
              <FilePlus className="w-8 h-8 text-blue-600" />
              <span>Meus Templates de Contrato</span>
            </h1>
            <p className="text-slate-600 mt-2">
              Gerir os seus templates de contrato personalizados
            </p>
          </div>
          <TemplatesContratos user={user} onLogout={onLogout} showLayout={false} />
        </div>
      </Layout>
    );
  }

  // Admin/Gestor - mostrar apenas lista de contratos
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <span>Gestão de Contratos</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Gerir todos os contratos do sistema
          </p>
        </div>
        <ListaContratos user={user} onLogout={onLogout} showLayout={false} />
      </div>
    </Layout>
  );
};

export default ContratosComTabs;
