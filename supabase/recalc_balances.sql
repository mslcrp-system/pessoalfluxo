-- Recalculate balances for all accounts based on transactions
DO $$
DECLARE
    acc RECORD;
    calc_balance DECIMAL(15, 2);
BEGIN
    FOR acc IN SELECT id FROM accounts LOOP
        -- Calculate balance from completed transactions
        SELECT COALESCE(SUM(CASE 
            WHEN type = 'income' THEN amount 
            WHEN type = 'expense' THEN -amount 
            ELSE 0 
        END), 0)
        INTO calc_balance
        FROM transactions
        WHERE account_id = acc.id AND status = 'completed';

        -- Update account with calculated balance (Initial balance assumption: 0 or handles via seed if needed, but here absolute sum)
        -- NOTE: If accounts had an initial balance that is NOT a transaction, this might wipe it.
        -- Assuming all movements are transactions for now.
        UPDATE accounts SET balance = calc_balance WHERE id = acc.id;
    END LOOP;
END $$;
