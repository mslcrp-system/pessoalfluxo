-- Inserir categoria para pagamento de cartão de crédito
INSERT INTO categories (user_id, name, icon, color, type)
SELECT 
    id as user_id,
    'Cartão de Crédito',
    'credit-card',
    '#6366f1', -- Indigo
    'expense'
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.user_id = auth.users.id 
    AND c.name = 'Cartão de Crédito'
);
