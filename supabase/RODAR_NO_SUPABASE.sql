-- =========================================================
-- FLUXO FINANCEIRO - RODAR ESTE ARQUIVO NO SQL EDITOR DO SUPABASE
-- Acesse: https://supabase.com → Seu projeto → SQL Editor → New Query
-- Cole todo este conteúdo e clique em "Run"
-- =========================================================

-- PARTE 1: Adicionar coluna 'initial_balance' para guardar o saldo original
-- (o balance atual será sempre o calculado, o initial_balance é imutável)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Copiar o balance atual para initial_balance (apenas uma vez, na migração)
UPDATE accounts
SET initial_balance = balance
WHERE initial_balance = 0;

-- PARTE 2: Criar função de trigger para atualizar balance automaticamente
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'completed' THEN
            IF NEW.type = 'income' THEN
                UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF NEW.type = 'expense' THEN
                UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
            END IF;
        END IF;
        RETURN NEW;

    -- DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'completed' THEN
            IF OLD.type = 'income' THEN
                UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF OLD.type = 'expense' THEN
                UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;
        RETURN OLD;

    -- UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Reverter efeito antigo
        IF OLD.status = 'completed' THEN
            IF OLD.type = 'income' THEN
                UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF OLD.type = 'expense' THEN
                UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;
        -- Aplicar novo efeito
        IF NEW.status = 'completed' THEN
            IF NEW.type = 'income' THEN
                UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF NEW.type = 'expense' THEN
                UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- PARTE 3: Criar o trigger
DROP TRIGGER IF EXISTS trg_update_account_balance ON transactions;
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();

-- PARTE 4: Recalcular TODOS os saldos com base no histórico de transações
-- (corrige inconsistências históricas)
DO $$
DECLARE
    acc RECORD;
    calc_balance DECIMAL(15, 2);
BEGIN
    FOR acc IN SELECT id, initial_balance FROM accounts LOOP
        SELECT COALESCE(SUM(CASE
            WHEN type = 'income' THEN amount
            WHEN type = 'expense' THEN -amount
            ELSE 0
        END), 0)
        INTO calc_balance
        FROM transactions
        WHERE account_id = acc.id AND status = 'completed';

        -- Saldo atual = saldo inicial + movimentações realizadas
        UPDATE accounts SET balance = acc.initial_balance + calc_balance WHERE id = acc.id;
    END LOOP;
END $$;

-- PRONTO! Ao finalizar, confirme que o trigger foi criado com:
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'transactions';
