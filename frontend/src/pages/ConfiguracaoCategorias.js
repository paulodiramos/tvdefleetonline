import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, Car, CheckCircle } from 'lucide-react';

const ConfiguracaoCategorias = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [categoriasUber, setCategoriasUber] = useState([
    'UberX',
    'Share',
    'Electric',
    'Black',
    'Comfort',
    'XL',
    'XXL',
    'Pet',
    'Package'
  ]);
  
  const [categoriasBolt, setCategoriasBolt] = useState([
    'Economy',
    'Comfort',
    'Executive',
    'XL',
    'Green',
    'XXL',
    'Motorista Privado',
    'Pet'
  ]);
  
  const [novaCategoria, setNovaCategoria] = useState({ uber: '', bolt: '' });

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/configuracoes/categorias-plataformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.uber) {
        setCategoriasUber(response.data.uber);
      }
      if (response.data.bolt) {
        setCategoriasBolt(response.data.bolt);
      }
    } catch (error) {
      console.error('Error fetching categorias:', error);
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar categorias');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategorias = async (plataforma) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const data = {
        plataforma: plataforma,
        categorias: plataforma === 'uber' ? categoriasUber : categoriasBolt
      };
      
      await axios.post(
        `${API}/configuracoes/categorias-plataformas`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Categorias ${plataforma === 'uber' ? 'Uber' : 'Bolt'} salvas com sucesso!`);
    } catch (error) {
      console.error('Error saving categorias:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategoria = (plataforma) => {
    const categoria = novaCategoria[plataforma].trim();
    
    if (!categoria) {
      toast.error('Por favor insira o nome da categoria');
      return;
    }
    
    if (plataforma === 'uber') {
      if (categoriasUber.includes(categoria)) {
        toast.error('Esta categoria já existe');
        return;
      }
      setCategoriasUber([...categoriasUber, categoria]);
    } else {
      if (categoriasBolt.includes(categoria)) {
        toast.error('Esta categoria já existe');
        return;
      }
      setCategoriasBolt([...categoriasBolt, categoria]);
    }
    
    setNovaCategoria({ ...novaCategoria, [plataforma]: '' });
    toast.success('Categoria adicionada! Não esqueça de salvar.');
  };

  const handleRemoveCategoria = (plataforma, categoria) => {
    if (plataforma === 'uber') {
      setCategoriasUber(categoriasUber.filter(c => c !== categoria));
    } else {
      setCategoriasBolt(categoriasBolt.filter(c => c !== categoria));
    }
    toast.success('Categoria removida! Não esqueça de salvar.');
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <span>Configuração de Categorias</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Configure as categorias disponíveis para Uber e Bolt
          </p>
        </div>

        <Tabs defaultValue="uber" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="uber" className="flex items-center space-x-2">
              <Car className="w-4 h-4" />
              <span>Categorias Uber</span>
            </TabsTrigger>
            <TabsTrigger value="bolt" className="flex items-center space-x-2">
              <Car className="w-4 h-4" />
              <span>Categorias Bolt</span>
            </TabsTrigger>
          </TabsList>

          {/* Uber Categories */}
          <TabsContent value="uber">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Categorias Uber</span>
                </CardTitle>
                <CardDescription>
                  Gerir as categorias de veículos disponíveis na plataforma Uber
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Add New Category */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Nova categoria (ex: Bolt, Comfort Plus)"
                    value={novaCategoria.uber}
                    onChange={(e) => setNovaCategoria({ ...novaCategoria, uber: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCategoria('uber');
                      }
                    }}
                  />
                  <Button onClick={() => handleAddCategoria('uber')} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {/* Categories List */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Categorias Ativas ({categoriasUber.length})
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {categoriasUber.map((categoria, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-slate-700">{categoria}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCategoria('uber', categoria)}
                          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleSaveCategorias('uber')}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? 'Salvando...' : 'Salvar Configurações Uber'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bolt Categories */}
          <TabsContent value="bolt">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Categorias Bolt</span>
                </CardTitle>
                <CardDescription>
                  Gerir as categorias de veículos disponíveis na plataforma Bolt
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Add New Category */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Nova categoria (ex: Bolt, Executive Plus)"
                    value={novaCategoria.bolt}
                    onChange={(e) => setNovaCategoria({ ...novaCategoria, bolt: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCategoria('bolt');
                      }
                    }}
                  />
                  <Button onClick={() => handleAddCategoria('bolt')} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {/* Categories List */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Categorias Ativas ({categoriasBolt.length})
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {categoriasBolt.map((categoria, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-slate-700">{categoria}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCategoria('bolt', categoria)}
                          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleSaveCategorias('bolt')}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? 'Salvando...' : 'Salvar Configurações Bolt'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="mt-1">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como funciona:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>As categorias configuradas aqui ficarão disponíveis ao criar/editar veículos</li>
                  <li>Pode adicionar categorias personalizadas conforme necessário</li>
                  <li>Exemplo: Se a Bolt lançar nova categoria "Bolt Plus", adicione aqui</li>
                  <li>As alterações aplicam-se imediatamente após salvar</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoCategorias;
