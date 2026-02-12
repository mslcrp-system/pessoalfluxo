
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { Debt } from './DebtFormModal';

type PaymentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    debt: Debt;
};

type Account = {
    id: string;
    name: string;
    balance: number;
};

export function PaymentModal({ isOpen, onClose, onSave, debt }: PaymentModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    // Default: Total payment = principal + interest
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        interest_amount: 0,
        principal_amount: 0,
        createTransaction: true,
        accountId: '',
        description: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadAccounts();
            // Estimate interest based on rate and balance?
            // Simple interest for 1 month: Balance * (Rate/100)
            const estimatedInterest = debt.current_balance * (debt.interest_rate / 100);

            setFormData({
                date: new Date().toISOString().split('T')[0],
                total_amount: 0,
                interest_amount: parseFloat(estimatedInterest.toFixed(2)),
                principal_amount: 0,
                createTransaction: true,
                accountId: '',
                description: `Pagamento - ${debt.name}`
            });
        }
    }, [isOpen, debt]);

    const loadAccounts = async () => {
        const { data } = await supabase
            .from('accounts')
            .select('id, name, balance')
            .eq('active', true)
            .order('name');

        if (data) setAccounts(data);
    };

    // Auto-calculate Principal when Total or Interest changes
    const handleTotalChange = (val: number) => {
        setFormData(prev => ({
            ...prev,
            total_amount: val,
            principal_amount: Math.max(0, val - prev.interest_amount)
        }));
    };

    const handleInterestChange = (val: number) => {
        setFormData(prev => ({
            ...prev,
            interest_amount: val,
            principal_amount: Math.max(0, prev.total_amount - val)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let transactionId = null;

            if (formData.createTransaction && formData.accountId) {
                // Find or create category 'Pagamento de Dívida' or similar
                let { data: category } = await supabase
                    .from('categories')
                    .select('id')
                    .eq('name', 'Pagamento de Dívida')
                    .eq('type', 'expense')
                    .single();

                if (!category) {
                    // Fallback
                    const { data: anyCat } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('type', 'expense')
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
                            type: 'expense',
                            amount: formData.total_amount,
                            transaction_date: formData.date,
                            description: formData.description || `Pagamento Dívida - ${debt.name}`,
                            status: 'completed'
                        })
                        .select()
                        .single();

                    if (transError) throw transError;
                    transactionId = trans.id;

                    // The account balance update is now handled by a database trigger on the transactions table.
                    // The following lines are removed as they are no longer needed.
                    // const account = accounts.find(a => a.id === formData.accountId);
                    // if (account) {
                    //     await supabase.from('accounts').update({
                    //         balance: account.balance - formData.total_amount
                    //     }).eq('id', account.id);
                    // }
                }
            }

            // Create Debt Payment Record
            const { error: payError } = await supabase
                .from('debt_payments')
                .insert({
                    debt_id: debt.id,
                    date: formData.date,
                    amount: formData.total_amount,
                    principal_amount: formData.principal_amount,
                    interest_amount: formData.interest_amount,
                    transaction_id: transactionId
                });

            if (payError) throw payError;

            // Update Debt Balance
            const newBalance = Math.max(0, debt.current_balance - formData.principal_amount);
            const { error: debtError } = await supabase
                .from('debts')
                .update({ current_balance: newBalance })
                .eq('id', debt.id);

            if (debtError) throw debtError;

            onSave();
            onClose();
        } catch (error) {
            console.error('Error processing payment:', error);
            alert('Erro ao processar pagamento.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">
                        Registrar Pagamento
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-surface-hover rounded-lg">
                    <p className="font-semibold">{debt.name}</p>
                    <p className="text-sm text-text-secondary">
                        Saldo Devedor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debt.current_balance)}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                    <div>
                        <label className="label">Valor Total Pago (Parcela)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input text-lg font-bold"
                            value={formData.total_amount}
                            onChange={e => handleTotalChange(parseFloat(e.target.value))}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label text-xs">Juros (Est. {debt.interest_rate}%)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input text-sm"
                                value={formData.interest_amount}
                                onChange={e => handleInterestChange(parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="label text-xs">Amortização Principal</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input text-sm bg-surface-hover"
                                value={formData.principal_amount}
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input
                                type="checkbox"
                                className="form-checkbox rounded text-primary"
                                checked={formData.createTransaction}
                                onChange={e => setFormData({ ...formData, createTransaction: e.target.checked })}
                            />
                            <span className="text-sm">Deduzir do Fluxo de Caixa</span>
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
                            <Save className="w-4 h-4" /> {loading ? 'Processando...' : 'Confirmar Pagamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
