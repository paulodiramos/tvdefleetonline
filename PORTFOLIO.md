# 🚗 TVDEFleet - Sistema de Gestão de Frotas TVDE

## Visão Geral

O **TVDEFleet** é uma plataforma completa de gestão de frotas para empresas de transporte TVDE (Uber, Bolt, etc.). O sistema oferece funcionalidades avançadas para **Administradores**, **Parceiros/Gestores de Frota** e **Motoristas**, cada um com acesso personalizado às funcionalidades relevantes.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **UI Components** | Shadcn/UI + Radix UI |
| **Backend** | FastAPI (Python) |
| **Base de Dados** | MongoDB |
| **Autenticação** | JWT + bcrypt |
| **Automação RPA** | Playwright |
| **Armazenamento** | Terabox Integration |
| **Comunicação** | WhatsApp Web.js |

---

## 👤 Perfis de Utilizador

### 🔴 Administrador (Admin)
Acesso total ao sistema com capacidade de gerir todos os parceiros, utilizadores e configurações.

### 🟡 Parceiro / Gestor de Frota
Gere a sua própria frota de motoristas e veículos, com acesso a funcionalidades financeiras e operacionais.

### 🟢 Motorista
Acesso ao portal de motorista para gerir documentos, visualizar ganhos e comunicar com o parceiro.

---

## 📋 Funcionalidades por Perfil

---

## 🔴 ADMINISTRADOR

### Dashboard Principal
- **Estatísticas globais** de toda a plataforma
- Número total de parceiros, motoristas e veículos
- Gráficos de evolução de ganhos e despesas
- Alertas e notificações prioritárias
- **Próximos eventos** (renovações, vistorias, etc.)

### Gestão de Parceiros
| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de Parceiros | Visualizar todos os parceiros registados |
| Criar Parceiro | Adicionar novo parceiro à plataforma |
| Editar Parceiro | Modificar dados e configurações |
| Planos & Módulos | Atribuir planos e módulos a parceiros |
| Estatísticas | Ver métricas por parceiro |

### Gestão de Utilizadores
| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de Utilizadores | Todos os users (admin, parceiros, motoristas) |
| Filtros Avançados | Por perfil, parceiro, data de registo |
| Ações Admin | Bloquear, revogar acesso, alterar password |
| Validação Documentos | Validar/rejeitar documentos de motoristas |
| Estatísticas | Utilizadores ativos, bloqueados, pendentes |

### Gestão de Planos
| Funcionalidade | Descrição |
|----------------|-----------|
| Planos de Parceiros | Definir planos com limites e funcionalidades |
| Planos de Motoristas | Configurar planos para motoristas |
| Módulos | Ativar/desativar módulos por parceiro |
| Preços | Definir preçário de cada plano |

### Sistema RPA (Automação)

#### 📝 RPA Designer (Exclusivo Admin)
| Funcionalidade | Descrição |
|----------------|-----------|
| Upload de Scripts | Carregar scripts Playwright gravados localmente |
| Configurar Campos | Definir campos de credenciais para parceiros |
| Gestão de Plataformas | Criar automações para qualquer plataforma |
| Template de Script | Modelo base para criar novos scripts |
| Versionamento | Histórico de versões dos scripts |

#### 🔄 RPA Automático
| Funcionalidade | Descrição |
|----------------|-----------|
| Plataformas Suportadas | Uber, Bolt, Via Verde, Prio, + customizadas |
| Configurar Credenciais | Guardar credenciais encriptadas |
| Executar Automações | Extrair dados automaticamente |
| Agendar Execuções | Programar execuções periódicas |
| Logs & Screenshots | Depuração detalhada de execuções |

#### 📤 RPA Simplificado (CSV)
| Funcionalidade | Descrição |
|----------------|-----------|
| Upload de CSV | Importar ficheiros de fornecedores |
| Fornecedores | Prio, Verizon, Cartrack, etc. |
| Exportar Relatórios | Gerar relatórios semanais em CSV |

