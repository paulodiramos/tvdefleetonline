import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Privacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Política de Privacidade</h1>
          <p className="text-slate-600 mt-2">Última atualização: {new Date().toLocaleDateString('pt-PT')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Alert className="mb-8 bg-blue-50 border-blue-200">
          <Shield className="h-5 w-5 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Compromisso com a Privacidade:</strong> A TVDEFleet está comprometida com a proteção dos seus dados pessoais 
            em conformidade com o Regulamento Geral de Proteção de Dados (RGPD).
          </AlertDescription>
        </Alert>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-semibold text-slate-900">1. Dados que Recolhemos</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              Recolhemos as seguintes categorias de dados pessoais:
            </p>
            <div className="space-y-3 ml-4">
              <div>
                <h3 className="font-semibold text-slate-800">Dados de Registo:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>Nome completo</li>
                  <li>Email</li>
                  <li>Número de telefone</li>
                  <li>NIF (Número de Identificação Fiscal)</li>
                  <li>Morada</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Dados TVDE:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>Licença TVDE</li>
                  <li>Carta de condução</li>
                  <li>Certificado de registo criminal</li>
                  <li>Documentos do veículo</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Dados Financeiros:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>IBAN para pagamentos</li>
                  <li>Histórico de transações</li>
                  <li>Faturas emitidas</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center space-x-3 mb-4">
              <Eye className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-semibold text-slate-900">2. Como Utilizamos os Seus Dados</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              Os seus dados pessoais são utilizados para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Gestão e manutenção da sua conta na plataforma</li>
              <li>Processamento de pagamentos e emissão de faturas</li>
              <li>Comunicação sobre o serviço e suporte técnico</li>
              <li>Cumprimento de obrigações legais e fiscais</li>
              <li>Melhoria dos nossos serviços</li>
              <li>Prevenção de fraudes e segurança da plataforma</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center space-x-3 mb-4">
              <Lock className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-semibold text-slate-900">3. Segurança dos Dados</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              Implementamos medidas de segurança técnicas e organizacionais para proteger os seus dados:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li><strong>Encriptação:</strong> Todos os dados são encriptados em trânsito (SSL/TLS) e em repouso</li>
              <li><strong>Autenticação:</strong> Sistema de autenticação seguro com tokens JWT</li>
              <li><strong>Acesso Restrito:</strong> Apenas colaboradores autorizados têm acesso aos dados</li>
              <li><strong>Backups:</strong> Backups regulares para prevenir perda de dados</li>
              <li><strong>Monitorização:</strong> Monitorização contínua para detetar acessos não autorizados</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center space-x-3 mb-4">
              <UserCheck className="w-6 h-6 text-orange-600" />
              <h2 className="text-2xl font-semibold text-slate-900">4. Partilha de Dados</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              Os seus dados pessoais podem ser partilhados com:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li><strong>Parceiros TVDE:</strong> Quando associado a uma empresa parceira</li>
              <li><strong>Fornecedores de Serviços:</strong> Processadores de pagamento, serviços de cloud</li>
              <li><strong>Autoridades:</strong> Quando legalmente obrigatório (IMT, AT, etc.)</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              <strong>Nota:</strong> Nunca vendemos os seus dados pessoais a terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Os Seus Direitos (RGPD)</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              De acordo com o RGPD, tem os seguintes direitos:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito de Acesso</h3>
                <p className="text-sm text-slate-600">Solicitar cópia dos seus dados pessoais</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito de Retificação</h3>
                <p className="text-sm text-slate-600">Corrigir dados incorretos ou incompletos</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito ao Apagamento</h3>
                <p className="text-sm text-slate-600">Solicitar eliminação dos seus dados</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito à Portabilidade</h3>
                <p className="text-sm text-slate-600">Receber dados em formato estruturado</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito de Oposição</h3>
                <p className="text-sm text-slate-600">Opor-se ao processamento dos dados</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Direito de Limitação</h3>
                <p className="text-sm text-slate-600">Limitar o processamento em certas situações</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Cookies e Tecnologias Similares</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Utilizamos cookies para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>Manter a sua sessão ativa</li>
              <li>Melhorar a experiência do utilizador</li>
              <li>Análise de tráfego e comportamento (cookies analíticos)</li>
            </ul>
            <p className="text-slate-700 leading-relaxed mt-4">
              Pode configurar o seu browser para recusar cookies, mas isso pode afetar a funcionalidade da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Retenção de Dados</h2>
            <p className="text-slate-700 leading-relaxed">
              Mantemos os seus dados pelo período necessário para cumprir as finalidades descritas nesta política, 
              ou conforme exigido por lei. Após o encerramento da conta, os dados são eliminados no prazo de 90 dias, 
              exceto se houver obrigação legal de retenção (por exemplo, dados fiscais mantidos por 10 anos).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Transferências Internacionais</h2>
            <p className="text-slate-700 leading-relaxed">
              Os seus dados são armazenados em servidores localizados na União Europeia. Caso seja necessária 
              transferência para fora da UE, garantimos que existem salvaguardas adequadas em conformidade com o RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Menores de Idade</h2>
            <p className="text-slate-700 leading-relaxed">
              A plataforma não é destinada a menores de 18 anos. Não recolhemos intencionalmente dados de menores. 
              Se tomar conhecimento de que um menor forneceu dados, contacte-nos para procedermos à eliminação.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Alterações à Política</h2>
            <p className="text-slate-700 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos os utilizadores sobre 
              alterações significativas através de email ou aviso na plataforma.
            </p>
          </section>

          <section className="border-t pt-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Exercício dos Seus Direitos</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Para exercer qualquer dos seus direitos ou fazer perguntas sobre esta política, contacte o nosso 
              Encarregado de Proteção de Dados:
            </p>
            <div className="bg-slate-50 rounded-lg p-6">
              <ul className="space-y-2 text-slate-700">
                <li><strong>Email:</strong> dpo@tvdefleet.pt</li>
                <li><strong>Email alternativo:</strong> privacy@tvdefleet.pt</li>
                <li><strong>Morada:</strong> TVDEFleet, Lisboa, Portugal</li>
              </ul>
              <p className="text-sm text-slate-600 mt-4">
                Também pode apresentar uma reclamação à Comissão Nacional de Proteção de Dados (CNPD) em 
                <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  www.cnpd.pt
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacidade;
