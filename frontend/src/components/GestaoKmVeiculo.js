import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Gauge, Plus, History, TrendingUp, AlertTriangle, 
  Check, Clock, Wrench, Car, Loader2, RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const FONTES_KM = [
  { value: 'manual', label: 'Manual', icon: '✏️' },
  { value: 'gps', label: 'GPS/Tracking', icon: '📍' },
  { value: 'inspecao', label: 'Inspeção', icon: '🔍' },
  { value: 'revisao', label: 'Revisão', icon: '🔧' },
  { value: 'manutencao', label: 'Manutenção', icon: '⚙️' },
  { value: 'vistoria', label: 'Vistoria', icon: '📋' }
];

export default function GestaoKmVeiculo({ veiculoId, veiculo, onUpdate, canEdit = false }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    km_atual: '',
    fonte: 'manual',
    notas: ''
  });

  const [kmInicial, setKmInicial] = useState(veiculo?.km_inicial || 0);
  const [editandoKmInicial, setEditandoKmInicial] = useState(false);

  const fetchHistorico = useCallback(async () => {
    if (!veiculoId) return;
    
    setHistoricoLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles/${veiculoId}/historico-km`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico de KM:', error);
    } finally {
      setHistoricoLoading(false);
    }
  }, [veiculoId]);

  useEffect(() => {
    if (showHistorico) {
      fetchHistorico();
    }
  }, [showHistorico, fetchHistorico]);

  const handleAtualizarKm = async () => {
    if (!formData.km_atual || isNaN(formData.km_atual)) {
      toast.error('Introduza um valor de KM válido');
      return;
    }

    const novoKm = parseFloat(formData.km_atual);
    if (novoKm < (veiculo?.km_atual || 0)) {
      const confirmacao = window.confirm(
        `O novo KM (${novoKm}) é menor que o atual (${veiculo?.km_atual || 0}). Tem a certeza?`
      );
      if (!confirmacao) return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/vehicles/${veiculoId}/atualizar-km`,
        {
          km_atual: novoKm,
          fonte: formData.fonte,
          notas: formData.notas
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Quilometragem atualizada com sucesso');
      setShowModal(false);
      setFormData({ km_atual: '', fonte: 'manual', notas: '' });
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao atualizar KM:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atualizar quilometragem');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarKmInicial = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/vehicles/${veiculoId}`,
        { km_inicial: parseFloat(kmInicial) || 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('KM inicial atualizado');
      setEditandoKmInicial(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao salvar KM inicial:', error);
      toast.error('Erro ao salvar KM inicial');
    }
  };

  const kmPercorrido = (veiculo?.km_atual || 0) - (veiculo?.km_inicial || 0);

  return (
    <Card data-testid="gestao-km-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600" />
              Gestão de Quilometragem
            </CardTitle>
            <CardDescription>
              Controlo e histórico de quilómetros do veículo
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistorico(true)}
              data-testid="btn-ver-historico-km"
            >
              <History className="w-4 h-4 mr-2" />
              Histórico
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setShowModal(true)}
                data-testid="btn-atualizar-km"
              >
                <Plus className="w-4 h-4 mr-2" />
                Atualizar KM
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KM Inicial */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-slate-600 text-sm">KM Inicial</Label>
              {canEdit && !editandoKmInicial && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditandoKmInicial(true)}
                  className="h-6 px-2"
                >
                  ✏️
                </Button>
              )}
            </div>
            {editandoKmInicial ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={kmInicial}
                  onChange={(e) => setKmInicial(e.target.value)}
                  className="h-8"
                  data-testid="input-km-inicial"
                />
                <Button size="sm" className="h-8" onClick={handleSalvarKmInicial}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-2xl font-bold text-slate-700" data-testid="valor-km-inicial">
                {(veiculo?.km_inicial || 0).toLocaleString('pt-PT')} km
              </p>
            )}
          </div>

          {/* KM Atual */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <Label className="text-blue-600 text-sm">KM Atual</Label>
            <p className="text-2xl font-bold text-blue-700" data-testid="valor-km-atual">
              {(veiculo?.km_atual || 0).toLocaleString('pt-PT')} km
            </p>
            {veiculo?.km_atualizado_em && (
              <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(veiculo.km_atualizado_em).toLocaleDateString('pt-PT')}
              </p>
            )}
          </div>

          {/* KM Percorrido */}
          <div className="bg-green-50 p-4 rounded-lg">
            <Label className="text-green-600 text-sm">KM Percorrido</Label>
            <p className="text-2xl font-bold text-green-700" data-testid="valor-km-percorrido">
              {kmPercorrido.toLocaleString('pt-PT')} km
            </p>
            <p className="text-xs text-green-500 mt-1">Desde o KM inicial</p>
          </div>
        </div>

        {/* Alertas */}
        {veiculo?.proxima_revisao_km && veiculo?.km_atual >= (veiculo.proxima_revisao_km - 1000) && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-amber-700 text-sm">
              Próxima revisão aos <strong>{veiculo.proxima_revisao_km.toLocaleString('pt-PT')} km</strong> 
              {' '}(faltam {(veiculo.proxima_revisao_km - veiculo.km_atual).toLocaleString('pt-PT')} km)
            </span>
          </div>
        )}
      </CardContent>

      {/* Modal Atualizar KM */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[450px]" data-testid="modal-atualizar-km">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Atualizar Quilometragem
            </DialogTitle>
            <DialogDescription>
              Registe a quilometragem atual do veículo {veiculo?.matricula}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-slate-100 p-3 rounded-lg text-center">
              <p className="text-sm text-slate-500">KM Atual</p>
              <p className="text-xl font-bold">{(veiculo?.km_atual || 0).toLocaleString('pt-PT')} km</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="novo-km">Novo KM *</Label>
              <Input
                id="novo-km"
                type="number"
                value={formData.km_atual}
                onChange={(e) => setFormData({ ...formData, km_atual: e.target.value })}
                placeholder="Ex: 75000"
                data-testid="input-novo-km"
              />
            </div>

            <div className="space-y-2">
              <Label>Fonte da Atualização</Label>
              <Select
                value={formData.fonte}
                onValueChange={(value) => setFormData({ ...formData, fonte: value })}
              >
                <SelectTrigger data-testid="select-fonte-km">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTES_KM.map((fonte) => (
                    <SelectItem key={fonte.value} value={fonte.value}>
                      {fonte.icon} {fonte.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Ex: Atualizado durante a revisão dos 75.000 km"
                rows={2}
                data-testid="input-notas-km"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAtualizarKm} disabled={saving} data-testid="btn-confirmar-km">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Histórico de KM */}
      <Dialog open={showHistorico} onOpenChange={setShowHistorico}>
        <DialogContent className="sm:max-w-[600px]" data-testid="modal-historico-km">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Quilometragem
            </DialogTitle>
            <DialogDescription>
              Registo de todas as atualizações de KM do veículo
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Sem registos de histórico de quilometragem
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>KM Anterior</TableHead>
                      <TableHead>KM Novo</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((entry, index) => (
                      <TableRow key={entry.id || index}>
                        <TableCell className="text-sm">
                          {entry.data ? new Date(entry.data).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </TableCell>
                        <TableCell>
                          {(entry.km_anterior || 0).toLocaleString('pt-PT')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(entry.km_novo || 0).toLocaleString('pt-PT')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {FONTES_KM.find(f => f.value === entry.fonte)?.icon || '📝'}{' '}
                            {FONTES_KM.find(f => f.value === entry.fonte)?.label || entry.fonte}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {entry.atualizado_por_nome || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistorico(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
