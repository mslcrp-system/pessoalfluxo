-- Adicionar coluna status na tabela transactions
-- Execute este script no SQL Editor do Supabase

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' 
CHECK (status IN ('pending', 'completed'));

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Atualizar transações existentes para 'completed'
UPDATE transactions SET status = 'completed' WHERE status IS NULL;
