-- FluxoFinanceiro Database Schema
-- Execute este script no SQL Editor do Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'investment')),
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Cards Table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  card_limit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Card Purchases Table
CREATE TABLE IF NOT EXISTS credit_card_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  total_amount DECIMAL(15, 2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments >= 1 AND installments <= 48),
  purchase_date DATE NOT NULL,
  first_due_month DATE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Installments Table
CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES credit_card_purchases(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets Table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  purchase_value DECIMAL(15, 2) NOT NULL,
  purchase_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Debts Table
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  principal_amount DECIMAL(15, 2) NOT NULL,
  interest_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  remaining_balance DECIMAL(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Debt Payments Table
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  principal_paid DECIMAL(15, 2) NOT NULL,
  interest_paid DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investment Returns Table
CREATE TABLE IF NOT EXISTS investment_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  return_amount DECIMAL(15, 2) NOT NULL,
  reference_month DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX idx_credit_card_purchases_card_id ON credit_card_purchases(credit_card_id);
CREATE INDEX idx_installments_purchase_id ON installments(purchase_id);
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX idx_investment_returns_account_id ON investment_returns(account_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_returns ENABLE ROW LEVEL SECURITY;

-- Accounts Policies
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Categories Policies (public read, no write)
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);

-- Transactions Policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Credit Cards Policies
CREATE POLICY "Users can view own credit cards" ON credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credit cards" ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credit cards" ON credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own credit cards" ON credit_cards FOR DELETE USING (auth.uid() = user_id);

-- Credit Card Purchases Policies
CREATE POLICY "Users can view own purchases" ON credit_card_purchases FOR SELECT 
  USING (EXISTS (SELECT 1 FROM credit_cards WHERE credit_cards.id = credit_card_purchases.credit_card_id AND credit_cards.user_id = auth.uid()));
CREATE POLICY "Users can insert own purchases" ON credit_card_purchases FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM credit_cards WHERE credit_cards.id = credit_card_purchases.credit_card_id AND credit_cards.user_id = auth.uid()));
CREATE POLICY "Users can update own purchases" ON credit_card_purchases FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM credit_cards WHERE credit_cards.id = credit_card_purchases.credit_card_id AND credit_cards.user_id = auth.uid()));
CREATE POLICY "Users can delete own purchases" ON credit_card_purchases FOR DELETE 
  USING (EXISTS (SELECT 1 FROM credit_cards WHERE credit_cards.id = credit_card_purchases.credit_card_id AND credit_cards.user_id = auth.uid()));

-- Installments Policies
CREATE POLICY "Users can view own installments" ON installments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM credit_card_purchases 
    JOIN credit_cards ON credit_cards.id = credit_card_purchases.credit_card_id 
    WHERE credit_card_purchases.id = installments.purchase_id AND credit_cards.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own installments" ON installments FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM credit_card_purchases 
    JOIN credit_cards ON credit_cards.id = credit_card_purchases.credit_card_id 
    WHERE credit_card_purchases.id = installments.purchase_id AND credit_cards.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own installments" ON installments FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM credit_card_purchases 
    JOIN credit_cards ON credit_cards.id = credit_card_purchases.credit_card_id 
    WHERE credit_card_purchases.id = installments.purchase_id AND credit_cards.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own installments" ON installments FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM credit_card_purchases 
    JOIN credit_cards ON credit_cards.id = credit_card_purchases.credit_card_id 
    WHERE credit_card_purchases.id = installments.purchase_id AND credit_cards.user_id = auth.uid()
  ));

-- Assets Policies
CREATE POLICY "Users can view own assets" ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON assets FOR DELETE USING (auth.uid() = user_id);

-- Debts Policies
CREATE POLICY "Users can view own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON debts FOR DELETE USING (auth.uid() = user_id);

-- Debt Payments Policies
CREATE POLICY "Users can view own debt payments" ON debt_payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can insert own debt payments" ON debt_payments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can update own debt payments" ON debt_payments FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can delete own debt payments" ON debt_payments FOR DELETE 
  USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

-- Investment Returns Policies
CREATE POLICY "Users can view own investment returns" ON investment_returns FOR SELECT 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = investment_returns.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can insert own investment returns" ON investment_returns FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = investment_returns.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can update own investment returns" ON investment_returns FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = investment_returns.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can delete own investment returns" ON investment_returns FOR DELETE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = investment_returns.account_id AND accounts.user_id = auth.uid()));

-- =====================================================
-- SEED DATA - Default Categories
-- =====================================================

INSERT INTO categories (name, type, icon, color) VALUES
  -- Income Categories
  ('Salário', 'income', '💰', '#10b981'),
  ('Freelance', 'income', '💼', '#3b82f6'),
  ('Investimentos', 'income', '📈', '#8b5cf6'),
  ('Outros', 'income', '💵', '#6366f1'),
  
  -- Expense Categories
  ('Alimentação', 'expense', '🍔', '#ef4444'),
  ('Transporte', 'expense', '🚗', '#f59e0b'),
  ('Moradia', 'expense', '🏠', '#ec4899'),
  ('Saúde', 'expense', '⚕️', '#14b8a6'),
  ('Educação', 'expense', '📚', '#8b5cf6'),
  ('Lazer', 'expense', '🎮', '#06b6d4'),
  ('Compras', 'expense', '🛍️', '#f97316'),
  ('Contas', 'expense', '📄', '#64748b'),
  ('Outros', 'expense', '💸', '#6b7280')
ON CONFLICT DO NOTHING;
