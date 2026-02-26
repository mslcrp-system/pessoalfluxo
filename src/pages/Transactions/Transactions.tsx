import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Calendar, X, Check, Clock, Edit, RotateCcw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { format, isBefore, startOfToday, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImportModal } from './components/ImportModal';

type Account = {
    id: string;
    name: string;
    type: string;
    balance: number;
};

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
};

type Transaction = {
    id: string;
    user_id: string;
    account_id: string;
    category_id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    transaction_date: string;
    description: string;
    status: 'pending' | 'completed';
    created_at: string;
    account?: Account;
    category?: Category;
};

export function Transactions() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
    const [filterAccount, setFilterAccount] = useState<string>('all');

    const [formData, setFormData] = useState({
        type: 'expense' as 'income' | 'expense' | 'transfer',
        account_id: '',
        category_id: '',
        amount: 0,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        to_account_id: '',
    });

    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, filterType, filterStatus, filterAccount, currentMonth]);

    const loadData = async () => {
        await Promise.all([loadTransactions(), loadAccounts(), loadCategories()]);
        setLoading(false);
    };

    const loadTransactions = async () => {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

        let query = supabase
            .from('transactions')
            .select(`
        *,
        account:accounts(id, name, type, balance),
        category:categories(id, name, type, icon, color)
      `)
            .eq('user_id', user!.id)
            .gte('transaction_date', start)
            .lte('transaction_date', end)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (filterType !== 'all') {
            query = query.eq('type', filterType);
        }

        if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
        }

        if (filterAccount !== 'all') {
            query = query.eq('account_id', filterAccount);
        }

        const { data, error } = await query;

        if (!error && data) {
            setTransactions(data as any);
        }
    };

    const loadAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user!.id)
            .eq('active', true)
            .order('name');

        if (!error && data) {
            setAccounts(data);
        }
    };

    const loadCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (!error && data) {
            setCategories(data);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Determinar status automaticamente baseado na data
        const transactionDate = new Date(formData.transaction_date);
        const today = startOfToday();
        const newStatus = isBefore(transactionDate, today) || transactionDate.toDateString() === today.toDateString()
            ? 'completed'
            : 'pending';


        // Lógica de Transferência
        if (formData.type === 'transfer') {
            if (!formData.account_id || !formData.to_account_id || formData.account_id === formData.to_account_id) {
                alert('Selecione contas de origem e destino diferentes.');
                return;
            }

            // Buscar categorias de Transferência
            const transferExpenseCategory = categories.find(c => c.name === 'Transferência' && c.type === 'expense');
            const transferIncomeCategory = categories.find(c => c.name === 'Transferência' && c.type === 'income');

            if (!transferExpenseCategory || !transferIncomeCategory) {
                alert('Erro: Categorias de "Transferência" (Receita e Despesa) não encontradas. Crie-as em Configurações.');
                return;
            }

            // 1. Saída da Origem
            const { error: errorOut } = await supabase.from('transactions').insert({
                user_id: user!.id,
                account_id: formData.account_id,
                category_id: transferExpenseCategory.id,
                type: 'expense',
                amount: formData.amount,
                transaction_date: formData.transaction_date,
                description: `Transf. para ${accounts.find(a => a.id === formData.to_account_id)?.name}: ${formData.description}`,
                status: newStatus,
            });

            if (errorOut) {
                console.error(errorOut);
                alert('Erro ao criar débito da transferência');
                return;
            }

            // 2. Entrada no Destino
            const { error: errorIn } = await supabase.from('transactions').insert({
                user_id: user!.id,
                account_id: formData.to_account_id,
                category_id: transferIncomeCategory.id,
                type: 'income',
                amount: formData.amount,
                transaction_date: formData.transaction_date,
                description: `Transf. de ${accounts.find(a => a.id === formData.account_id)?.name}: ${formData.description}`,
                status: newStatus,
            });

            if (errorIn) alert('Aviso: Erro ao criar crédito da transferência');

            // 3. Atualizar Saldos - HANDLED BY DB TRIGGER
            // if (newStatus === 'completed') { ... }

            loadData();
            closeModal();
            return;
        }

        if (editingTransaction) {
            // EDIÇÃO DE TRANSAÇÃO EXISTENTE
            // Valores antigos não são mais necessários para cálculo manual de saldo (trigger do banco resolve)

            // Atualizar transação
            const { error: updateError } = await supabase
                .from('transactions')
                .update({
                    account_id: formData.account_id,
                    category_id: formData.category_id,
                    type: formData.type,
                    amount: formData.amount,
                    transaction_date: formData.transaction_date,
                    description: formData.description,
                    status: newStatus,
                })
                .eq('id', editingTransaction.id);

            if (updateError) {
                alert('Erro ao atualizar transação');
                return;
            }

            // Ajustar saldos - HANDLED BY DB TRIGGER
            // Logic removed to prevent double counting with DB trigger
        } else {
            // CRIAÇÃO DE NOVA TRANSAÇÃO
            const { error: transactionError } = await supabase.from('transactions').insert({
                user_id: user!.id,
                account_id: formData.account_id,
                category_id: formData.category_id,
                type: formData.type,
                amount: formData.amount,
                transaction_date: formData.transaction_date,
                description: formData.description,
                status: newStatus,
            });

            if (transactionError) {
                alert('Erro ao criar transação');
                return;
            }

            // Update account balance - HANDLED BY DB TRIGGER
            // Logic removed
        }

        loadData();
        closeModal();
    };

    const handleComplete = async (transaction: Transaction) => {
        // Update transaction status
        await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', transaction.id);

        // Update account balance - HANDLED BY DB TRIGGER

        loadData();
    };

    const handleRevert = async (transaction: Transaction) => {
        if (!confirm('Reverter esta transação para "Previsto"? O saldo da conta será ajustado.')) return;

        // Update transaction status to pending
        await supabase
            .from('transactions')
            .update({ status: 'pending' })
            .eq('id', transaction.id);

        // Reverse the balance change - HANDLED BY DB TRIGGER

        loadData();
    };

    const handleDelete = async (transaction: Transaction) => {
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

        // Reverse the balance change - HANDLED BY DB TRIGGER

        // Delete transaction
        await supabase.from('transactions').delete().eq('id', transaction.id);

        loadData();
    };

    const openModal = (type: 'income' | 'expense' | 'transfer' = 'expense') => {
        setEditingTransaction(null);
        setFormData({
            type,
            account_id: accounts[0]?.id || '',
            category_id: type === 'transfer' ? '' : (categories.find((c) => c.type === type)?.id || ''),
            amount: 0,
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            description: '',
            to_account_id: '',
        });
        setShowModal(true);
    };

    const openEditModal = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setFormData({
            type: transaction.type,
            account_id: transaction.account_id,
            category_id: transaction.category_id,
            amount: transaction.amount,
            transaction_date: transaction.transaction_date,
            description: transaction.description,
            to_account_id: '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTransaction(null);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatDate = (date: string) => {
        if (!date) return '';
        const [year, month, day] = date.split('-').map(Number);
        return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
    };

    const filteredCategories = categories.filter((c) => c.type === formData.type);

    // Calcular totais APENAS de transações completadas
    const completedTransactions = transactions.filter((t) => t.status === 'completed');

    const totalIncome = completedTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = completedTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    // Calcular totais previstos
    const pendingTransactions = transactions.filter((t) => t.status === 'pending');

    const pendingIncome = pendingTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const pendingExpense = pendingTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

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
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Transações</h1>
                    <p className="text-text-secondary text-sm md:text-base">Gerencie suas receitas e despesas</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => openModal('income')}
                        className="btn-success flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-sm"
                    >
                        <ArrowUpCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Receita</span>
                    </button>
                    <button
                        onClick={() => openModal('expense')}
                        className="btn-danger flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-sm"
                    >
                        <ArrowDownCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Despesa</span>
                    </button>
                    <button
                        onClick={() => openModal('transfer')}
                        className="btn-primary flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-sm"
                    >
                        <ArrowLeftRight className="w-5 h-5" />
                        <span className="hidden md:inline">Transferência</span>
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="btn-ghost flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-sm border border-border"
                    >
                        <Download className="w-5 h-5" />
                        <span className="hidden md:inline">Importar</span>
                    </button>
                </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-center gap-4 bg-surface p-4 rounded-xl border border-border">
                <button
                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-text-secondary" />
                </button>
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="text-xl font-semibold capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                </div>
                <button
                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                >
                    <ChevronRight className="w-6 h-6 text-text-secondary" />
                </button>
            </div >

            {/* Summary Cards */}
            < div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" >
                <div className="card bg-gradient-to-br from-success to-success-hover text-white">
                    <p className="text-sm opacity-90 mb-1">Receitas Realizadas</p>
                    <p className="text-xl md:text-3xl font-bold">{formatCurrency(totalIncome)}</p>
                    {pendingIncome > 0 && (
                        <p className="text-xs opacity-75 mt-2">+ {formatCurrency(pendingIncome)} previsto</p>
                    )}
                </div>
                <div className="card bg-gradient-to-br from-danger to-danger-hover text-white">
                    <p className="text-sm opacity-90 mb-1">Despesas Realizadas</p>
                    <p className="text-xl md:text-3xl font-bold">{formatCurrency(totalExpense)}</p>
                    {pendingExpense > 0 && (
                        <p className="text-xs opacity-75 mt-2">+ {formatCurrency(pendingExpense)} previsto</p>
                    )}
                </div>
                <div className={`card bg-gradient-to-br ${balance >= 0 ? 'from-primary to-secondary' : 'from-danger to-danger-hover'} text-white`}>
                    <p className="text-sm opacity-90 mb-1">Saldo Realizado</p>
                    <p className="text-xl md:text-3xl font-bold">{formatCurrency(balance)}</p>
                </div>
                <div className="card bg-gradient-to-br from-warning to-warning-hover text-white">
                    <p className="text-sm opacity-90 mb-1">Saldo Previsto</p>
                    <p className="text-xl md:text-3xl font-bold">{formatCurrency(balance + pendingIncome - pendingExpense)}</p>
                </div>
            </div >

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Account Filter (Extrato) */}
                <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="select w-auto min-w-[200px]"
                >
                    <option value="all">Todas as Contas</option>
                    {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                            {acc.name}
                        </option>
                    ))}
                </select>

                <div className="h-8 w-px bg-surface-hover"></div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterType('income')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'income'
                            ? 'bg-success text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        Receitas
                    </button>
                    <button
                        onClick={() => setFilterType('expense')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'expense'
                            ? 'bg-danger text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        Despesas
                    </button>
                </div>

                <div className="h-8 w-px bg-surface-hover"></div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('completed')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${filterStatus === 'completed'
                            ? 'bg-success text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        <Check className="w-4 h-4" />
                        Realizadas
                    </button>
                    <button
                        onClick={() => setFilterStatus('pending')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${filterStatus === 'pending'
                            ? 'bg-warning text-white'
                            : 'bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                    >
                        <Clock className="w-4 h-4" />
                        Previstas
                    </button>
                </div>
            </div >

            {/* Transactions List */}
            < div className="space-y-4" >
                {
                    transactions.map((transaction) => (
                        <div key={transaction.id} className={`card-hover ${transaction.status === 'pending' ? 'opacity-60 border-l-4 border-warning' : ''
                            }`}>
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: transaction.category?.color + '20', color: transaction.category?.color }}
                                >
                                    {(() => {
                                        const Icon = getCategoryIcon(transaction.category?.icon || '');
                                        return <Icon className="w-5 h-5 md:w-6 md:h-6" />;
                                    })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1 md:gap-2">
                                        <h3 className="font-semibold text-sm md:text-base truncate">{transaction.description}</h3>
                                        <span
                                            className={`badge text-[10px] md:text-xs ${transaction.type === 'income'
                                                ? 'badge-success'
                                                : transaction.type === 'expense'
                                                    ? 'badge-danger'
                                                    : 'badge-primary'
                                                }`}
                                        >
                                            {transaction.category?.name}
                                        </span>
                                        {transaction.status === 'pending' && (
                                            <span className="badge badge-warning flex items-center gap-1 text-[10px] md:text-xs">
                                                <Clock className="w-3 h-3" />
                                                Previsto
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-text-muted mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                                            {formatDate(transaction.transaction_date)}
                                        </span>
                                        <span className="truncate">{transaction.account?.name}</span>
                                    </div>
                                    {/* Amount + actions row on mobile */}
                                    <div className="flex items-center justify-between mt-2">
                                        <p
                                            className={`text-lg md:text-2xl font-bold ${transaction.type === 'income' ? 'text-success' : 'text-danger'
                                                }`}
                                        >
                                            {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                                        </p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditModal(transaction)}
                                                className="p-1.5 md:p-2 hover:bg-primary hover:text-white rounded-lg transition-colors"
                                                title="Editar transação"
                                            >
                                                <Edit className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
                                            {transaction.status === 'pending' && (
                                                <button
                                                    onClick={() => handleComplete(transaction)}
                                                    className="p-1.5 md:p-2 hover:bg-success hover:text-white rounded-lg transition-colors"
                                                    title="Efetivar transação"
                                                >
                                                    <Check className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                            )}
                                            {transaction.status === 'completed' && (
                                                <button
                                                    onClick={() => handleRevert(transaction)}
                                                    className="p-1.5 md:p-2 hover:bg-warning hover:text-white rounded-lg transition-colors"
                                                    title="Reverter para previsto"
                                                >
                                                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(transaction)}
                                                className="p-1.5 md:p-2 hover:bg-danger hover:text-white rounded-lg transition-colors"
                                                title="Excluir transação"
                                            >
                                                <X className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                }

                {
                    transactions.length === 0 && (
                        <div className="card text-center py-12">
                            <ArrowLeftRight className="w-16 h-16 text-text-muted mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Nenhuma transação encontrada</h3>
                            <p className="text-text-secondary mb-4">
                                Comece adicionando uma receita ou despesa
                            </p>
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => openModal('income')} className="btn-success">
                                    Adicionar Receita
                                </button>
                                <button onClick={() => openModal('expense')} className="btn-danger">
                                    Adicionar Despesa
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="card max-w-md w-full">
                            <h2 className="text-2xl font-semibold mb-6">
                                {editingTransaction ? 'Editar' : 'Nova'} {formData.type === 'income' ? 'Receita' : 'Despesa'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="label">{formData.type === 'transfer' ? 'Conta de Origem' : 'Conta'}</label>
                                    <select
                                        value={formData.account_id}
                                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                                        className="select"
                                        required
                                    >
                                        <option value="">Selecione uma conta</option>
                                        {accounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.name} - {formatCurrency(account.balance)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.type === 'transfer' && (
                                    <div>
                                        <label className="label">Conta de Destino</label>
                                        <select
                                            value={formData.to_account_id}
                                            onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                                            className="select"
                                            required
                                        >
                                            <option value="">Selecione uma conta</option>
                                            {accounts.filter(acc => acc.id !== formData.account_id).map((account) => (
                                                <option key={account.id} value={account.id}>
                                                    {account.name} - {formatCurrency(account.balance)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formData.type !== 'transfer' && (
                                    <div>
                                        <label className="label">Categoria</label>
                                        <select
                                            value={formData.category_id}
                                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                            className="select"
                                            required
                                        >
                                            <option value="">Selecione uma categoria</option>
                                            {filteredCategories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="label">Valor</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData({ ...formData, amount: value === '' ? 0 : parseFloat(value) });
                                        }}
                                        className="input"
                                        placeholder="0.00"
                                        required
                                        min="0.01"
                                    />
                                </div>

                                <div>
                                    <label className="label">Data</label>
                                    <input
                                        type="date"
                                        value={formData.transaction_date}
                                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                        className="input"
                                        required
                                    />
                                    <p className="text-xs text-text-muted mt-1">
                                        💡 Datas futuras serão marcadas como "Previsto" e não afetarão o saldo até serem efetivadas
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Descrição</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input"
                                        placeholder="Ex: Salário, Supermercado, etc."
                                        required
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button type="submit" className={`flex-1 ${formData.type === 'income' ? 'btn-success' : 'btn-danger'}`}>
                                        {editingTransaction ? 'Atualizar' : 'Salvar'}
                                    </button>
                                    <button type="button" onClick={closeModal} className="btn-ghost flex-1">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {
                showImportModal && (
                    <ImportModal
                        onClose={() => setShowImportModal(false)}
                        accounts={accounts}
                        categories={categories}
                        userId={user!.id}
                        onImportComplete={() => {
                            loadData();
                            setShowImportModal(false);
                        }}
                    />
                )
            }
        </div >
    );
}
