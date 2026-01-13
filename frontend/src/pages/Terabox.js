import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FolderPlus, 
  Upload, 
  Download, 
  Trash2, 
  Search,
  Folder,
  File,
  FileText,
  FileImage,
  MoreVertical,
  ChevronRight,
  Home,
  HardDrive,
  Eye,
  Edit,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';

const Terabox = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [pastas, setPastas] = useState([]);
  const [ficheiros, setFicheiros] = useState([]);
  const [currentPasta, setCurrentPasta] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [categorias, setCategorias] = useState([]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/terabox/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPastas = async (pastaId = null) => {
    try {
      const token = localStorage.getItem('token');
      const params = pastaId ? { pasta_pai_id: pastaId } : {};
      const response = await axios.get(`${API}/terabox/pastas`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setPastas(response.data);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const fetchFicheiros = async (pastaId = null) => {
    try {
      const token = localStorage.getItem('token');
      const params = { pasta_id: pastaId || 'root' };
      const response = await axios.get(`${API}/terabox/ficheiros`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setFicheiros(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/terabox/categorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategorias(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const loadFolder = useCallback(async (pasta = null) => {
    setLoading(true);
    setCurrentPasta(pasta);
    setSearchResults(null);
    
    await Promise.all([
      fetchPastas(pasta?.id),
      fetchFicheiros(pasta?.id)
    ]);
    
    // Update breadcrumbs
    if (!pasta) {
      setBreadcrumbs([]);
    } else {
      setBreadcrumbs(prev => {
        const existingIndex = prev.findIndex(p => p.id === pasta.id);
        if (existingIndex >= 0) {
          return prev.slice(0, existingIndex + 1);
        }
        return [...prev, pasta];
      });
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    fetchCategorias();
    loadFolder();
  }, [loadFolder]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Nome da pasta é obrigatório');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/terabox/pastas`, {
        nome: newFolderName,
        pasta_pai_id: currentPasta?.id || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Pasta criada com sucesso');
      setShowNewFolderDialog(false);
      setNewFolderName('');
      loadFolder(currentPasta);
      fetchStats();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erro ao criar pasta');
    }
  };

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const token = localStorage.getItem('token');
    
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pasta_id', currentPasta?.id || 'root');

        await axios.post(`${API}/terabox/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        successCount++;
      } catch (error) {
        console.error('Upload error:', error);
        errorCount++;
      }
    }

    setUploading(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} ficheiro(s) carregado(s) com sucesso`);
      loadFolder(currentPasta);
      fetchStats();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} ficheiro(s) falharam`);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleDownload = async (ficheiro) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/terabox/download/${ficheiro.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', ficheiro.nome);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Download iniciado');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao fazer download');
    }
  };

  const handleDeleteFile = async (ficheiro) => {
    if (!window.confirm(`Tem certeza que deseja eliminar "${ficheiro.nome}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/terabox/ficheiros/${ficheiro.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Ficheiro eliminado');
      loadFolder(currentPasta);
      fetchStats();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao eliminar ficheiro');
    }
  };

  const handleDeleteFolder = async (pasta) => {
    if (!window.confirm(`Tem certeza que deseja eliminar a pasta "${pasta.nome}" e todo o seu conteúdo?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/terabox/pastas/${pasta.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Pasta eliminada');
      loadFolder(currentPasta);
      fetchStats();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao eliminar pasta');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/terabox/pesquisar`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: searchQuery }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Erro na pesquisa');
    }
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <File className="w-8 h-8 text-slate-400" />;
    
    if (mimeType.startsWith('image/')) {
      return <FileImage className="w-8 h-8 text-green-500" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (mimeType.includes('document') || mimeType.includes('text')) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    }
    return <File className="w-8 h-8 text-slate-400" />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayItems = searchResults !== null ? searchResults : ficheiros;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Terabox</h1>
              <p className="text-slate-600">Armazenamento de documentos</p>
            </div>
          </div>
          
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="py-1 px-3">
                <Folder className="w-4 h-4 mr-1" />
                {stats.total_pastas} pastas
              </Badge>
              <Badge variant="outline" className="py-1 px-3">
                <File className="w-4 h-4 mr-1" />
                {stats.total_ficheiros} ficheiros
              </Badge>
              <Badge variant="secondary" className="py-1 px-3">
                <HardDrive className="w-4 h-4 mr-1" />
                {stats.espaco_usado_formatado}
              </Badge>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Nova Pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Pasta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Nome da pasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateFolder}>
                      Criar Pasta
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <label className="cursor-pointer">
              <Button variant="default" disabled={uploading} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A carregar...' : 'Carregar Ficheiros'}
                </span>
              </Button>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Pesquisar ficheiros..."
              className="w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="w-4 h-4" />
            </Button>
            {searchResults !== null && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearchResults(null);
                setSearchQuery('');
              }}>
                Limpar pesquisa
              </Button>
            )}
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm bg-slate-50 p-3 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadFolder(null)}
            className="h-8"
          >
            <Home className="w-4 h-4 mr-1" />
            Início
          </Button>
          
          {breadcrumbs.map((pasta, index) => (
            <div key={pasta.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadFolder(pasta)}
                className="h-8"
              >
                {pasta.nome}
              </Button>
            </div>
          ))}
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-12 text-slate-500">
                A carregar...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Folders */}
                {!searchResults && pastas.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {pastas.map((pasta) => (
                      <div
                        key={pasta.id}
                        className="group relative p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-all"
                        onDoubleClick={() => loadFolder(pasta)}
                      >
                        <div className="flex flex-col items-center text-center">
                          <Folder className="w-12 h-12 text-yellow-500 mb-2" />
                          <span className="text-sm font-medium truncate w-full">
                            {pasta.nome}
                          </span>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => loadFolder(pasta)}>
                              <FolderOpen className="w-4 h-4 mr-2" />
                              Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteFolder(pasta)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                {!searchResults && pastas.length > 0 && ficheiros.length > 0 && (
                  <hr className="my-6" />
                )}

                {/* Files */}
                {displayItems.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults && (
                      <p className="text-sm text-slate-500 mb-4">
                        {displayItems.length} resultado(s) encontrado(s)
                      </p>
                    )}
                    
                    {displayItems.map((ficheiro) => (
                      <div
                        key={ficheiro.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          {getFileIcon(ficheiro.mime_type)}
                          <div>
                            <p className="font-medium">{ficheiro.nome}</p>
                            <p className="text-sm text-slate-500">
                              {ficheiro.tamanho_formatado} • {formatDate(ficheiro.criado_em)}
                              {ficheiro.downloads > 0 && ` • ${ficheiro.downloads} downloads`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(ficheiro.mime_type?.startsWith('image/') || ficheiro.mime_type === 'application/pdf') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`${API}/terabox/preview/${ficheiro.id}`, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(ficheiro)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteFile(ficheiro)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !searchResults && pastas.length === 0 && (
                    <div className="text-center py-12">
                      <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500 text-lg">Esta pasta está vazia</p>
                      <p className="text-slate-400 text-sm mt-2">
                        Crie uma pasta ou carregue ficheiros para começar
                      </p>
                    </div>
                  )
                )}
                
                {searchResults && displayItems.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 text-lg">Nenhum resultado encontrado</p>
                    <p className="text-slate-400 text-sm mt-2">
                      Tente outra pesquisa
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Files */}
        {stats?.ficheiros_recentes?.length > 0 && !searchResults && !currentPasta && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ficheiros Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.ficheiros_recentes.map((ficheiro) => (
                  <div
                    key={ficheiro.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleDownload(ficheiro)}
                  >
                    <File className="w-6 h-6 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ficheiro.nome}</p>
                      <p className="text-xs text-slate-500">
                        {ficheiro.tamanho ? `${(ficheiro.tamanho / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Terabox;
