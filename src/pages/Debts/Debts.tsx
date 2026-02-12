
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
    TrendingDown, Plus, DollarSign,
    Trash2, Edit, CheckCircle
} from 'lucide-react';
import { DebtFormModal, Debt } from './components/DebtFormModal';
import { PaymentModal } from './components/PaymentModal';

export function Debts() {
    const { user } = useAuth();
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    const [showDebtModal, setShowDebtModal] = useState(false);
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

    useEffect(() => {
        if (user) {
            loadDebts();
        }
    }, [user]);

    const loadDebts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('debts')
                .select('*')
                .order('name');

            if (error) throw error;
            setDebts(data || []);
        } catch (error) {
            console.error('Error loading debts:', error);
            // alert('Erro ao carregar dívidas.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditDebt = (debt: Debt) => {
        setEditingDebt(debt);
        setShowDebtModal(true);
    };

    const handlePayment = (debt: Debt) => {
        setSelectedDebt(debt);
        setShowPaymentModal(true);
    };

    const handleDeleteDebt = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta dívida? Todo histórico de pagamentos será perdido.')) return;

        try {
            const { error } = await supabase
                .from('debts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadDebts();
        } catch (error) {
            console.error('Error deleting debt:', error);
            alert('Erro ao excluir dívida.');
        }
    };

    const handleCloseModal = () => {
        setShowDebtModal(false);
        setEditingDebt(null);
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // Totals
    const totalDebtAmount = debts.reduce((sum, d) => sum + d.total_amount, 0);
    const totalOutstanding = debts.reduce((sum, d) => sum + d.current_balance, 0);
    // Actually totalPaid is better calculated from payments table, but for overview this is ok-ish active balance calc.

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <TrendingDown className="w-8 h-8 text-danger" />
                        Dívidas & Financiamentos
                    </h1>
                    <p className="text-text-secondary">Controle seus empréstimos e acompanhe a quitação</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setEditingDebt(null); setShowDebtModal(true); }}
                        className="btn-primary bg-danger hover:bg-danger/90 border-danger"
                    >
                        <Plus className="w-5 h-5" /> Nova Dívida
                    </button>
                </div>
            </div>

            {/* Warning / Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-gradient-to-br from-surface to-surface-hover">
                    <p className="text-sm text-text-secondary mb-1">Saldo Devedor Total</p>
                    <p className="text-2xl font-bold text-danger">{formatCurrency(totalOutstanding)}</p>
                </div>
                <div className="card bg-gradient-to-br from-surface to-surface-hover">
                    <p className="text-sm text-text-secondary mb-1">Valor Original Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalDebtAmount)}</p>
                </div>
                <div className="card bg-gradient-to-br from-surface to-surface-hover">
                    <p className="text-sm text-text-secondary mb-1">Qtd. Dívidas Ativas</p>
                    <p className="text-2xl font-bold">{debts.filter(d => d.current_balance > 0).length}</p>
                </div>
            </div>

            {/* Debts List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {debts.map(debt => {
                    const progress = debt.total_amount > 0
                        ? ((debt.total_amount - debt.current_balance) / debt.total_amount) * 100
                        : 0;
                    const isPaidOff = debt.current_balance <= 0.01;

                    return (
                        <div key={debt.id} className={`card ${isPaidOff ? 'opacity-75 border border-success/30' : ''}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        {debt.name}
                                        {isPaidOff && <CheckCircle className="w-5 h-5 text-success" />}
                                    </h3>
                                    <p className="text-sm text-text-secondary">{debt.lender}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleEditDebt(debt)}
                                        className="p-1.5 hover:bg-surface-hover rounded text-text-secondary hover:text-primary"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteDebt(debt.id)}
                                        className="p-1.5 hover:bg-surface-hover rounded text-text-secondary hover:text-danger"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-text-secondary">Saldo Devedor</p>
                                        <p className="text-2xl font-bold text-danger">
                                            {formatCurrency(debt.current_balance)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-text-secondary">Valor Original</p>
                                        <p className="font-semibold">{formatCurrency(debt.total_amount)}</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-surface-hover h-3 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${isPaidOff ? 'bg-success' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs text-text-secondary">
                                    <span>{progress.toFixed(1)}% Quitado</span>
                                    <span>
                                        {debt.total_installments ? `${debt.total_installments}x` : ''}
                                        {debt.interest_rate > 0 ? ` (${debt.interest_rate}% a.m.)` : ''}
                                    </span>
                                </div>

                                {!isPaidOff && (
                                    <button
                                        onClick={() => handlePayment(debt)}
                                        className="btn-primary w-full justify-center mt-2 group"
                                    >
                                        <DollarSign className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        Registrar Pagamento
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {debts.length === 0 && !loading && (
                    <div className="col-span-full card text-center py-12 border-dashed border-2 border-border/50 bg-transparent">
                        <TrendingDown className="w-12 h-12 text-text-muted mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Sem dívidas ativas</h3>
                        <p className="text-text-secondary mb-4">Que bom! Você não possui empréstimos registrados.</p>
                        <button
                            onClick={() => setShowDebtModal(true)}
                            className="btn-secondary"
                        >
                            <Plus className="w-4 h-4" /> Adicionar Dívida
                        </button>
                    </div>
                )}
            </div>

            <DebtFormModal
                isOpen={showDebtModal}
                onClose={handleCloseModal}
                onSave={loadDebts}
                debt={editingDebt}
            />

            {selectedDebt && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedDebt(null);
                    }}
                    onSave={loadDebts}
                    debt={selectedDebt}
                />
            )}
        </div>
    );
}
