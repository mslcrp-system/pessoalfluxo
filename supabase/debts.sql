
-- Tabela de Dívidas
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT, -- Credor (Banco X, Fulano)
  total_amount DECIMAL(15, 2) NOT NULL, -- Valor original da dívida
  current_balance DECIMAL(15, 2) NOT NULL, -- Saldo devedor atual
  interest_rate DECIMAL(5, 2) DEFAULT 0, -- Taxa de juros mensal (%)
  start_date DATE NOT NULL,
  due_day INTEGER, -- Dia do vencimento
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Pagamentos de Dívidas
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL, -- Valor total pago
  principal_amount DECIMAL(15, 2) NOT NULL, -- Valor amortizado do principal
  interest_amount DECIMAL(15, 2) DEFAULT 0, -- Valor pago em juros
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Link com fluxo de caixa
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- Policies Debts
CREATE POLICY "Users can view their own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own debts" ON debts FOR DELETE USING (auth.uid() = user_id);

-- Policies Debt Payments
CREATE POLICY "Users can view their own debt payments" 
ON debt_payments FOR SELECT 
USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

CREATE POLICY "Users can insert their own debt payments" 
ON debt_payments FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

CREATE POLICY "Users can update their own debt payments" 
ON debt_payments FOR UPDATE 
USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

CREATE POLICY "Users can delete their own debt payments" 
ON debt_payments FOR DELETE 
USING (EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
