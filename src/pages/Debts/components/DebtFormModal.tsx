
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';

export type Debt = {
    id: string;
    name: string;
    lender: string;
    total_amount: number;
    current_balance: number;
    interest_rate: number;
    start_date: string;
    due_day: number;
    total_installments?: number;
    installment_value?: number;
    description: string;
    active: boolean;
};

type DebtFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    debt?: Debt | null;
};

export function DebtFormModal({ isOpen, onClose, onSave, debt }: DebtFormModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Debt>>({
        name: '',
        lender: '',
        total_amount: 0,
        current_balance: 0,
        interest_rate: 0,
        start_date: new Date().toISOString().split('T')[0],
        due_day: 5,
        description: ''
    });

    useEffect(() => {
        if (debt) {
            setFormData(debt);
        } else {
            setFormData({
                name: '',
                lender: '',
                total_amount: 0,
                current_balance: 0,
                interest_rate: 0,
                start_date: new Date().toISOString().split('T')[0],
                due_day: 5,
                description: ''
            });
        }
    }, [debt, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (debt) {
                const { error } = await supabase
                    .from('debts')
                    .update({
                        name: formData.name,
                        lender: formData.lender,
                        total_amount: formData.total_amount,
                        // current_balance usually updated via payments, but allowing edit if necessary logic
                        current_balance: formData.current_balance,
                        interest_rate: formData.interest_rate,
                        start_date: formData.start_date,
                        due_day: formData.due_day,
                        total_installments: formData.total_installments,
                        installment_value: formData.installment_value,
                        description: formData.description
                    })
                    .eq('id', debt.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('debts')
                    .insert({
                        user_id: user!.id,
                        name: formData.name,
                        lender: formData.lender,
                        total_amount: formData.total_amount,
                        current_balance: formData.total_amount, // On create, current balance = total amount usually
                        interest_rate: formData.interest_rate,
                        start_date: formData.start_date,
                        due_day: formData.due_day,
                        total_installments: formData.total_installments,
                        installment_value: formData.installment_value,
                        description: formData.description,
                        active: true
                    });

                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving debt:', error);
            alert('Erro ao salvar dívida.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">
                        {debt ? 'Editar Dívida' : 'Nova Dívida'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome da Dívida</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Financiamento Casa, Empréstimo Pessoal"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Credor (Banco/Pessoa)</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.lender || ''}
                            onChange={e => setFormData({ ...formData, lender: e.target.value })}
                            placeholder="Ex: Caixa, Itaú, Fulano"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Valor Total</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.total_amount}
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({
                                        ...formData,
                                        total_amount: val,
                                        // If creating (no debt id), update current balance too
                                        current_balance: !debt ? val : formData.current_balance
                                    });
                                }}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Saldo Devedor Atual</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.current_balance}
                                onChange={e => setFormData({ ...formData, current_balance: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Taxa Juros Mensal (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.interest_rate}
                                onChange={e => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="label">Dia Vencimento</label>
                            <input
                                type="number"
                                min="1" max="31"
                                className="input"
                                value={formData.due_day}
                                onChange={e => setFormData({ ...formData, due_day: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Total de Parcelas</label>
                            <input
                                type="number"
                                min="1"
                                className="input"
                                value={formData.total_installments || ''}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    const newInstallments = isNaN(val) ? undefined : val;

                                    // Calculate Installment Value automatically if Total Amount exists
                                    let newInstallmentValue = formData.installment_value;
                                    if (newInstallments && formData.total_amount) {
                                        newInstallmentValue = parseFloat((formData.total_amount / newInstallments).toFixed(2));
                                    }

                                    setFormData({
                                        ...formData,
                                        total_installments: newInstallments,
                                        installment_value: newInstallmentValue
                                    });
                                }}
                                placeholder="Opcional"
                            />
                        </div>
                        <div>
                            <label className="label">Valor da Parcela</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.installment_value || ''}
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({ ...formData, installment_value: isNaN(val) ? undefined : val });
                                }}
                                placeholder="Opcional"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Data Início</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.start_date}
                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="submit" className="btn-primary flex-1" disabled={loading}>
                            <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
