-- Tornar category_id opcional na tabela transactions para permitir transferências
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions'
        AND column_name = 'category_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE transactions ALTER COLUMN category_id DROP NOT NULL;
    END IF;
END $$;
