
-- Adicionar coluna user_id na tabela categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Habilitar RLS (Row Level Security) se ainda não estiver habilitado
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir que usuários vejam apenas suas próprias categorias
-- Nota: Para categorias "padrão" do sistema (sem user_id), talvez precisemos de uma política OR user_id IS NULL
CREATE POLICY "Users can view their own categories" 
ON categories FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own categories" 
ON categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON categories FOR DELETE 
USING (auth.uid() = user_id);
