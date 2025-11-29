import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Shield, Save } from 'lucide-react';

const ConfiguracoesAdmin = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configData, setConfigData] = useState({
    condicoes_gerais: '',
    politica_privacidade: '',
    email_comunicacoes: '',
    whatsapp_comunicacoes: ''
  });
  const [originalData, setOriginalData] = useState({
    condicoes_gerais: '',
    politica_privacidade: '',
    email_comunicacoes: '',
    whatsapp_comunicacoes: ''
  });

  useEffect(() => {
    fetchConfigData();
  }, []);

  const fetchConfigData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/config/textos-legais`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigData({
        condicoes_gerais: response.data.condicoes_gerais || '',
        politica_privacidade: response.data.politica_privacidade || '',
        email_comunicacoes: response.data.email_comunicacoes || '',
        whatsapp_comunicacoes: response.data.whatsapp_comunicacoes || ''
      });
      setOriginalData({
        condicoes_gerais: response.data.condicoes_gerais || '',
        politica_privacidade: response.data.politica_privacidade || '',
        email_comunicacoes: response.data.email_comunicacoes || '',
        whatsapp_comunicacoes: response.data.whatsapp_comunicacoes || ''
      });
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTerms = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/textos-legais`,
        { condicoes_gerais: configData.condicoes_gerais },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ ...originalData, condicoes_gerais: configData.condicoes_gerais });
      toast.success('Termos e Condições guardados com sucesso!');
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error('Erro ao guardar Termos e Condições');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/textos-legais`,
        { politica_privacidade: configData.politica_privacidade },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ ...originalData, politica_privacidade: configData.politica_privacidade });
      toast.success('Política de Privacidade guardada com sucesso!');
    } catch (error) {
      console.error('Error saving privacy:', error);
      toast.error('Erro ao guardar Política de Privacidade');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTerms = () => {
    setConfigData({ ...configData, condicoes_gerais: originalData.condicoes_gerais });
    toast.info('Alterações descartadas');
  };

  const handleCancelPrivacy = () => {
    setConfigData({ ...configData, politica_privacidade: originalData.politica_privacidade });
    toast.info('Alterações descartadas');
  };

  const handleSaveComunicacoes = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/config/comunicacoes`,
        { 
          email_comunicacoes: configData.email_comunicacoes,
          whatsapp_comunicacoes: configData.whatsapp_comunicacoes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOriginalData({ 
        ...originalData, 
        email_comunicacoes: configData.email_comunicacoes,
        whatsapp_comunicacoes: configData.whatsapp_comunicacoes
      });
      toast.success('Configurações de comunicação guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving comunicacoes:', error);
      toast.error('Erro ao guardar configurações de comunicação');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-screen">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Shield className="w-6 h-6" />
                <span>Acesso Negado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Apenas administradores podem aceder a esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <span>Configurações do Sistema</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Gerir textos legais e configurações gerais do sistema
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="terms" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="terms" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Termos e Condições</span>
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Política de Privacidade</span>
                </TabsTrigger>
                <TabsTrigger value="comunicacoes" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Comunicações</span>
                </TabsTrigger>
              </TabsList>

              {/* Terms and Conditions Tab */}
              <TabsContent value="terms" className="space-y-4">
                <div>
                  <Label htmlFor="condicoes_gerais" className="text-lg font-semibold">
                    Termos e Condições Gerais
                  </Label>
                  <p className="text-sm text-slate-600 mb-3">
                    Defina os termos e condições que serão exibidos na plataforma
                  </p>
                  <textarea
                    id="condicoes_gerais"
                    className="w-full p-4 border rounded-md min-h-[400px] text-sm"
                    placeholder="Escreva aqui os Termos e Condições Gerais..."
                    value={configData.condicoes_gerais}
                    onChange={(e) => setConfigData({ ...configData, condicoes_gerais: e.target.value })}
                    disabled={loading || saving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelTerms}
                    disabled={loading || saving || configData.condicoes_gerais === originalData.condicoes_gerais}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSaveTerms}
                    disabled={loading || saving || configData.condicoes_gerais === originalData.condicoes_gerais}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Termos</span>
                  </Button>
                </div>
              </TabsContent>

              {/* Privacy Policy Tab */}
              <TabsContent value="privacy" className="space-y-4">
                <div>
                  <Label htmlFor="politica_privacidade" className="text-lg font-semibold">
                    Política de Privacidade
                  </Label>
                  <p className="text-sm text-slate-600 mb-3">
                    Defina a política de privacidade que será exibida na plataforma
                  </p>
                  <textarea
                    id="politica_privacidade"
                    className="w-full p-4 border rounded-md min-h-[400px] text-sm"
                    placeholder="Escreva aqui a Política de Privacidade..."
                    value={configData.politica_privacidade}
                    onChange={(e) => setConfigData({ ...configData, politica_privacidade: e.target.value })}
                    disabled={loading || saving}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPrivacy}
                    disabled={loading || saving || configData.politica_privacidade === originalData.politica_privacidade}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                    onClick={handleSavePrivacy}
                    disabled={loading || saving || configData.politica_privacidade === originalData.politica_privacidade}
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Política</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracoesAdmin;
