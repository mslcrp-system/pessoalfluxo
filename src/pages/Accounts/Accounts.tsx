import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Plus, Wallet, TrendingUp, Edit2, Trash2 } from 'lucide-react';
import type { Database } from '../../types/database';

type Account = Database['public']['Tables']['accounts']['Row'];

export function Accounts() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'checking' as 'checking' | 'investment',
        balance: 0,
    });

    useEffect(() => {
        if (user) {
            loadAccounts();
        }
    }, [user]);

    const loadAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user!.id)
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAccounts(data);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingAccount) {
            // Update
            const { error } = await supabase
                .from('accounts')
                .update({
                    name: formData.name,
                    type: formData.type,
                    balance: formData.balance,
                })
                .eq('id', editingAccount.id);

            if (!error) {
                loadAccounts();
                closeModal();
            }
        } else {
            // Create
            const { error } = await supabase.from('accounts').insert({
                user_id: user!.id,
                name: formData.name,
                type: formData.type,
                balance: formData.balance,
            });

            if (!error) {
                loadAccounts();
                closeModal();
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta conta?')) {
            const { error } = await supabase
                .from('accounts')
                .update({ active: false })
                .eq('id', id);

            if (!error) {
                loadAccounts();
            }
        }
    };

    const openModal = (account?: Account) => {
        if (account) {
            setEditingAccount(account);
            setFormData({
                name: account.name,
                type: account.type,
                balance: account.balance,
            });
        } else {
            setEditingAccount(null);
            setFormData({ name: '', type: 'checking', balance: 0 });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAccount(null);
        setFormData({ name: '', type: 'checking', balance: 0 });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Contas</h1>
                    <p className="text-text-secondary text-sm md:text-base">Gerencie suas contas bancárias e carteiras e de investimento</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Nova Conta
                </button>
            </div>

            {/* Total Balance */}
            <div className="card bg-gradient-to-br from-primary to-secondary text-white">
                <p className="text-sm opacity-90 mb-1">Saldo Total</p>
                <p className="text-2xl md:text-4xl font-bold">{formatCurrency(totalBalance)}</p>
            </div>

            {/* Accounts List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                    <div key={account.id} className="card-hover">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                                    {account.type === 'checking' ? (
                                        <Wallet className="w-6 h-6 text-primary" />
                                    ) : (
                                        <TrendingUp className="w-6 h-6 text-success" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold">{account.name}</h3>
                                    <p className="text-sm text-text-muted">
                                        {account.type === 'checking' ? 'Conta Corrente' : 'Investimento'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openModal(account)}
                                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4 text-text-secondary" />
                                </button>
                                <button
                                    onClick={() => handleDelete(account.id)}
                                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-danger" />
                                </button>
                            </div>
                        </div>
                        <p className={`text-xl md:text-2xl font-bold ${account.balance < 0 ? 'text-danger' : ''}`}>{formatCurrency(account.balance)}</p>
                    </div>
                ))}
            </div>

            {accounts.length === 0 && (
                <div className="card text-center py-12">
                    <Wallet className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhuma conta cadastrada</h3>
                    <p className="text-text-secondary mb-4">Crie sua primeira conta para começar</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        Criar Conta
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-2xl font-semibold mb-6">
                            {editingAccount ? 'Editar Conta' : 'Nova Conta'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Nome da Conta</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Banco Inter"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Tipo</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) =>
                                        setFormData({ ...formData, type: e.target.value as 'checking' | 'investment' })
                                    }
                                    className="select"
                                >
                                    <option value="checking">Conta Corrente</option>
                                    <option value="investment">Investimento</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Saldo Inicial</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                                    className="input"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="btn-primary flex-1">
                                    {editingAccount ? 'Salvar' : 'Criar'}
                                </button>
                                <button type="button" onClick={closeModal} className="btn-ghost flex-1">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
