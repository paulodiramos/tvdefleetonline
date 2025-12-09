import { useState } from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, FilePlus, List } from 'lucide-react';
import ListaContratos from './ListaContratos';
import TemplatesContratos from './TemplatesContratos';
import CriarContratoMotoristaParceiro from '@/components/CriarContratoMotoristaParceiro';

const PerfilParceiro = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('templates');

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Perfil do Parceiro</h1>
          <p className="text-slate-600 mt-2">{user?.name || 'Parceiro'}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="criar" className="flex items-center gap-2">
                  <FilePlus className="w-4 h-4" />
                  Criar Contrato
                </TabsTrigger>
                <TabsTrigger value="lista" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Lista
                </TabsTrigger>
              </TabsList>

              <TabsContent value="templates" className="mt-6">
                <TemplatesContratos user={user} showLayout={false} />
              </TabsContent>

              <TabsContent value="criar" className="mt-6">
                <CriarContratoMotoristaParceiro user={user} />
              </TabsContent>

              <TabsContent value="lista" className="mt-6">
                <ListaContratos user={user} showLayout={false} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PerfilParceiro;
