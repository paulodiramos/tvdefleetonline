import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MultibancoPayment = ({ amount, orderId, userId, description, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState(null);
  const [copied, setCopied] = useState({ entity: false, reference: false });

  const generateReference = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/ifthenpay/generate-reference`,
        {
          amount: amount,
          order_id: orderId,
          user_id: userId,
          description: description
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setReference(response.data);
      toast.success('Referência Multibanco gerada com sucesso!');
    } catch (error) {
      console.error('Error generating reference:', error);
      if (error.response?.status === 503) {
        toast.error('Serviço IFThenPay temporariamente indisponível');
      } else {
        toast.error('Erro ao gerar referência Multibanco');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [field]: true });
    toast.success('Copiado!');
    setTimeout(() => {
      setCopied({ ...copied, [field]: false });
    }, 2000);
  };

  if (reference) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6" />
            <span>Referência Multibanco</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Entity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Entidade</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 p-4 bg-slate-100 rounded-lg font-mono text-2xl font-bold text-center">
                {reference.entity}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(reference.entity, 'entity')}
              >
                {copied.entity ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Referência</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 p-4 bg-slate-100 rounded-lg font-mono text-2xl font-bold text-center">
                {reference.reference.match(/.{1,3}/g).join(' ')}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(reference.reference, 'reference')}
              >
                {copied.reference ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Valor</label>
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-3xl font-bold text-green-700 text-center">
                €{reference.amount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {reference.instructions}
            </p>
          </div>

          {/* Additional Info */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>• O pagamento pode demorar até 24h a ser processado</p>
            <p>• Após confirmação, receberá um email de confirmação</p>
            {reference.expires_at && (
              <p>• Esta referência expira em: {new Date(reference.expires_at).toLocaleDateString()}</p>
            )}
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReference(null);
                if (onSuccess) onSuccess(reference);
              }}
            >
              Fechar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => window.print()}
            >
              Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="w-6 h-6" />
          <span>Pagamento via Multibanco</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Gere uma referência Multibanco para efetuar o pagamento de:
          </p>
          <p className="text-3xl font-bold text-center text-green-600">
            €{amount.toFixed(2)}
          </p>
          {description && (
            <p className="text-sm text-slate-500 text-center">
              {description}
            </p>
          )}
        </div>

        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={generateReference}
          disabled={loading}
        >
          {loading ? 'A gerar referência...' : 'Gerar Referência Multibanco'}
        </Button>

        <div className="text-xs text-slate-500 space-y-1">
          <p>✓ Seguro e fácil de usar</p>
          <p>✓ Pague em qualquer terminal Multibanco</p>
          <p>✓ Também pode pagar via homebanking</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultibancoPayment;
