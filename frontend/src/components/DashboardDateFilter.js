import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

const DashboardDateFilter = ({ onFilterChange, defaultPeriod = 'todos' }) => {
  const [periodo, setPeriodo] = React.useState(defaultPeriod);
  const [dataInicio, setDataInicio] = React.useState('');
  const [dataFim, setDataFim] = React.useState('');
  const [numeroSemana, setNumeroSemana] = React.useState('');

  const calcularSemana = (weekNum) => {
    if (!weekNum || weekNum < 1 || weekNum > 53) return;
    
    const year = new Date().getFullYear();
    const firstDay = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7;
    const weekStart = new Date(firstDay.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const inicio = weekStart.toISOString().split('T')[0];
    const fim = weekEnd.toISOString().split('T')[0];
    
    setDataInicio(inicio);
    setDataFim(fim);
    onFilterChange({ tipo: 'personalizado', dataInicio: inicio, dataFim: fim });
  };

  const aplicarSemanaAtual = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const inicio = monday.toISOString().split('T')[0];
    const fim = sunday.toISOString().split('T')[0];
    
    setDataInicio(inicio);
    setDataFim(fim);
    setPeriodo('semana');
    onFilterChange({ tipo: 'semana', dataInicio: inicio, dataFim: fim });
  };

  const aplicarSemanaPassada = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    // Get current week's Monday, then subtract 7 days
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset - 7);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const inicio = monday.toISOString().split('T')[0];
    const fim = sunday.toISOString().split('T')[0];
    
    setDataInicio(inicio);
    setDataFim(fim);
    setPeriodo('semana_passada');
    onFilterChange({ tipo: 'semana_passada', dataInicio: inicio, dataFim: fim });
  };

  const handlePeriodoChange = (value) => {
    setPeriodo(value);
    
    const today = new Date();
    let inicio, fim;
    
    switch(value) {
      case 'hoje':
        inicio = fim = today.toISOString().split('T')[0];
        break;
      case 'semana':
        aplicarSemanaAtual();
        return;
      case 'semana_passada':
        aplicarSemanaPassada();
        return;
      case 'mes':
        inicio = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        fim = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'ano':
        inicio = `${today.getFullYear()}-01-01`;
        fim = `${today.getFullYear()}-12-31`;
        break;
      case 'todos':
        inicio = '';
        fim = '';
        break;
      default:
        return;
    }
    
    setDataInicio(inicio);
    setDataFim(fim);
    onFilterChange({ tipo: value, dataInicio: inicio, dataFim: fim });
  };

  const aplicarDatasCustomizadas = () => {
    if (dataInicio && dataFim) {
      onFilterChange({ tipo: 'personalizado', dataInicio, dataFim });
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 mb-6">
      <div className="flex items-center space-x-2 mb-3">
        <Calendar className="w-4 h-4 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Período de Análise</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Período rápido */}
        <div>
          <Label className="text-sm mb-1">Período Rápido</Label>
          <Select value={periodo} onValueChange={handlePeriodoChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Semana Atual</SelectItem>
              <SelectItem value="semana_passada">Semana Passada</SelectItem>
              <SelectItem value="mes">Mês Atual</SelectItem>
              <SelectItem value="ano">Ano Atual</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Número da semana */}
        <div>
          <Label className="text-sm mb-1">Ou Semana Nº</Label>
          <Input
            type="number"
            min="1"
            max="53"
            placeholder="1-53"
            value={numeroSemana}
            onChange={(e) => {
              setNumeroSemana(e.target.value);
              if (e.target.value) {
                calcularSemana(parseInt(e.target.value));
                setPeriodo('personalizado');
              }
            }}
          />
        </div>

        {/* Data início */}
        <div>
          <Label className="text-sm mb-1">Data Início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(e.target.value);
              setPeriodo('personalizado');
            }}
          />
        </div>

        {/* Data fim */}
        <div>
          <Label className="text-sm mb-1">Data Fim</Label>
          <div className="flex space-x-2">
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodo('personalizado');
              }}
            />
            {periodo === 'personalizado' && dataInicio && dataFim && (
              <Button size="sm" onClick={aplicarDatasCustomizadas}>
                Aplicar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardDateFilter;
