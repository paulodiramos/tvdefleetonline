import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { API } from '@/App';

const MudarSenhaObrigatorioModal = ({ open, user, onSuccess }) => {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/profile/change-password`,
        {
          current_password: senhaAtual,
          new_password: novaSenha
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <Lock className="w-6 h-6 text-red-600" />
            <span>Mudança de Senha Obrigatória</span>
          </DialogTitle>
          <DialogDescription>
            Por razões de segurança, você deve alterar sua senha provisória antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-sm text-yellow-800">
            <strong>⚠️ Atenção:</strong> Esta é sua primeira vez no sistema. Por favor, crie uma senha segura que apenas você conheça.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Senha Provisória Atual</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
                placeholder="Digite sua senha provisória"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Sua senha provisória são os últimos 9 dígitos do seu telefone
            </p>
          </div>

          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
            <p className="text-xs text-slate-500">
              Escolha uma senha forte e única
            </p>
          </div>

          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <Input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              placeholder="Digite a nova senha novamente"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded">
            <p className="text-xs text-blue-800">
              <strong>Dicas para uma senha segura:</strong>
              <br />
              • Mínimo 6 caracteres
              <br />
              • Use letras maiúsculas e minúsculas
              <br />
              • Inclua números e símbolos
              <br />
              • Não use informações pessoais óbvias
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Alterando...' : 'Alterar Senha e Continuar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MudarSenhaObrigatorioModal;
