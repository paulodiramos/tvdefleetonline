import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const Termos = () => {
  const navigate = useNavigate();
  const [conteudo, setConteudo] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchConteudo();
    checkAdmin();
  }, []);

  const checkAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setIsAdmin(user.role === 'admin');
  };

  const fetchConteudo = async () => {
    try {
      const response = await axios.get(`${API}/termos-conteudo`);
      setConteudo(response.data.conteudo || getDefaultContent());
    } catch (error) {
      console.error('Error fetching termos:', error);
      setConteudo(getDefaultContent());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/termos-conteudo`,
        { conteudo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Termos atualizados com sucesso!');
      setEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar termos');
    }
  };

  const getDefaultContent = () => `# Termos e Condições TVDEFleet

Ao utilizar a plataforma TVDEFleet, o utilizador concorda com os presentes Termos e Condições. 

## 1. Aceitação dos Termos
Ao aceder e utilizar esta plataforma...

## 2. Serviços Oferecidos
A TVDEFleet oferece serviços de gestão...

## 3. Registo e Conta
Para utilizar determinadas funcionalidades...`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button onClick={() => setEditing(false)} variant="outline">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)} variant="outline">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          )}
        </div>
          <h1 className="text-3xl font-bold text-slate-900">Termos e Condições</h1>
          <p className="text-slate-600 mt-2">Última atualização: {new Date().toLocaleDateString('pt-PT')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Aceitação dos Termos</h2>
            <p className="text-slate-700 leading-relaxed">
              Ao aceder e utilizar a plataforma TVDEFleet, o utilizador concorda com os presentes Termos e Condições. 
              Se não concordar com qualquer parte destes termos, não deve utilizar os nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Descrição do Serviço</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              A TVDEFleet é uma plataforma de gestão para motoristas e empresas TVDE em Portugal. Oferecemos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Gestão de frotas de veículos</li>
              <li>Acompanhamento de motoristas</li>
              <li>Contratos digitais</li>
              <li>Relatórios financeiros</li>
              <li>Sistema de manutenção preventiva</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Registo e Conta</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Para utilizar a plataforma, é necessário criar uma conta. O utilizador compromete-se a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Fornecer informações verdadeiras e atualizadas</li>
              <li>Manter a confidencialidade das credenciais de acesso</li>
              <li>Notificar imediatamente qualquer uso não autorizado da conta</li>
              <li>Ser responsável por todas as atividades realizadas na sua conta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Planos e Pagamentos</h2>
            <p className="text-slate-700 leading-relaxed">
              A plataforma oferece diferentes planos de subscrição. Os pagamentos são processados de forma segura 
              através de gateways de pagamento certificados. As faturas são emitidas mensalmente e o não pagamento 
              pode resultar na suspensão do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Propriedade Intelectual</h2>
            <p className="text-slate-700 leading-relaxed">
              Todos os direitos de propriedade intelectual sobre a plataforma, incluindo software, design, conteúdo 
              e marca, pertencem à TVDEFleet. É proibida a reprodução, distribuição ou modificação sem autorização prévia.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Responsabilidades do Utilizador</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              O utilizador compromete-se a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Utilizar a plataforma apenas para fins legais</li>
              <li>Não realizar atividades fraudulentas ou prejudiciais</li>
              <li>Não tentar aceder a áreas restritas sem autorização</li>
              <li>Manter documentação necessária atualizada (licenças, seguros, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Limitação de Responsabilidade</h2>
            <p className="text-slate-700 leading-relaxed">
              A TVDEFleet esforça-se para manter a plataforma disponível, mas não garante operação ininterrupta. 
              Não nos responsabilizamos por danos diretos, indiretos, incidentais ou consequenciais resultantes 
              do uso da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Rescisão</h2>
            <p className="text-slate-700 leading-relaxed">
              Ambas as partes podem rescindir o contrato a qualquer momento. A TVDEFleet reserva-se o direito de 
              suspender ou encerrar contas que violem estes termos, sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Alterações aos Termos</h2>
            <p className="text-slate-700 leading-relaxed">
              Reservamo-nos o direito de modificar estes Termos e Condições a qualquer momento. Os utilizadores 
              serão notificados de alterações significativas através do email registado na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Lei Aplicável</h2>
            <p className="text-slate-700 leading-relaxed">
              Estes Termos e Condições são regidos pela lei portuguesa. Quaisquer disputas serão resolvidas nos 
              tribunais competentes de Portugal.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Contacto</h2>
            <p className="text-slate-700 leading-relaxed">
              Para questões relacionadas com estes termos, contacte-nos através de:
            </p>
            <ul className="space-y-2 text-slate-700 mt-4">
              <li><strong>Email:</strong> legal@tvdefleet.pt</li>
              <li><strong>Morada:</strong> Lisboa, Portugal</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Termos;
