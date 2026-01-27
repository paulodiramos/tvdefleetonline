import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Plus,
  Trash2,
  Edit,
  Users,
  Star,
  Calendar,
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';

const DIAS_SEMANA = [
  { id: 0, nome: 'Segunda', abrev: 'Seg' },
  { id: 1, nome: 'Terça', abrev: 'Ter' },
  { id: 2, nome: 'Quarta', abrev: 'Qua' },
  { id: 3, nome: 'Quinta', abrev: 'Qui' },
  { id: 4, nome: 'Sexta', abrev: 'Sex' },
  { id: 5, nome: 'Sábado', abrev: 'Sáb' },
  { id: 6, nome: 'Domingo', abrev: 'Dom' },
];

const VeiculoTurnos = ({ veiculoId, user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [motoristaPrincipal, setMotoristaPrincipal] = useState(null);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTurno, setEditingTurno] = useState(null);
  
  const [turnoForm, setTurnoForm] = useState({
    motorista_id: '',
    hora_inicio: '08:00',
    hora_fim: '18:00',
    dias_semana: [0, 1, 2, 3, 4],
    notas: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [turnosRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/comissoes/turnos/veiculo/${veiculoId}`, { headers }),
        axios.get(`${API}/motoristas`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setTurnos(turnosRes.data.turnos || []);
      setMotoristaPrincipal(turnosRes.data.motorista_principal_id);
      setMotoristasDisponiveis(
        Array.isArray(motoristasRes.data) 
          ? motoristasRes.data 
          : motoristasRes.data?.motoristas || []
      );
    } catch (error) {
      console.error('Erro ao carregar turnos:', error);
      toast.error('Erro ao carregar turnos');
    } finally {
      setLoading(false);
    }
  }, [veiculoId]);

  useEffect(() => {
    if (veiculoId) {
      fetchData();
    }
  }, [veiculoId, fetchData]);

  const handleOpenModal = (turno = null) => {
    if (turno) {
      setEditingTurno(turno);
      setTurnoForm({
        motorista_id: turno.motorista_id,
        hora_inicio: turno.hora_inicio,
        hora_fim: turno.hora_fim,
        dias_semana: turno.dias_semana || [0, 1, 2, 3, 4, 5, 6],
        notas: turno.notas || ''
      });
    } else {
      setEditingTurno(null);
      setTurnoForm({
        motorista_id: '',
        hora_inicio: '08:00',
        hora_fim: '18:00',
        dias_semana: [0, 1, 2, 3, 4],
        notas: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTurno(null);
  };

  const handleSaveTurno = async () => {
    if (!turnoForm.motorista_id) {
      toast.error('Selecione um motorista');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (editingTurno) {
        await axios.put(
          `${API}/comissoes/turnos/veiculo/${veiculoId}/turno/${editingTurno.id}`,
          {
            hora_inicio: turnoForm.hora_inicio,
            hora_fim: turnoForm.hora_fim,
            dias_semana: turnoForm.dias_semana,
            notas: turnoForm.notas
          },
          { headers }
        );
        toast.success('Turno atualizado');
      } else {
        await axios.post(
          `${API}/comissoes/turnos/veiculo/${veiculoId}`,
          turnoForm,
          { headers }
        );
        toast.success('Turno adicionado');
      }
      
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Erro ao guardar turno:', error);
      toast.error('Erro ao guardar turno');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTurno = async (turnoId) => {
    if (!window.confirm('Tem certeza que deseja remover este turno?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/comissoes/turnos/veiculo/${veiculoId}/turno/${turnoId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Turno removido');
      fetchData();
    } catch (error) {
      toast.error('Erro ao remover turno');
    }
  };

  const handleDefinirPrincipal = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/comissoes/turnos/veiculo/${veiculoId}/principal`,
        { motorista_id: motoristaId },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success('Motorista principal definido');
      setMotoristaPrincipal(motoristaId);
    } catch (error) {
      toast.error('Erro ao definir motorista principal');
    }
  };

  const toggleDiaSemana = (dia) => {
    setTurnoForm(prev => {
      const dias = prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort((a, b) => a - b);
      return { ...prev, dias_semana: dias };
    });
  };

  const getMotoristaNome = (motoristaId) => {
    const motorista = motoristasDisponiveis.find(m => m.id === motoristaId);
    return motorista?.nome || motorista?.name || 'Desconhecido';
  };

  const formatDiasSemana = (dias) => {
    if (!dias || dias.length === 0) return 'Nenhum';
    if (dias.length === 7) return 'Todos os dias';
    if (dias.length === 5 && !dias.includes(5) && !dias.includes(6)) return 'Dias úteis';
    if (dias.length === 2 && dias.includes(5) && dias.includes(6)) return 'Fim de semana';
    return dias.map(d => DIAS_SEMANA[d]?.abrev).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="veiculo-turnos">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Gestão de Turnos
          </h3>
          <p className="text-sm text-slate-500">
            Configure os motoristas e horários deste veículo
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} data-testid="btn-adicionar-turno">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Turno
        </Button>
      </div>

      {/* Motorista Principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Motorista Principal
          </CardTitle>
          <CardDescription>
            O motorista principal é o responsável padrão deste veículo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={motoristaPrincipal || ''}
            onValueChange={handleDefinirPrincipal}
          >
            <SelectTrigger className="w-full md:w-80" data-testid="select-motorista-principal">
              <SelectValue placeholder="Selecionar motorista principal" />
            </SelectTrigger>
            <SelectContent>
              {motoristasDisponiveis.map((motorista) => (
                <SelectItem key={motorista.id} value={motorista.id}>
                  {motorista.nome || motorista.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista de Turnos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            Turnos Configurados
          </CardTitle>
          <CardDescription>
            {turnos.length === 0 
              ? 'Nenhum turno configurado' 
              : `${turnos.length} turno(s) configurado(s)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {turnos.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum turno configurado</p>
              <p className="text-sm">Clique em "Adicionar Turno" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnos.map((turno) => (
                  <TableRow key={turno.id} data-testid={`turno-${turno.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getMotoristaNome(turno.motorista_id)}
                        </span>
                        {turno.motorista_id === motoristaPrincipal && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Principal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {turno.hora_inicio} - {turno.hora_fim}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {formatDiasSemana(turno.dias_semana)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {turno.ativo !== false ? (
                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-slate-500 text-sm">
                      {turno.notas || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(turno)}
                          data-testid={`btn-editar-turno-${turno.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveTurno(turno.id)}
                          data-testid={`btn-remover-turno-${turno.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumo Visual dos Turnos */}
      {turnos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Cobertura Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {DIAS_SEMANA.map((dia) => {
                const turnosDia = turnos.filter(t => t.dias_semana?.includes(dia.id) && t.ativo !== false);
                return (
                  <div 
                    key={dia.id} 
                    className={`p-3 rounded-lg border text-center ${
                      turnosDia.length > 0 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-medium text-sm">{dia.abrev}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {turnosDia.length > 0 ? (
                        turnosDia.map((t, i) => (
                          <div key={i}>{t.hora_inicio}-{t.hora_fim}</div>
                        ))
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Adicionar/Editar Turno */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTurno ? 'Editar Turno' : 'Adicionar Turno'}
            </DialogTitle>
            <DialogDescription>
              Configure o horário e dias de trabalho do motorista
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Motorista */}
            <div className="space-y-2">
              <Label>Motorista *</Label>
              <Select
                value={turnoForm.motorista_id}
                onValueChange={(v) => setTurnoForm(prev => ({ ...prev, motorista_id: v }))}
                disabled={!!editingTurno}
              >
                <SelectTrigger data-testid="select-motorista-turno">
                  <SelectValue placeholder="Selecionar motorista" />
                </SelectTrigger>
                <SelectContent>
                  {motoristasDisponiveis.map((motorista) => (
                    <SelectItem key={motorista.id} value={motorista.id}>
                      {motorista.nome || motorista.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Horário */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora de Início</Label>
                <Input
                  type="time"
                  value={turnoForm.hora_inicio}
                  onChange={(e) => setTurnoForm(prev => ({ ...prev, hora_inicio: e.target.value }))}
                  data-testid="input-hora-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label>Hora de Fim</Label>
                <Input
                  type="time"
                  value={turnoForm.hora_fim}
                  onChange={(e) => setTurnoForm(prev => ({ ...prev, hora_fim: e.target.value }))}
                  data-testid="input-hora-fim"
                />
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.id}
                    type="button"
                    onClick={() => toggleDiaSemana(dia.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      turnoForm.dias_semana.includes(dia.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    data-testid={`btn-dia-${dia.id}`}
                  >
                    {dia.abrev}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTurnoForm(prev => ({ ...prev, dias_semana: [0, 1, 2, 3, 4] }))}
                >
                  Dias úteis
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTurnoForm(prev => ({ ...prev, dias_semana: [5, 6] }))}
                >
                  Fim de semana
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTurnoForm(prev => ({ ...prev, dias_semana: [0, 1, 2, 3, 4, 5, 6] }))}
                >
                  Todos
                </Button>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                value={turnoForm.notas}
                onChange={(e) => setTurnoForm(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Ex: Turno da manhã, substituto..."
                data-testid="input-notas-turno"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTurno} disabled={saving} data-testid="btn-guardar-turno">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VeiculoTurnos;
