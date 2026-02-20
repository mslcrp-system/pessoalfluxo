import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, TrendingUp, Wallet } from 'lucide-react';
import { getCategoryIcon } from '../../utils/categoryIcons';

type Account = {
    id: string;
    name: string;
    type: string;
    balance: number;
    initial_balance: number;
};

type Transaction = {
    id: string;
    account_id: string;
    category_id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    transaction_date: string;
    description: string;
    status: 'pending' | 'completed';
    account?: { name: string };
    category?: { name: string; color: string; icon: string };
};

export function Extrato() {
    const { user } = useAuth();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedAccount, setSelectedAccount] = useState<string>('all');

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        await Promise.all([loadAccounts(), loadAllTransactions()]);
        setLoading(false);
    };

    const loadAccounts = async () => {
        const { data } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user!.id)
            .eq('active', true)
            .order('name');
        if (data) setAccounts(data);
    };

    const loadAllTransactions = async () => {
        const { data } = await supabase
            .from('transactions')
            .select(`
                *,
                account:accounts(name),
                category:categories(name, color, icon)
            `)
            .eq('user_id', user!.id)
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true });
        if (data) setAllTransactions(data as any);
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatDate = (date: string) => {
        const [year, month, day] = date.split('-').map(Number);
        return format(new Date(year, month - 1, day), "dd/MM/yyyy", { locale: ptBR });
    };

    // ====================================================
    // CÁLCULO DO EXTRATO (DFC)
    // ====================================================
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Transações filtradas por conta (se selecionada)
    const filteredByAccount = selectedAccount === 'all'
        ? allTransactions
        : allTransactions.filter(t => t.account_id === selectedAccount);

    // Saldo inicial = saldo_inicial da(s) conta(s) + tudo que aconteceu ANTES do mês selecionado
    const accountsInScope = selectedAccount === 'all'
        ? accounts
        : accounts.filter(a => a.id === selectedAccount);

    const baseInitialBalance = accountsInScope.reduce((s, a) => s + (a.initial_balance ?? a.balance), 0);

    const transactionsBeforeMonth = filteredByAccount.filter(t => {
        const d = parseISO(t.transaction_date);
        return d < monthStart && t.status === 'completed';
    });

    const movBeforeIncome = transactionsBeforeMonth
        .filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const movBeforeExpense = transactionsBeforeMonth
        .filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const openingBalance = baseInitialBalance + movBeforeIncome - movBeforeExpense;

    // Transações do mês selecionado
    const monthTransactions = filteredByAccount.filter(t => {
        const d = parseISO(t.transaction_date);
        return d >= monthStart && d <= monthEnd;
    });

    const completedMonth = monthTransactions.filter(t => t.status === 'completed');
    const pendingMonth = monthTransactions.filter(t => t.status === 'pending');

    const monthIncome = completedMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = completedMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const pendingIncome = pendingMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const pendingExpense = pendingMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const closingBalance = openingBalance + monthIncome - monthExpense;
    const projectedBalance = closingBalance + pendingIncome - pendingExpense;

    // Agrupar transações do mês por data para exibição
    const transactionsByDate: Record<string, Transaction[]> = {};
    monthTransactions.forEach(t => {
        if (!transactionsByDate[t.transaction_date]) {
            transactionsByDate[t.transaction_date] = [];
        }
        transactionsByDate[t.transaction_date].push(t);
    });
    const sortedDates = Object.keys(transactionsByDate).sort();

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-1">Extrato</h1>
                    <p className="text-text-secondary text-sm md:text-base">Fluxo de Caixa por Conta e Período</p>
                </div>
            </div>

            {/* Filtros: Conta + Mês */}
            <div className="card flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
                {/* Seletor de conta */}
                <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-text-secondary" />
                    <select
                        value={selectedAccount}
                        onChange={e => setSelectedAccount(e.target.value)}
                        className="select w-full sm:w-auto sm:min-w-[200px]"
                    >
                        <option value="all">Todas as Contas</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="hidden sm:block h-8 w-px bg-surface-hover"></div>

                {/* Navegação de mês */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-text-secondary" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-lg font-semibold capitalize min-w-[150px] text-center">
                            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                        </span>
                    </div>
                    <button
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>
            </div>

            {/* Cards de DFC */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                {/* Saldo de Abertura */}
                <div className="card border-l-4 border-primary">
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wide">Saldo de Abertura</p>
                    <p className={`text-lg md:text-2xl font-bold ${openingBalance < 0 ? 'text-danger' : ''}`}>
                        {formatCurrency(openingBalance)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Início do mês</p>
                </div>

                {/* Entradas */}
                <div className="card border-l-4 border-success">
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wide">Entradas Realizadas</p>
                    <p className="text-lg md:text-2xl font-bold text-success">+{formatCurrency(monthIncome)}</p>
                    {pendingIncome > 0 && (
                        <p className="text-xs text-text-muted mt-1">+ {formatCurrency(pendingIncome)} previsto</p>
                    )}
                </div>

                {/* Saídas */}
                <div className="card border-l-4 border-danger">
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wide">Saídas Realizadas</p>
                    <p className="text-lg md:text-2xl font-bold text-danger">-{formatCurrency(monthExpense)}</p>
                    {pendingExpense > 0 && (
                        <p className="text-xs text-text-muted mt-1">+ {formatCurrency(pendingExpense)} previsto</p>
                    )}
                </div>

                {/* Saldo de Fechamento */}
                <div className={`card border-l-4 ${closingBalance >= 0 ? 'border-success' : 'border-danger'}`}>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wide">Saldo de Fechamento</p>
                    <p className={`text-lg md:text-2xl font-bold ${closingBalance < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatCurrency(closingBalance)}
                    </p>
                    {pendingIncome > 0 || pendingExpense > 0 ? (
                        <p className="text-xs text-text-muted mt-1">
                            Projetado: {formatCurrency(projectedBalance)}
                        </p>
                    ) : null}
                </div>
            </div>

            {/* Fórmula do DFC */}
            <div className="card bg-surface-hover">
                <div className="flex flex-wrap items-center gap-2 text-sm justify-center">
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{formatCurrency(openingBalance)}</span>
                        <span className="text-text-muted">(abertura)</span>
                    </div>
                    <span className="text-success text-lg font-bold">+</span>
                    <div className="flex items-center gap-1">
                        <ArrowUpCircle className="w-4 h-4 text-success" />
                        <span className="font-semibold text-success">{formatCurrency(monthIncome)}</span>
                    </div>
                    <span className="text-danger text-lg font-bold">−</span>
                    <div className="flex items-center gap-1">
                        <ArrowDownCircle className="w-4 h-4 text-danger" />
                        <span className="font-semibold text-danger">{formatCurrency(monthExpense)}</span>
                    </div>
                    <span className="text-lg">=</span>
                    <div className="flex items-center gap-1">
                        <span className={`text-lg font-bold ${closingBalance < 0 ? 'text-danger' : 'text-success'}`}>
                            {formatCurrency(closingBalance)}
                        </span>
                        <span className="text-text-muted">(fechamento)</span>
                    </div>
                </div>
            </div>

            {/* Lista de Movimentações */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Movimentações do Mês</h2>

                {sortedDates.length === 0 ? (
                    <div className="card text-center py-12 text-text-muted">
                        <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p>Nenhuma movimentação neste período</p>
                    </div>
                ) : (
                    sortedDates.map(date => {
                        const dayTransactions = transactionsByDate[date];

                        // Saldo acumulado até esta data (calculado a partir do saldo de abertura)
                        const transUntilDate = completedMonth.filter(
                            t => parseISO(t.transaction_date) <= parseISO(date)
                        );
                        const incomeUntil = transUntilDate.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                        const expenseUntil = transUntilDate.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                        const runningBalance = openingBalance + incomeUntil - expenseUntil;

                        return (
                            <div key={date} className="space-y-2">
                                {/* Cabeçalho do grupo de data */}
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-sm font-semibold text-text-secondary">{formatDate(date)}</span>
                                    <span className={`text-sm font-semibold ${runningBalance < 0 ? 'text-danger' : 'text-text-secondary'}`}>
                                        Saldo: {formatCurrency(runningBalance)}
                                    </span>
                                </div>

                                {dayTransactions.map(transaction => {
                                    const Icon = getCategoryIcon(transaction.category?.icon || '');
                                    return (
                                        <div
                                            key={transaction.id}
                                            className={`card-hover ${transaction.status === 'pending' ? 'opacity-60 border-l-4 border-warning' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{
                                                        backgroundColor: (transaction.category?.color ?? '#94a3b8') + '20',
                                                        color: transaction.category?.color ?? '#94a3b8'
                                                    }}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{transaction.description}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-text-muted">{transaction.category?.name}</span>
                                                        {selectedAccount === 'all' && transaction.account && (
                                                            <>
                                                                <span className="text-xs text-text-muted">·</span>
                                                                <span className="text-xs text-text-muted">{transaction.account.name}</span>
                                                            </>
                                                        )}
                                                        {transaction.status === 'pending' && (
                                                            <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Previsto</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className={`text-base md:text-lg font-bold shrink-0 ${transaction.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                                    {transaction.type === 'income' ? '+' : '-'}
                                                    {formatCurrency(transaction.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
