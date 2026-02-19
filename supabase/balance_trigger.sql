-- Function to update account balance based on transactions
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'completed' THEN
            IF NEW.type = 'income' THEN
                UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF NEW.type = 'expense' THEN
                UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
            END IF;
        END IF;
        RETURN NEW;
    
    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'completed' THEN
            IF OLD.type = 'income' THEN
                UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF OLD.type = 'expense' THEN
                UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;
        RETURN OLD;
    
    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Revert OLD transaction effect if it was completed
        IF OLD.status = 'completed' THEN
            IF OLD.type = 'income' THEN
                UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF OLD.type = 'expense' THEN
                UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;

        -- Apply NEW transaction effect if it is completed
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

-- Create Trigger
DROP TRIGGER IF EXISTS trg_update_account_balance ON transactions;

CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();
