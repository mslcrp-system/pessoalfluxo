# FluxoFinanceiro

Sistema completo de gestão financeira pessoal/familiar com controle de receitas, despesas, cartões de crédito, investimentos e dívidas.

## 🚀 Tecnologias

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- npm ou yarn

## ⚙️ Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Banco de Dados Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **SQL Editor**
3. Copie todo o conteúdo do arquivo `supabase/migration.sql`
4. Cole no editor SQL e execute (clique em "Run")

Isso irá criar:
- ✅ Todas as tabelas necessárias
- ✅ Índices para performance
- ✅ Políticas RLS (Row Level Security)
- ✅ Categorias padrão (receitas e despesas)

### 3. Variáveis de Ambiente

O arquivo `.env.local` já está configurado com as credenciais do Supabase fornecidas.

## 🏃 Executar o Projeto

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

## 📦 Build para Produção

```bash
npm run build
```

## 🎯 Funcionalidades

### ✅ Implementado

- **Autenticação**: Login e registro de usuários
- **Contas**: CRUD completo de contas correntes e de investimento
- **Layout Responsivo**: Sidebar com navegação mobile-first
- **Design System**: Componentes reutilizáveis com Tailwind

### 🚧 Em Desenvolvimento

- **Transações**: Lançamento de receitas e despesas
- **Cartões de Crédito**: Controle de faturas e parcelamento inteligente
- **Investimentos**: Registro de ativos e rentabilidade
- **Dívidas**: Controle de amortizações
- **Dashboard**: Gráficos e relatórios visuais

## 🗂️ Estrutura do Projeto

```
FluxoFinanceiro/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   ├── lib/             # Configurações (Supabase, Auth)
│   ├── types/           # Tipos TypeScript
│   └── index.css        # Estilos globais + Tailwind
├── supabase/
│   └── migration.sql    # Script de criação do banco
└── .env.local           # Variáveis de ambiente
```

## 🔐 Segurança

- Autenticação via Supabase Auth
- Row Level Security (RLS) em todas as tabelas
- Usuários só acessam seus próprios dados
- Proteção de rotas no frontend

## 📝 Próximos Passos

1. Executar o SQL no Supabase
2. Testar login/registro
3. Criar contas de teste
4. Implementar módulos restantes (Transações, Cartões, etc.)
5. Adicionar gráficos ao Dashboard
6. Deploy no Vercel

## 🤝 Contribuindo

Este é um projeto pessoal/familiar. Para adicionar funcionalidades:

1. Crie uma branch
2. Faça suas alterações
3. Teste localmente
4. Faça commit e push

## 📄 Licença

Projeto privado para uso pessoal.
