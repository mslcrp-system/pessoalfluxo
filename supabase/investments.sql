
-- Tabela de Ativos (Investimentos)
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT, -- Código do ativo (ex: PETR4, HGLG11), opcional para Renda Fixa
  type TEXT NOT NULL CHECK (type IN ('stock', 'fii', 'fixed_income', 'crypto', 'treasure', 'other')),
  current_price DECIMAL(15, 2) DEFAULT 0, -- Preço atual (atualizado manualmente ou via API futura)
  quantity DECIMAL(15, 8) DEFAULT 0, -- Quantidade atual em carteira (suporta frações para crypto)
  average_price DECIMAL(15, 2) DEFAULT 0, -- Preço médio de compra
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Transações de Investimento (Histórico)
CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'interest')), -- buy/sell: compra/venda, dividend/interest: proventos
  date DATE NOT NULL,
  quantity DECIMAL(15, 8) NOT NULL, -- Quantidade negociada
  price DECIMAL(15, 2) NOT NULL, -- Preço unitário na operação
  total_amount DECIMAL(15, 2) NOT NULL, -- Valor total da operação (incluindo taxas se houver)
  fees DECIMAL(15, 2) DEFAULT 0, -- Taxas/Corretagem
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Link com o Fluxo de Caixa (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para investments
CREATE POLICY "Users can view their own investments" 
ON investments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investments" 
ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investments" 
ON investments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investments" 
ON investments FOR DELETE USING (auth.uid() = user_id);

-- Políticas para investment_transactions
-- (Acesso indireto via investment_id -> user_id, mas Supabase requer política direta ou join)
CREATE POLICY "Users can view their own investment transactions" 
ON investment_transactions FOR SELECT 
USING (EXISTS (SELECT 1 FROM investments WHERE investments.id = investment_transactions.investment_id AND investments.user_id = auth.uid()));

CREATE POLICY "Users can insert their own investment transactions" 
ON investment_transactions FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM investments WHERE investments.id = investment_transactions.investment_id AND investments.user_id = auth.uid()));

CREATE POLICY "Users can update their own investment transactions" 
ON investment_transactions FOR UPDATE 
USING (EXISTS (SELECT 1 FROM investments WHERE investments.id = investment_transactions.investment_id AND investments.user_id = auth.uid()));

CREATE POLICY "Users can delete their own investment transactions" 
ON investment_transactions FOR DELETE 
USING (EXISTS (SELECT 1 FROM investments WHERE investments.id = investment_transactions.investment_id AND investments.user_id = auth.uid()));
