
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createCategory() {
    // Pegar primeiro usuário para teste (em prod seria auth.uid())
    // Mas como rodamos via node, precisamos saber o user_id.
    // Vou pegar um transaction qualquer para descobrir o user_id
    const { data: trans } = await supabase.from('transactions').select('user_id').limit(1).single();

    if (!trans) {
        console.log('No transactions found to get user_id');
        return;
    }

    const userId = trans.user_id;
    console.log('User ID found:', userId);

    const { data, error } = await supabase
        .from('categories')
        .insert([
            {
                user_id: userId,
                name: 'Cartão de Crédito',
                icon: 'credit-card',
                color: '#6366f1',
                type: 'expense'
            }
        ])
        .select();

    if (error) {
        console.error('Error creating category:', error);
    } else {
        console.log('Category created:', data);
    }
}

createCategory();
