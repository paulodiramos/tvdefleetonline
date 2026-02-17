import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  Clock, 
  FileArchive, 
  FileJson, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Info,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CopiaSeguranca() {
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [backups, setBackups] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [info, setInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('exportar');
  
  // Opções de exportação
  const [incluirFicheiros, setIncluirFicheiros] = useState(false);
  const [nomeBackup, setNomeBackup] = useState('');
  
  // Opções de importação
  const [modoImportacao, setModoImportacao] = useState('substituir');
  const [ficheiro, setFicheiro] = useState(null);
  
  const token = localStorage.getItem('token');
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar histórico de backups
      const backupsRes = await fetch(`${API_URL}/api/backup/historico`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (backupsRes.ok) {
        const data = await backupsRes.json();
        setBackups(data.backups || []);
      }
      
      // Buscar histórico de importações
      const importRes = await fetch(`${API_URL}/api/backup/importacoes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (importRes.ok) {
        const data = await importRes.json();
        setImportacoes(data.importacoes || []);
      }
      
      // Buscar info
      const infoRes = await fetch(`${API_URL}/api/backup/info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (infoRes.ok) {
        const data = await infoRes.json();
        setInfo(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleExportar = async () => {
    setExportando(true);
    try {
      const response = await fetch(`${API_URL}/api/backup/exportar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          incluir_ficheiros: incluirFicheiros,
          nome_backup: nomeBackup || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Backup criado com sucesso! ${data.estatisticas.total_registos} registos exportados`);
        
        // Download automático
        window.open(`${API_URL}/api/backup/download/${data.backup_id}?token=${token}`, '_blank');
        
        fetchData();
        setNomeBackup('');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao criar backup');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao criar backup');
    } finally {
      setExportando(false);
    }
  };
  
  const handleImportar = async () => {
    if (!ficheiro) {
      toast.error('Selecione um ficheiro de backup');
      return;
    }
    
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append('file', ficheiro);
      formData.append('modo', modoImportacao);
      
      const response = await fetch(`${API_URL}/api/backup/importar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Backup importado! ${data.estatisticas.registos_inseridos} registos inseridos, ${data.estatisticas.registos_atualizados} atualizados`);
        fetchData();
        setFicheiro(null);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao importar backup');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao importar backup');
    } finally {
      setImportando(false);
    }
  };
  
  const handleDownload = (backupId) => {
    window.open(`${API_URL}/api/backup/download/${backupId}?token=${token}`, '_blank');
  };
  
  const handleApagar = async (backupId) => {
    if (!window.confirm('Tem certeza que deseja apagar este backup?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/backup/${backupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Backup apagado');
        fetchData();
      } else {
        toast.error('Erro ao apagar backup');
      }
    } catch (error) {
      toast.error('Erro ao apagar backup');
    }
  };
  
  const formatarData = (dataStr) => {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-7 w-7 text-blue-600" />
              Cópia de Segurança
            </h1>
            <p className="text-slate-600 mt-1">
              Exporte e importe todos os dados da sua conta
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        
        {/* Info Card */}
        {info && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500">Total Estimado</p>
                    <p className="font-semibold text-slate-900">{info.total_registos_estimado?.toLocaleString()} registos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500">Coleções</p>
                    <p className="font-semibold text-slate-900">{info.total_colecoes}</p>
                  </div>
                </div>
                {info.ultimo_backup && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">Último Backup</p>
                      <p className="font-semibold text-slate-900">{formatarData(info.ultimo_backup.created_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('exportar')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'exportar'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download className="h-4 w-4 inline mr-2" />
            Exportar
          </button>
          <button
            onClick={() => setActiveTab('importar')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'importar'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Importar
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'historico'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            Histórico
          </button>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'exportar' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Opção A - Apenas Dados */}
            <Card 
              className={`cursor-pointer transition-all ${
                !incluirFicheiros 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:border-blue-300'
              }`}
              onClick={() => setIncluirFicheiros(false)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <FileJson className="h-10 w-10 text-blue-600" />
                  {!incluirFicheiros && (
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <CardTitle className="mt-4">Apenas Dados</CardTitle>
                <CardDescription>
                  Exporta todos os dados em formato JSON. Mais leve e rápido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Motoristas e Veículos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Ganhos Uber/Bolt
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Despesas e Via Verde
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Relatórios Semanais
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Pagamentos e Dívidas
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <AlertCircle className="h-4 w-4" />
                    PDFs e imagens não incluídos
                  </li>
                </ul>
                <div className="mt-4 p-2 bg-blue-100 rounded text-sm text-blue-700">
                  Tamanho estimado: ~1-5 MB
                </div>
              </CardContent>
            </Card>
            
            {/* Opção B - Completo */}
            <Card 
              className={`cursor-pointer transition-all ${
                incluirFicheiros 
                  ? 'ring-2 ring-purple-500 bg-purple-50' 
                  : 'hover:border-purple-300'
              }`}
              onClick={() => setIncluirFicheiros(true)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <FileArchive className="h-10 w-10 text-purple-600" />
                  {incluirFicheiros && (
                    <CheckCircle className="h-6 w-6 text-purple-600" />
                  )}
                </div>
                <CardTitle className="mt-4">Backup Completo</CardTitle>
                <CardDescription>
                  Dados + Ficheiros anexos em formato ZIP.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Tudo da opção anterior
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    PDFs de Vistorias
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Recibos e Comprovativos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Contratos assinados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Documentos anexados
                  </li>
                </ul>
                <div className="mt-4 p-2 bg-purple-100 rounded text-sm text-purple-700">
                  Tamanho estimado: ~50-500 MB
                </div>
              </CardContent>
            </Card>
            
            {/* Formulário de exportação */}
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome do Backup (opcional)
                    </label>
                    <input
                      type="text"
                      value={nomeBackup}
                      onChange={(e) => setNomeBackup(e.target.value)}
                      placeholder="Ex: backup_janeiro_2026"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <Button
                    onClick={handleExportar}
                    disabled={exportando}
                    className={`px-6 py-2 ${
                      incluirFicheiros 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {exportando ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        A criar backup...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Criar Backup
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === 'importar' && (
          <div className="space-y-6">
            {/* Aviso */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Atenção</p>
                  <p className="text-sm text-amber-700">
                    A importação irá restaurar os dados do backup. Dependendo do modo selecionado, 
                    os dados existentes podem ser substituídos. Faça um backup antes de importar.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Importar Backup</CardTitle>
                <CardDescription>
                  Selecione um ficheiro de backup (.json ou .zip) para restaurar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ficheiro de Backup
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept=".json,.zip"
                      onChange={(e) => setFicheiro(e.target.files[0])}
                      className="hidden"
                      id="backup-file"
                    />
                    <label htmlFor="backup-file" className="cursor-pointer">
                      <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                      {ficheiro ? (
                        <p className="text-slate-700 font-medium">{ficheiro.name}</p>
                      ) : (
                        <>
                          <p className="text-slate-600">Clique para selecionar ficheiro</p>
                          <p className="text-sm text-slate-400">.json ou .zip</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
                
                {/* Modo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Modo de Importação
                  </label>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setModoImportacao('substituir')}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        modoImportacao === 'substituir'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">Substituir</span>
                        {modoImportacao === 'substituir' && (
                          <CheckCircle className="h-4 w-4 text-blue-600 ml-auto" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Atualiza registos existentes e adiciona novos. Recomendado para restaurar backup.
                      </p>
                    </div>
                    <div
                      onClick={() => setModoImportacao('adicionar')}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        modoImportacao === 'adicionar'
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Adicionar</span>
                        {modoImportacao === 'adicionar' && (
                          <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Apenas adiciona novos registos sem substituir existentes. Pode criar duplicados.
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={handleImportar}
                  disabled={importando || !ficheiro}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {importando ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      A importar...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Backup
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === 'historico' && (
          <div className="space-y-6">
            {/* Backups */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Backups Criados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {backups.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum backup criado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          {backup.tipo === 'completo' ? (
                            <FileArchive className="h-8 w-8 text-purple-600" />
                          ) : (
                            <FileJson className="h-8 w-8 text-blue-600" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">{backup.nome}</p>
                            <div className="flex gap-4 text-sm text-slate-500">
                              <span>{formatarData(backup.created_at)}</span>
                              <span>{backup.tamanho_formatado}</span>
                              <span>{backup.total_registos?.toLocaleString()} registos</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(backup.id)}
                            disabled={!backup.ficheiro_existe}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApagar(backup.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Importações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Histórico de Importações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {importacoes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma importação realizada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {importacoes.map((imp) => (
                      <div
                        key={imp.id}
                        className="p-4 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-slate-900">{imp.filename}</p>
                          <span className="text-sm text-slate-500">{formatarData(imp.created_at)}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-green-600">
                            {imp.estatisticas?.registos_inseridos || 0} inseridos
                          </span>
                          <span className="text-blue-600">
                            {imp.estatisticas?.registos_atualizados || 0} atualizados
                          </span>
                          <span className="text-slate-500">
                            Modo: {imp.modo}
                          </span>
                        </div>
                        {imp.estatisticas?.erros?.length > 0 && (
                          <div className="mt-2 text-sm text-red-600">
                            {imp.estatisticas.erros.length} erros
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Info Footer */}
        <Card className="bg-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Sobre o Backup</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Os backups incluem todos os dados associados à sua conta</li>
                  <li>Ficheiros de backup podem ser usados para migrar para outro servidor</li>
                  <li>Recomendamos fazer backup regularmente, especialmente antes de alterações importantes</li>
                  <li>Os backups são guardados no servidor e podem ser descarregados a qualquer momento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
