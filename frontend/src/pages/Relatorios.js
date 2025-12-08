import { useState } from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Zap, Upload } from 'lucide-react';

// Importar componentes existentes (quando prontos)
// import CriarRelatorio from '@/components/CriarRelatorio';
// import SyncAuto from '@/components/SyncAuto';
// import UploadCSV from '@/components/UploadCSV';

const Relatorios = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('criar');

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-slate-600 mt-1">
            Crie e gerencie relatórios semanais dos motoristas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="criar" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Criar Relatório</span>
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Sync Auto</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload CSV</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Criar Relatório */}
          <TabsContent value="criar">
            <Card>
              <CardHeader>
                <CardTitle>Criar Relatório Semanal</CardTitle>
                <CardDescription>
                  Crie relatórios semanais em PDF para motoristas e parceiros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    Formulário de criação de relatório será implementado aqui
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Incluirá: Seleção de motorista, veículo, período, ganhos Uber/Bolt, 
                    despesas, caução, etc.
                  </p>
                </div>
                {/* <CriarRelatorio /> */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Sync Auto */}
          <TabsContent value="sync">
            <Card>
              <CardHeader>
                <CardTitle>Sincronização Automática</CardTitle>
                <CardDescription>
                  Configure a importação automática de dados Uber e Bolt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    Sistema de sincronização automática
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Conecte APIs do Uber e Bolt para importação automática de dados
                  </p>
                </div>
                {/* <SyncAuto /> */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Upload CSV */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload de CSV</CardTitle>
                <CardDescription>
                  Importe dados de ganhos através de arquivos CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Upload className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    Sistema de upload de CSV será implementado aqui
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Upload de relatórios Uber e Bolt em formato CSV
                  </p>
                </div>
                {/* <UploadCSV /> */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Relatorios;
