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

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Termos e Condições</h1>
          
          {editing ? (
            <div className="space-y-4">
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                className="min-h-[600px] font-mono text-sm"
                placeholder="Digite o conteúdo dos termos e condições..."
              />
            </div>
          ) : (
            <div className="prose max-w-none">
              <div 
                className="whitespace-pre-wrap text-slate-700 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: conteudo.replace(/\n/g, '<br>').replace(/## (.*)/g, '<h2 class="text-xl font-semibold text-slate-900 mt-6 mb-3">$1</h2>').replace(/# (.*)/g, '<h1 class="text-2xl font-bold text-slate-900 mb-4">$1</h1>')
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Termos;
