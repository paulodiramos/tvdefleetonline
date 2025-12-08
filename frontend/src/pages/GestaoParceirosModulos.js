import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Settings, Search, Save, Package } from 'lucide-react';

const MODULOS_DISPONIVEIS = [
  { codigo: 'gestao_eventos_veiculo', nome: 'Gestão de Eventos de Veículo', descricao: 'Permite editar agenda e eventos dos veículos' },
  { codigo: 'gestao_contratos', nome: 'Gestão Avançada de Contratos', descricao: 'Criar e gerir contratos de motoristas' },
  { codigo: 'relatorios_avancados', nome: 'Relatórios Avançados', descricao: 'Acesso a relatórios detalhados e analytics' },
  { codigo: 'gestao_documentos', nome: 'Gestão de Documentos', descricao: 'Upload e gestão de documentos' },
  { codigo: 'acesso_vistorias', nome: 'Acesso a Vistorias', descricao: 'Visualizar e criar vistorias de veículos' },
  { codigo: 'moloni_auto_faturacao', nome: 'Auto-Faturação Moloni', descricao: 'Integração com Moloni para faturação automática' },
  { codigo: 'configuracao_templates', nome: 'Templates Personalizados', descricao: 'Criar templates de contratos personalizados' }
];

const GestaoParceirosModulos = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [filteredParceiros, setFilteredParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [showModulosDialog, setShowModulosDialog] = useState(false);
  const [modulosAtivos, setModulosAtivos] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchParceiros();
  }, []);

  useEffect(() => {
    filterParceiros();
  }, [search, parceiros]);

  const fetchParceiros = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const filterParceiros = () => {
    if (!search) {
      setFilteredParceiros(parceiros);
      return;
    }

    const filtered = parceiros.filter(p =>
      p.nome_empresa?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredParceiros(filtered);
  };

  const handleOpenModulos = async (parceiro) => {
    setSelectedParceiro(parceiro);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/${parceiro.id}/modulos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const modulos = response.data.modulos_ativos || [];
      const modulosMap = {};
      MODULOS_DISPONIVEIS.forEach(m => {
        modulosMap[m.codigo] = modulos.includes(m.codigo);
      });
      
      setModulosAtivos(modulosMap);
      setShowModulosDialog(true);
    } catch (error) {
      console.error('Error fetching modulos:', error);
      toast.error('Erro ao carregar módulos');
    }
  };

  const handleSaveModulos = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const modulosArray = Object.entries(modulosAtivos)
        .filter(([_, ativo]) => ativo)
        .map(([codigo, _]) => codigo);
      
      await axios.post(
        `${API}/users/${selectedParceiro.id}/modulos`,
        { modulos_ativos: modulosArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Módulos atualizados com sucesso!');
      setShowModulosDialog(false);
      fetchParceiros();
    } catch (error) {
      console.error('Error saving modulos:', error);
      toast.error('Erro ao salvar módulos');
    } finally {
      setSaving(false);
    }
  };

  const getModulosCount = (parceiro) => {
    // Contar módulos ativos do parceiro
    const planoUsuario = parceiro.plano_ativo;
    if (!planoUsuario) return 0;
    return (planoUsuario.modulos_ativos || []).length;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <span>Gestão de Módulos de Parceiros</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Ativar/desativar funcionalidades para cada parceiro
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar parceiro por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Parceiros List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParceiros.map((parceiro) => (
            <Card key={parceiro.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{parceiro.nome_empresa || parceiro.name}</CardTitle>
                <p className="text-sm text-slate-500">{parceiro.email}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Módulos Ativos:</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    <Package className="w-3 h-3 mr-1" />
                    {getModulosCount(parceiro)}
                  </Badge>
                </div>
                
                <Button
                  onClick={() => handleOpenModulos(parceiro)}
                  variant="outline"
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Gerenciar Módulos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredParceiros.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              Nenhum parceiro encontrado
            </CardContent>
          </Card>
        )}

        {/* Modulos Dialog */}
        <Dialog open={showModulosDialog} onOpenChange={setShowModulosDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Módulos - {selectedParceiro?.nome_empresa || selectedParceiro?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {MODULOS_DISPONIVEIS.map((modulo) => (
                <Card key={modulo.codigo}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <Label className="text-base font-semibold cursor-pointer" htmlFor={modulo.codigo}>
                          {modulo.nome}
                        </Label>
                        <p className="text-sm text-slate-500">
                          {modulo.descricao}
                        </p>
                      </div>
                      <Switch
                        id={modulo.codigo}
                        checked={modulosAtivos[modulo.codigo] || false}
                        onCheckedChange={(checked) => setModulosAtivos({
                          ...modulosAtivos,
                          [modulo.codigo]: checked
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowModulosDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveModulos}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Módulos
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoParceirosModulos;
