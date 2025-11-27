import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { toast } from 'sonner';
import MotoristaPlanos from '@/components/MotoristaPlanos';

const MotoristaPlanosPagina = ({ user, onLogout }) => {
  const [motoristaData, setMotoristaData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMotoristaData();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristaData(response.data);
    } catch (error) {
      console.error('Error fetching motorista data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    fetchMotoristaData();
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">A carregar planos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6">
        <MotoristaPlanos 
          motoristaData={motoristaData}
          onUpdate={handleUpdate}
        />
      </div>
    </Layout>
  );
};

export default MotoristaPlanosPagina;
