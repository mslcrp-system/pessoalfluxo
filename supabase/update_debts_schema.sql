
-- Adicionar colunas de parcelamento
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS total_installments INTEGER,
ADD COLUMN IF NOT EXISTS installment_value DECIMAL(15, 2);

-- Garantir que a coluna active existe (caso tenha falhado anteriormente)
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Forçar o recarregamento do cache do schema (para resolver o erro PGRST204)
NOTIFY pgrst, 'reload schema';
