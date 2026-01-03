import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Mail, MessageSquare, AlertTriangle, Phone, Settings, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Comunicacoes = ({ user, onLogout }) => {
  const [contactConfig, setContactConfig] = useState({
    email_contacto: '',
    telefone_contacto: '',
    morada_empresa: '',
    nome_empresa: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContactConfig();
  }, []);

  const fetchContactConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/configuracoes/email`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setContactConfig({
          email_contacto: response.data.email_contacto || '',
          telefone_contacto: response.data.telefone_contacto || '',
          morada_empresa: response.data.morada_empresa || '',
          nome_empresa: response.data.nome_empresa || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContactConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/configuracoes/email`, contactConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configurações de contacto guardadas!');
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Comunicações</h1>
          <p className="text-slate-600 mt-1">Configure as comunicações e dados de contacto do sistema</p>
        </div>

        {/* Configurações de Contacto */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Dados de Contacto</CardTitle>
                <CardDescription>Configure os dados de contacto exibidos no website público</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Email de Contacto</Label>
                <Input
                  type="email"
                  value={contactConfig.email_contacto}
                  onChange={(e) => setContactConfig({ ...contactConfig, email_contacto: e.target.value })}
                  placeholder="info@empresa.com"
                />
              </div>
              <div>
                <Label>Telefone / WhatsApp</Label>
                <Input
                  type="text"
                  value={contactConfig.telefone_contacto}
                  onChange={(e) => setContactConfig({ ...contactConfig, telefone_contacto: e.target.value })}
                  placeholder="+351 912 345 678"
                />
              </div>
              <div>
                <Label>Nome da Empresa</Label>
                <Input
                  type="text"
                  value={contactConfig.nome_empresa}
                  onChange={(e) => setContactConfig({ ...contactConfig, nome_empresa: e.target.value })}
                  placeholder="TVDEFleet"
                />
              </div>
              <div>
                <Label>Morada</Label>
                <Input
                  type="text"
                  value={contactConfig.morada_empresa}
                  onChange={(e) => setContactConfig({ ...contactConfig, morada_empresa: e.target.value })}
                  placeholder="Lisboa, Portugal"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveContactConfig} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar Contactos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Notificações por Email</CardTitle>
              <CardDescription>Configure emails automáticos enviados pelo sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Mensagens WhatsApp</CardTitle>
              <CardDescription>Configure mensagens automáticas via WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Notificações Push</CardTitle>
              <CardDescription>Alertas em tempo real no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Alertas de Sistema</CardTitle>
              <CardDescription>Configure alertas de documentos, pagamentos, etc</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Em breve</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Comunicacoes;
