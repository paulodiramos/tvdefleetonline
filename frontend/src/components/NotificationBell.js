import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';

const NotificationBell = ({ user }) => {
  const [stats, setStats] = useState({ total: 0, nao_lidas: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchStats();
      // Poll every 60 seconds
      const interval = setInterval(fetchStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notificacoes/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  };

  const handleClick = () => {
    navigate('/notificacoes');
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
      title="Notificações"
    >
      <Bell className="w-5 h-5 text-slate-600" />
      {stats.nao_lidas > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {stats.nao_lidas > 9 ? '9+' : stats.nao_lidas}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
