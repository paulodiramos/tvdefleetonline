import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { 
  Download, Upload, Database, RefreshCw, FileJson, History, HardDrive,
  Trash2, AlertTriangle, BarChart3, Loader2
} from 'lucide-react';
import { API } from '../App';
import Layout from '../components/Layout';

export default function BackupAdmin({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [colecoes, setColecoes] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [analiseLimpeza, setAnaliseLimpeza] = useState(null);
  const [statsArmazenamento, setStatsArmazenamento] = useState(null);
  const [limpando, setLimpando] = useState(null);

  useEffect(() => {
    carregarColecoes();
    carregarHistorico();
    carregarAnaliseLimpeza();
    carregarStatsArmazenamento();
  }, []);

  const carregarColecoes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/colecoes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setColecoes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar coleções:', error);
    }
  };

  const carregarHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/historico`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistorico(data);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const carregarAnaliseLimpeza = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/limpeza/analise`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnaliseLimpeza(data);
      }
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
    }
  };

  const carregarStatsArmazenamento = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/armazenamento/estatisticas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatsArmazenamento(data);
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  };

  const executarLimpeza = async (categoriaId) => {
    if (!confirm(`Tem certeza que deseja limpar "${categoriaId}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    setLimpando(categoriaId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/limpeza/executar/${categoriaId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Limpeza concluída! ${data.documentos_removidos} documentos removidos.`);
        carregarAnaliseLimpeza();
        carregarColecoes();
        carregarStatsArmazenamento();
      } else {
        toast.error('Erro ao executar limpeza');
      }
    } catch (error) {
      toast.error('Erro ao executar limpeza');
    } finally {
      setLimpando(null);
    }
  };

  const exportarBackupCompleto = async () => {
    setLoading(true);
    toast.info('A preparar backup completo... Isto pode demorar alguns segundos.');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/completo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Criar ficheiro para download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_tvdefleet_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Backup completo exportado! ${data.metadados?.total_colecoes} coleções, ${data.metadados?.total_documentos} documentos`);
        carregarHistorico();
      } else {
        toast.error('Erro ao exportar backup');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setLoading(false);
    }
  };

  const exportarBackupParcial = async (categoria) => {
    setLoading(true);
    toast.info(`A exportar backup de ${categoria}...`);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/parcial/${categoria}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${categoria}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Backup de ${categoria} exportado!`);
      } else {
        toast.error('Erro ao exportar backup parcial');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      toast.info(`Ficheiro selecionado: ${file.name}`);
    }
  };

  const importarBackup = async (substituir = false) => {
    if (!importFile) {
      toast.error('Selecione um ficheiro de backup primeiro');
      return;
    }

    setLoading(true);
    toast.info('A importar backup... Isto pode demorar.');

    try {
      const fileContent = await importFile.text();
      const backupData = JSON.parse(fileContent);
      
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/backup/importar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          versao: backupData.versao,
          dados: backupData.dados,
          substituir_existente: substituir
        })
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(`Backup importado! ${result.total_documentos_importados} documentos em ${result.colecoes_importadas?.length} coleções`);
        carregarHistorico();
        carregarColecoes();
        setImportFile(null);
      } else {
        const error = await res.json();
        toast.error(`Erro: ${error.detail || 'Falha na importação'}`);
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar ficheiro de backup');
    } finally {
      setLoading(false);
    }
  };

  const categorias = [
    { id: 'utilizadores', nome: 'Utilizadores', icon: '👥', desc: 'Users, motoristas, parceiros, gestores' },
    { id: 'veiculos', nome: 'Veículos', icon: '🚗', desc: 'Veículos, cartões frota, histórico' },
    { id: 'contratos', nome: 'Contratos', icon: '📄', desc: 'Contratos e templates' },
    { id: 'rpa', nome: 'RPA', icon: '🤖', desc: 'Plataformas, designs, scripts, credenciais' },
    { id: 'financeiro', nome: 'Financeiro', icon: '💰', desc: 'Despesas, receitas, pagamentos' },
    { id: 'viaverde', nome: 'Via Verde', icon: '🛣️', desc: 'Portagens e movimentos' },
    { id: 'uber_bolt', nome: 'Uber/Bolt', icon: '📱', desc: 'Ganhos e viagens' },
    { id: 'relatorios', nome: 'Relatórios', icon: '📊', desc: 'Resumos semanais e histórico' },
    { id: 'configuracoes', nome: 'Configurações', icon: '⚙️', desc: 'Configs do sistema' },
    { id: 'tickets', nome: 'Tickets', icon: '🎫', desc: 'Tickets e mensagens' },
    { id: 'planos', nome: 'Planos', icon: '📋', desc: 'Planos e subscriçoes' }
  ];

  const content = (
    <div className="p-6 space-y-6" data-testid="backup-admin-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Backup & Restore</h1>
          <p className="text-gray-500">Exportar e importar dados do sistema</p>
        </div>
        <Button onClick={() => { carregarColecoes(); carregarHistorico(); }} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Backup Completo */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Backup Completo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Exporta <strong>TUDO</strong>: utilizadores, veículos, contratos, RPA, configurações, 
                planos, comissões, tickets, despesas, portagens, ganhos, relatórios e muito mais.
              </p>
              {colecoes && (
                <p className="text-xs text-gray-500 mt-1">
                  {colecoes.colecoes_com_dados} coleções com dados disponíveis
                </p>
              )}
            </div>
            <Button 
              onClick={exportarBackupCompleto} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="btn-backup-completo"
            >
              <Download className="w-4 h-4 mr-2" />
              {loading ? 'A exportar...' : 'Exportar Backup Completo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Parcial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Backup Parcial por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categorias.map((cat) => (
              <Button
                key={cat.id}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => exportarBackupParcial(cat.id)}
                disabled={loading}
                data-testid={`btn-backup-${cat.id}`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="font-medium">{cat.nome}</span>
                <span className="text-xs text-gray-500 text-center">{cat.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Importar Backup */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-600" />
            Importar Backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-green-100 file:text-green-700
                    hover:file:bg-green-200"
                  data-testid="input-import-file"
                />
                {importFile && (
                  <p className="text-sm text-green-600 mt-2">
                    Ficheiro: {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => importarBackup(false)}
                disabled={loading || !importFile}
                className="bg-green-600 hover:bg-green-700"
                data-testid="btn-importar-adicionar"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar (Adicionar)
              </Button>
              <Button
                onClick={() => importarBackup(true)}
                disabled={loading || !importFile}
                variant="destructive"
                data-testid="btn-importar-substituir"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                Importar (Substituir Existentes)
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              <strong>Adicionar:</strong> Mantém dados existentes e adiciona novos. 
              <strong> Substituir:</strong> Apaga dados existentes antes de importar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {colecoes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Estatísticas da Base de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{colecoes.total_colecoes}</div>
                <div className="text-xs text-gray-500">Total Coleções</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{colecoes.colecoes_com_dados}</div>
                <div className="text-xs text-gray-500">Com Dados</div>
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Coleção</th>
                    <th className="text-right p-2">Documentos</th>
                  </tr>
                </thead>
                <tbody>
                  {colecoes.colecoes?.filter(c => c.documentos > 0).map((c) => (
                    <tr key={c.nome} className="border-b">
                      <td className="p-2">{c.nome}</td>
                      <td className="p-2 text-right font-mono">{c.documentos.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historico.slice(0, 10).map((backup, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      backup.tipo === 'completo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {backup.tipo}
                    </span>
                    <span className="ml-2 text-sm">
                      {backup.total_colecoes} coleções, {backup.total_documentos?.toLocaleString()} docs
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(backup.exportado_em || backup.importado_em).toLocaleString('pt-PT')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <Layout user={user} onLogout={onLogout}>
      {content}
    </Layout>
  );
}