### Configurações Globais
| Página | Descrição |
|--------|-----------|
| Fornecedores | Gerir fornecedores de serviços |
| Categorias Uber/Bolt | Configurar categorias de viagens |
| Cartões de Frota | Gerir cartões de combustível |
| Integrações | APIs e serviços externos |
| Comunicações | Configurar WhatsApp, SMS, Email |
| Mapeamento CSV | Configurar importação de ficheiros |
| Termos & Privacidade | Editar páginas legais |

### Armazenamento & Integrações
| Integração | Descrição |
|------------|-----------|
| Terabox | Armazenamento na cloud para documentos |
| WhatsApp | Envio de mensagens e notificações |

---

## 🟡 PARCEIRO / GESTOR DE FROTA

### Dashboard
- **Estatísticas da frota** (motoristas ativos, veículos)
- Resumo financeiro semanal
- Alertas de documentos a expirar
- Próximos eventos e vencimentos
- Acesso rápido às principais funcionalidades

### Gestão de Motoristas
| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de Motoristas | Visualizar todos os motoristas da frota |
| Perfil Completo | Dados pessoais, documentos, histórico |
| Adicionar Motorista | Registar novo motorista |
| Documentos | Carta condução, CAP, CC, seguro pessoal |
| Validação | Aprovar/rejeitar documentos submetidos |
| Arquivo | Motoristas inativos ou arquivados |

### Gestão de Veículos
| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de Veículos | Toda a frota com status e detalhes |
| Ficha de Veículo | Dados técnicos, documentos, manutenções |
| Adicionar Veículo | Registar novo veículo |
| Vistorias | Agendar e registar vistorias |
| Documentos | Seguro, IUC, inspeção, licença TVDE |
| Alertas | Notificações de vencimentos |

### Gestão de Contratos
| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de Contratos | Todos os contratos ativos e histórico |
| Criar Contrato | Gerar contrato motorista-veículo |
| Templates | Modelos de contrato personalizados |
| Assinaturas | Gestão de assinaturas digitais |
| Termos | Termos e condições por contrato |

### Módulo Financeiro
| Funcionalidade | Descrição |
|----------------|-----------|
| 📊 Resumo Semanal | Visão geral de ganhos e despesas |
| 💰 Extras/Dívidas | Gerir valores extra e dívidas de motoristas |
| ✅ Verificar Recibos | Validar recibos submetidos |
| 💳 Pagamentos | Processar pagamentos a motoristas |
| 📁 Arquivo de Recibos | Histórico de todos os recibos |
| 🔔 Alertas de Custos | Notificações de custos inesperados |

### Relatórios Semanais
| Funcionalidade | Descrição |
|----------------|-----------|
| Criar Relatório | Gerar relatório semanal manual ou automático |
| Histórico | Ver relatórios anteriores |
| Importar Dados | Carregar dados de plataformas (Uber, Bolt) |
| Exportar | Download em PDF, CSV, Excel |

### Comunicações
| Funcionalidade | Descrição |
|----------------|-----------|
| Mensagens | Chat interno com motoristas |
| WhatsApp | Envio de mensagens via WhatsApp |
| Notificações | Sistema de alertas e avisos |

### Configurações do Parceiro
| Funcionalidade | Descrição |
|----------------|-----------|
| Meu Plano | Ver plano atual e limites |
| Email & Credenciais | Configurar dados de acesso |
| Credenciais Plataformas | Guardar logins Uber/Bolt/etc. |
| Importação de Ficheiros | Configurar uploads de CSV |
| RPA Automático | Configurar automações disponíveis |

### Integrações
| Integração | Descrição |
|------------|-----------|
| Terabox | Armazenamento de documentos |
| Uber Driver | Importar dados de ganhos |
| Bolt Fleet | Importar dados de ganhos |
| Via Verde | Importar portagens |
| Prio/Galp | Importar consumos de combustível |

---

## 🟢 MOTORISTA

### Portal do Motorista
Dashboard simplificado com acesso às funcionalidades essenciais.

