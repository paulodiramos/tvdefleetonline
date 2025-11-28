import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Shield, ClipboardCheck, FileText, Calendar, AlertTriangle } from 'lucide-react';

const VehicleMaintenanceCard = ({ vehicle }) => {
  const checkExpiry = (dateString) => {
    if (!dateString) return { status: 'missing', days: null };
    
    const today = new Date();
    const expiryDate = new Date(dateString);
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays) };
    if (diffDays <= 7) return { status: 'urgent', days: diffDays };
    if (diffDays <= 30) return { status: 'warning', days: diffDays };
    return { status: 'ok', days: diffDays };
  };

  const getStatusBadge = (status, days) => {
    switch (status) {
      case 'expired':
        return <Badge variant="destructive" className="ml-2">Expirado há {days} dias</Badge>;
      case 'urgent':
        return <Badge variant="destructive" className="ml-2">{days} dias restantes</Badge>;
      case 'warning':
        return <Badge className="ml-2 bg-orange-100 text-orange-800">{days} dias</Badge>;
      case 'ok':
        return <Badge className="ml-2 bg-green-100 text-green-800">OK</Badge>;
      case 'missing':
        return <Badge variant="outline" className="ml-2">Não definido</Badge>;
      default:
        return null;
    }
  };

  const items = [
    {
      icon: Wrench,
      label: 'Próxima Revisão',
      date: vehicle.proxima_revisao,
      color: 'text-blue-600'
    },
    {
      icon: Shield,
      label: 'Renovação Seguro',
      date: vehicle.seguro_validade,
      color: 'text-purple-600'
    },
    {
      icon: ClipboardCheck,
      label: 'Próxima Inspeção',
      date: vehicle.inspecao_validade,
      color: 'text-green-600'
    },
    {
      icon: FileText,
      label: 'Validade Extintor',
      date: vehicle.extintor_validade,
      color: 'text-red-600'
    }
  ];

  // Add proxima_vistoria if it exists
  if (vehicle.proxima_vistoria) {
    items.push({
      icon: Calendar,
      label: 'Próxima Vistoria',
      date: vehicle.proxima_vistoria,
      datetime: vehicle.proxima_vistoria_hora,
      color: 'text-orange-600'
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <span>Manutenção e Revisões</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, index) => {
            const expiry = checkExpiry(item.date);
            const Icon = item.icon;
            
            return (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border">
                <Icon className={`w-5 h-5 ${item.color} flex-shrink-0 mt-1`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  {item.date ? (
                    <>
                      <p className="text-sm text-slate-600">
                        {new Date(item.date).toLocaleDateString('pt-PT')}
                        {item.datetime && ` às ${item.datetime}`}
                      </p>
                      {getStatusBadge(expiry.status, expiry.days)}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Não definido</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleMaintenanceCard;
