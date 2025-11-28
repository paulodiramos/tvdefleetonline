import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Filter } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onClear, options = {} }) => {
  const renderFilterField = (filterKey, filterConfig) => {
    const { type, label, placeholder, items } = filterConfig;

    switch (type) {
      case 'select':
        return (
          <div key={filterKey} className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-1">{label}</Label>
            <Select
              value={filters[filterKey] || ''}
              onValueChange={(value) => onFilterChange(filterKey, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder || `Selecionar ${label}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {items && items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'text':
        return (
          <div key={filterKey} className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-1">{label}</Label>
            <Input
              type="text"
              placeholder={placeholder || label}
              value={filters[filterKey] || ''}
              onChange={(e) => onFilterChange(filterKey, e.target.value)}
            />
          </div>
        );

      case 'date':
        return (
          <div key={filterKey} className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-1">{label}</Label>
            <Input
              type="date"
              value={filters[filterKey] || ''}
              onChange={(e) => onFilterChange(filterKey, e.target.value)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const hasActiveFilters = Object.values(filters).some(value => value && value !== '');

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-slate-600 hover:text-slate-900"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4">
        {Object.entries(options).map(([key, config]) => renderFilterField(key, config))}
      </div>
    </div>
  );
};

export default FilterBar;