### Perfil & Documentos
| Funcionalidade | Descrição |
|----------------|-----------|
| Meu Perfil | Dados pessoais e foto |
| Documentos | Submeter e ver status dos documentos |
| Carta de Condução | Upload com data de validade |
| CAP | Certificado de Aptidão Profissional |
| Cartão de Cidadão | Documento de identificação |
| Seguro Pessoal | Apólice de seguro |
| Histórico | Ver documentos anteriores |

### Ganhos & Finanças
| Funcionalidade | Descrição |
|----------------|-----------|
| Meus Ganhos | Visualizar ganhos semanais |
| Recibos | Histórico de recibos e pagamentos |
| Enviar Recibo | Submeter recibo de ganhos |
| Detalhes | Ver breakdown por plataforma |
| Plano Atual | Ver detalhes do plano contratado |

### Comunicação
| Funcionalidade | Descrição |
|----------------|-----------|
| Mensagens | Chat com o parceiro/gestor |
| Tickets | Abrir pedidos de suporte |
| Notificações | Alertas e avisos importantes |

### Oportunidades
| Funcionalidade | Descrição |
|----------------|-----------|
| Oportunidades | Ver ofertas de outros parceiros |
| Candidaturas | Candidatar-se a novas posições |

### Conta
| Funcionalidade | Descrição |
|----------------|-----------|
| Planos Disponíveis | Ver planos de motorista |
| Meu Plano | Detalhes do plano atual |
| Termos | Termos de serviço |
| Privacidade | Política de privacidade |

---

## 📱 Funcionalidades Transversais

### Sistema de Autenticação
- Login com email e password
- Recuperação de password
- Sessões seguras com JWT
- Logout automático por inatividade

### Sistema de Notificações
- Notificações in-app em tempo real
- Alertas de documentos a expirar
- Avisos de pagamentos pendentes
- Lembretes de vistorias

### Importação de Dados
- Upload de ficheiros CSV
- Mapeamento automático de colunas
- Suporte a múltiplos fornecedores
- Histórico de importações

### Exportação de Dados
- Relatórios em PDF
- Exportação para Excel/CSV
- Relatórios personalizados
- Agendamento de exportações

---

## 🔒 Segurança

| Funcionalidade | Descrição |
|----------------|-----------|
| Encriptação | Passwords hasheadas com bcrypt |
| JWT Tokens | Autenticação stateless segura |
| Credenciais RPA | Encriptadas com Fernet |
| Roles & Permissions | Controlo de acesso por perfil |
| Audit Log | Registo de ações importantes |

---

## 📊 Estatísticas & Analytics

### Dashboard Admin
- Total de parceiros, motoristas, veículos
- Crescimento mensal/semanal
- Top parceiros por volume
- Distribuição geográfica

### Dashboard Parceiro
- Motoristas ativos vs total
- Taxa de ocupação de veículos
- Ganhos médios por motorista
- Custos operacionais

### Dashboard Motorista
- Ganhos da semana atual
- Comparação com semanas anteriores
- Status dos documentos
- Próximos vencimentos

---

## 🚀 Diferenciais

1. **Multi-tenant**: Suporte a múltiplos parceiros com dados isolados
2. **RPA Avançado**: Automação de extração de dados sem APIs
3. **Customização**: Admin pode criar automações para qualquer plataforma
4. **Mobile-friendly**: Interface responsiva para todos os dispositivos
5. **Integrações**: WhatsApp, Terabox, plataformas TVDE
6. **Segurança**: Dados encriptados e acesso controlado
7. **Escalável**: Arquitetura preparada para crescimento

---

## 📞 Suporte

- Chat interno entre motoristas e parceiros
- Sistema de tickets para suporte técnico
- Documentação integrada
- FAQ e base de conhecimento

---

## 🎨 Design

- Interface moderna e limpa
- Dark/Light mode (preparado)
- Componentes Shadcn/UI
- Ícones Lucide React
- Totalmente responsivo

---

*TVDEFleet - Gestão Inteligente de Frotas TVDE*
