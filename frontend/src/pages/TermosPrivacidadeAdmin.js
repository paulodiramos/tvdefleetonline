import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText, Shield, Save } from 'lucide-react';

const TermosPrivacidadeAdmin = ({ user, onLogout }) => {
  const [termos, setTermos] = useState('');
  const [privacidade, setPrivacidade] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConteudos();
  }, []);

  const fetchConteudos = async () => {
    try {
      const [termosRes, privacidadeRes] = await Promise.all([
        axios.get(`${API}/termos-conteudo`),
        axios.get(`${API}/privacidade-conteudo`)
      ]);
      
      setTermos(termosRes.data.conteudo || getDefaultTermos());
      setPrivacidade(privacidadeRes.data.conteudo || getDefaultPrivacidade());
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Erro ao carregar conteúdos');
      setTermos(getDefaultTermos());
      setPrivacidade(getDefaultPrivacidade());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await Promise.all([
        axios.put(
          `${API}/termos-conteudo`,
          { conteudo: termos },
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.put(
          `${API}/privacidade-conteudo`,
          { conteudo: privacidade },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);
      
      toast.success('Conteúdos atualizados com sucesso!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao guardar conteúdos');
    } finally {
      setSaving(false);
    }
  };

  const getDefaultTermos = () => `# Termos e Condições TVDEFleet

Ao utilizar a plataforma TVDEFleet, o utilizador concorda com os presentes Termos e Condições.

## 1. Aceitação dos Termos
Ao aceder e utilizar esta plataforma, o utilizador declara ter lido, compreendido e aceite os presentes termos e condições.

## 2. Serviços Oferecidos
A TVDEFleet oferece serviços de gestão de frotas TVDE, incluindo:
- Gestão de veículos e motoristas
- Acompanhamento de documentação
- Relatórios financeiros
- Sistema de contratos

## 3. Registo e Conta
Para utilizar determinadas funcionalidades da plataforma, é necessário criar uma conta.

## 4. Responsabilidades do Utilizador
O utilizador compromete-se a:
- Fornecer informações verdadeiras e atualizadas
- Manter a confidencialidade das suas credenciais
- Não partilhar acesso à conta

## 5. Propriedade Intelectual
Todo o conteúdo da plataforma é propriedade da TVDEFleet.

## 6. Modificações
A TVDEFleet reserva-se o direito de modificar estes termos a qualquer momento.`;

  const getDefaultPrivacidade = () => `# Política de Privacidade TVDEFleet

A TVDEFleet está comprometida com a proteção dos seus dados pessoais em conformidade com o RGPD.

## 1. Dados que Recolhemos
Recolhemos os seguintes dados pessoais:
- Nome completo
- Email
- Número de telefone
- NIF (Número de Identificação Fiscal)
- Morada
- Licença TVDE
- Carta de condução
- Documentos do veículo
- IBAN para pagamentos

## 2. Como Utilizamos os Seus Dados
Utilizamos os seus dados para:
- Processar o seu registo e autenticação
- Gerir a sua conta e subscrições
- Processar pagamentos
- Comunicar atualizações e notificações
- Cumprir obrigações legais

## 3. Partilha de Dados
Não partilhamos os seus dados com terceiros, exceto:
- Quando legalmente obrigatório
- Com o seu consentimento explícito
- Para processamento de pagamentos (entidades bancárias)

## 4. Segurança dos Dados
Implementamos medidas de segurança técnicas e organizacionais para proteger os seus dados.

## 5. Os Seus Direitos
De acordo com o RGPD, tem direito a:
- Aceder aos seus dados
- Retificar dados incorretos
- Solicitar a eliminação dos dados
- Opor-se ao tratamento
- Portabilidade dos dados

## 6. Contacto
Para questões sobre privacidade, contacte: privacidade@tvdefleet.com`;

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Termos e Privacidade</h1>
            <p className="text-slate-600 mt-1">Editar conteúdo legal da plataforma</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Alterações'}
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Termos e Condições */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <CardTitle>Termos e Condições</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Label htmlFor="termos" className="text-base font-medium mb-2 block">
                Conteúdo dos Termos e Condições
              </Label>
              <Textarea
                id="termos"
                value={termos}
                onChange={(e) => setTermos(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Introduza os termos e condições..."
              />
              <p className="text-xs text-slate-500 mt-2">
                Suporte para Markdown. Este conteúdo será exibido na página de Termos e Condições.
              </p>
            </CardContent>
          </Card>

          {/* Política de Privacidade */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-green-600" />
                <CardTitle>Política de Privacidade</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Label htmlFor="privacidade" className="text-base font-medium mb-2 block">
                Conteúdo da Política de Privacidade
              </Label>
              <Textarea
                id="privacidade"
                value={privacidade}
                onChange={(e) => setPrivacidade(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Introduza a política de privacidade..."
              />
              <p className="text-xs text-slate-500 mt-2">
                Suporte para Markdown. Este conteúdo será exibido na página de Política de Privacidade.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Botão de Guardar no final */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-slate-800 hover:bg-slate-700"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Todas as Alterações'}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default TermosPrivacidadeAdmin;
