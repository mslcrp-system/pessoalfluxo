
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { Investment } from './AssetFormModal';

type OperationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    investment: Investment;
};

type Account = {
    id: string;
    name: string;
    balance: number;
};

export function OperationModal({ isOpen, onClose, onSave, investment }: OperationModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [formData, setFormData] = useState({
        type: 'buy' as 'buy' | 'sell' | 'dividend' | 'interest',
        date: new Date().toISOString().split('T')[0],
        quantity: 0,
        price: 0,
        fees: 0,
        createTransaction: true,
        accountId: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadAccounts();
            // Reset form or set defaults based on investment current price/quantity
            setFormData(prev => ({
                ...prev,
                price: investment.current_price || 0,
                quantity: 0,
                fees: 0
            }));
        }
    }, [isOpen, investment]);

    const loadAccounts = async () => {
        const { data } = await supabase
            .from('accounts')
            .select('id, name, balance')
            .eq('active', true)
            .order('name');

        if (data) setAccounts(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Calculate financial amount
        let financialAmount = 0;
        if (formData.type === 'buy') {
            financialAmount = (formData.quantity * formData.price) + formData.fees;
        } else if (formData.type === 'sell') {
            financialAmount = (formData.quantity * formData.price) - formData.fees;
        } else {
            financialAmount = formData.quantity * formData.price;
        }

        try {
            let transactionId = null;

            // 1. Create Financial Transaction (Optional)
            if (formData.createTransaction && formData.accountId) {
                const isExpense = formData.type === 'buy';

                // Fetch 'Investimentos' expense category or 'Rendimentos' income category
                const categoryName = isExpense ? 'Investimentos' : (formData.type === 'sell' ? 'Resgate Investimento' : 'Proventos');
                const categoryType = isExpense ? 'expense' : 'income';

                // Find category
                let { data: category } = await supabase
                    .from('categories')
                    .select('id')
                    .eq('name', categoryName)
                    .eq('type', categoryType)
                    .single();

                // If not found, look for any category of that type or handle error
                if (!category) {
                    // Fallback: Pick first category of type
                    const { data: anyCat } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('type', categoryType)
                        .limit(1)
                        .single();
                    category = anyCat;
                }

                if (category) {
                    const { data: trans, error: transError } = await supabase
                        .from('transactions')
                        .insert({
                            user_id: user!.id,
                            account_id: formData.accountId,
                            category_id: category.id,
                            type: isExpense ? 'expense' : 'income',
                            amount: financialAmount,
                            transaction_date: formData.date,
                            description: `${formData.type === 'buy' ? 'Compra' : formData.type === 'sell' ? 'Venda' : 'Proventos'} - ${investment.ticker || investment.name}`,
                            status: 'completed'
                        })
                        .select()
                        .single();

                    if (transError) throw transError;
                    transactionId = trans.id;

                    // Update Account Balance via RPC (optional/optimization)
                    await supabase.rpc(isExpense ? 'decrement_balance' : 'increment_balance', {
                        row_id: formData.accountId,
                        amount: financialAmount
                    });

                    // Fallback manual update
                    const account = accounts.find(a => a.id === formData.accountId);
                    if (account) {
                        const newBalance = isExpense ? account.balance - financialAmount : account.balance + financialAmount;
                        await supabase.from('accounts').update({ balance: newBalance }).eq('id', account.id);
                    }
                }
            }

            // 2. Create Investment Transaction
            const { error: invTransError } = await supabase
                .from('investment_transactions')
                .insert({
                    investment_id: investment.id,
                    type: formData.type,
                    date: formData.date,
                    quantity: formData.quantity,
                    price: formData.price,
                    total_amount: financialAmount,
                    fees: formData.fees,
                    related_transaction_id: transactionId
                });

            if (invTransError) throw invTransError;

            // 3. Update Investment Position (Cache)
            let newQuantity = investment.quantity;
            let newAveragePrice = investment.average_price;

            if (formData.type === 'buy') {
                const totalCost = (investment.quantity * investment.average_price) + (formData.quantity * formData.price);
                const totalQty = investment.quantity + formData.quantity;
                newAveragePrice = totalQty > 0 ? totalCost / totalQty : 0;
                newQuantity = totalQty;
            } else if (formData.type === 'sell') {
                newQuantity = investment.quantity - formData.quantity;
            }

            await supabase
                .from('investments')
                .update({
                    quantity: newQuantity,
                    average_price: newAveragePrice,
                    current_price: (formData.type === 'buy' || formData.type === 'sell') ? formData.price : investment.current_price
                })
                .eq('id', investment.id);

            onSave();
            onClose();
        } catch (error) {
            console.error('Error processing operation:', error);
            alert('Erro ao processar operação.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isProventos = formData.type === 'dividend' || formData.type === 'interest';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">
                        Nova Operação
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-surface-hover rounded-lg">
                    <p className="font-semibold">{investment.ticker || investment.name}</p>
                    <p className="text-xs text-text-secondary">{investment.name}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-2 p-1 bg-surface-hover rounded-lg mb-4">
                        {['buy', 'sell', 'dividend'].map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: type as any }))}
                                className={`flex-1 py-1.5 text-sm rounded transition-colors ${formData.type === type
                                    ? (type === 'buy' ? 'bg-primary text-white' : type === 'sell' ? 'bg-danger text-white' : 'bg-success text-white')
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                {type === 'buy' ? 'Compra' : type === 'sell' ? 'Venda' : 'Proventos'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="label">Data</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">{isProventos ? 'Qtd. Papéis' : 'Quantidade'}</label>
                            <input
                                type="number"
                                step="0.00000001"
                                className="input"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">{isProventos ? 'Valor Unit.' : 'Preço Unit.'}</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    {!isProventos && (
                        <div>
                            <label className="label">Taxas / Corretagem</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.fees}
                                onChange={e => setFormData({ ...formData, fees: parseFloat(e.target.value) })}
                            />
                        </div>
                    )}

                    <div className="pt-2 border-t border-border">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input
                                type="checkbox"
                                className="form-checkbox rounded text-primary"
                                checked={formData.createTransaction}
                                onChange={e => setFormData({ ...formData, createTransaction: e.target.checked })}
                            />
                            <span className="text-sm">Lançar no Fluxo de Caixa</span>
                        </label>

                        {formData.createTransaction && (
                            <div className="animate-fade-in">
                                <label className="label">Conta</label>
                                <select
                                    className="select"
                                    value={formData.accountId}
                                    onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                                    required={formData.createTransaction}
                                >
                                    <option value="">Selecione uma conta</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="submit" className="btn-primary flex-1" disabled={loading}>
                            <Save className="w-4 h-4" /> {loading ? 'Processando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
