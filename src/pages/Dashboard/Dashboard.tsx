import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    CreditCard,
    ArrowUpCircle,
    ArrowDownCircle,
    Calendar
} from 'lucide-react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { format, startOfMonth, endOfMonth, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    transaction_date: string;
    status: 'pending' | 'completed';
    category?: {
        name: string;
        color: string;
        icon: string;
    };
};

export function Dashboard() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        await Promise.all([loadAccounts(), loadTransactions()]);
        setLoading(false);
    };

    const loadAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user!.id)
            .eq('active', true);

        if (!error && data) {
            setAccounts(data);
        }
    };

    const loadTransactions = async () => {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
        *,
        category:categories(name, color, icon)
      `)
            .eq('user_id', user!.id)
            .order('transaction_date', { ascending: false });

        if (!error && data) {
            setTransactions(data as any);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // ====================================================
    // SALDO REAL = saldo_inicial + todas as transações realizadas
    // ====================================================
    const completedTransactions = transactions.filter(t => t.status === 'completed');

    // Saldo calculado por conta (não depende do campo balance do banco)
    const accountsWithRealBalance = accounts.map(acc => {
        const accTransactions = completedTransactions.filter(t => t.account_id === acc.id);
        const income = accTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = accTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const realBalance = (acc.initial_balance ?? acc.balance) + income - expense;
        return { ...acc, realBalance };
    });

    const totalRealBalance = accountsWithRealBalance.reduce((s, a) => s + a.realBalance, 0);

    // Transações do mês atual (apenas completed)
    const currentMonth = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const currentMonthTransactions = completedTransactions.filter((t) => {
        const date = parseISO(t.transaction_date);
        return date >= monthStart && date <= monthEnd;
    });

    const monthIncome = currentMonthTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthExpense = currentMonthTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthBalance = monthIncome - monthExpense;

    // Dados para gráfico de fluxo de caixa semanal (últimas 4 semanas)
    const today = new Date();

    const weeks = [];
    for (let i = 3; i >= 0; i--) {
        const weekEnd = subDays(today, i * 7);
        const weekStart = subDays(weekEnd, 6);
        weeks.push({ start: weekStart, end: weekEnd });
    }

    const weeklyData = weeks.map(({ start, end }) => {
        const weekTransactions = completedTransactions.filter((t) => {
            const date = parseISO(t.transaction_date);
            return date >= start && date <= end;
        });

        const income = weekTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = weekTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            week: `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM', { locale: ptBR })}`,
            receitas: income,
            despesas: expense,
            saldo: income - expense,
        };
    });

    // Dados para gráfico de gastos por categoria
    const categoryData: { [key: string]: { amount: number; color: string; icon: string } } = {};

    currentMonthTransactions
        .filter((t) => t.type === 'expense' && t.category)
        .forEach((t) => {
            const categoryName = t.category!.name;
            if (!categoryData[categoryName]) {
                categoryData[categoryName] = {
                    amount: 0,
                    color: t.category!.color,
                    icon: t.category!.icon,
                };
            }
            categoryData[categoryName].amount += t.amount;
        });

    const categoryChartData = Object.entries(categoryData)
        .map(([name, data]) => ({
            name,
            value: data.amount,
            color: data.color,
            icon: data.icon,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

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
            <div>
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-text-secondary">Visão geral das suas finanças</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-primary to-secondary text-white">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm opacity-90">Saldo Total Atual</p>
                        <Wallet className="w-5 h-5 opacity-75" />
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(totalRealBalance)}</p>
                    <p className="text-xs opacity-75 mt-2">{accounts.length} conta(s) ativa(s)</p>
                </div>

                <div className="card bg-gradient-to-br from-success to-success-hover text-white">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm opacity-90">Receitas do Mês</p>
                        <ArrowUpCircle className="w-5 h-5 opacity-75" />
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(monthIncome)}</p>
                    <p className="text-xs opacity-75 mt-2">
                        {currentMonthTransactions.filter((t) => t.type === 'income').length} transação(ões)
                    </p>
                </div>

                <div className="card bg-gradient-to-br from-danger to-danger-hover text-white">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm opacity-90">Despesas do Mês</p>
                        <ArrowDownCircle className="w-5 h-5 opacity-75" />
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(monthExpense)}</p>
                    <p className="text-xs opacity-75 mt-2">
                        {currentMonthTransactions.filter((t) => t.type === 'expense').length} transação(ões)
                    </p>
                </div>

                <div className={`card bg-gradient-to-br ${monthBalance >= 0
                    ? 'from-success to-success-hover'
                    : 'from-danger to-danger-hover'
                    } text-white`}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm opacity-90">Saldo do Mês</p>
                        {monthBalance >= 0 ? (
                            <TrendingUp className="w-5 h-5 opacity-75" />
                        ) : (
                            <TrendingDown className="w-5 h-5 opacity-75" />
                        )}
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(monthBalance)}</p>
                    <p className="text-xs opacity-75 mt-2">
                        {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fluxo de Caixa Semanal */}
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Fluxo de Caixa Semanal
                    </h2>
                    {weeklyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--surface-hover))" />
                                <XAxis dataKey="week" tick={{ fontSize: 14, fill: '#94a3b8' }} />
                                <YAxis
                                    tick={{ fontSize: 14, fill: '#94a3b8' }}
                                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'oklch(var(--surface))',
                                        border: '1px solid oklch(var(--surface-hover))',
                                        borderRadius: '8px',
                                        color: 'oklch(var(--text-primary))',
                                    }}
                                    formatter={(value) => value ? formatCurrency(value as number) : 'R$ 0,00'}
                                />
                                <Legend />
                                <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-text-muted">
                            Nenhuma transação nas últimas 4 semanas
                        </div>
                    )}
                </div>

                {/* Gastos por Categoria */}
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <PiggyBank className="w-5 h-5" />
                        Gastos por Categoria
                    </h2>
                    {categoryChartData.length > 0 ? (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="50%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={categoryChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {categoryChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'oklch(var(--surface))',
                                            border: '1px solid oklch(var(--surface-hover))',
                                            borderRadius: '8px',
                                            color: 'oklch(var(--text-primary))',
                                        }}
                                        formatter={(value) => value ? formatCurrency(value as number) : 'R$ 0,00'}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {categoryChartData.map((cat, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: cat.color }}
                                            ></div>
                                            {(() => {
                                                const Icon = getCategoryIcon(cat.icon);
                                                return <Icon className="w-4 h-4" />;
                                            })()}
                                            <span className="text-sm">{cat.name}</span>
                                        </div>
                                        <span className="text-sm font-semibold">{formatCurrency(cat.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-text-muted">
                            Nenhuma despesa registrada este mês
                        </div>
                    )}
                </div>
            </div>

            {/* Evolução do Saldo */}
            <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Evolução do Saldo (Últimos 30 dias)
                </h2>
                {transactions.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={generateBalanceHistory()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--surface-hover))" />
                            <XAxis dataKey="date" tick={{ fontSize: 14, fill: '#94a3b8' }} interval="preserveStartEnd" />
                            <YAxis
                                tick={{ fontSize: 14, fill: '#94a3b8' }}
                                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'oklch(var(--surface))',
                                    border: '1px solid oklch(var(--surface-hover))',
                                    borderRadius: '8px',
                                    color: 'oklch(var(--text-primary))',
                                }}
                                formatter={(value) => value ? formatCurrency(value as number) : 'R$ 0,00'}
                            />
                            <Line
                                type="monotone"
                                dataKey="saldo"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', r: 3 }}
                                activeDot={{ r: 5 }}
                                name="Saldo"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-64 flex items-center justify-center text-text-muted">
                        Nenhuma transação registrada
                    </div>
                )}
            </div>

            {/* Contas com Saldo Real */}
            <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Suas Contas
                </h2>
                {accountsWithRealBalance.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accountsWithRealBalance.map((account) => (
                            <div
                                key={account.id}
                                className="p-4 rounded-lg bg-surface-hover border border-surface-hover hover:border-primary transition-colors"
                            >
                                <p className="text-sm text-text-secondary mb-1">{account.name}</p>
                                <p className={`text-2xl font-bold ${account.realBalance < 0 ? 'text-danger' : ''}`}>
                                    {formatCurrency(account.realBalance)}
                                </p>
                                <div className="flex justify-between mt-2">
                                    <p className="text-xs text-text-muted">
                                        {account.type === 'checking' ? 'Conta Corrente' : 'Investimento'}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        Inicial: {formatCurrency(account.initial_balance ?? account.balance)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-text-muted">
                        Nenhuma conta cadastrada
                    </div>
                )}
            </div>
        </div>
    );

    function generateBalanceHistory() {
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 29);
        const initialTotal = accounts.reduce((s, a) => s + (a.initial_balance ?? a.balance), 0);

        const allDays = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
        const sampledDays = allDays.filter((_, index) =>
            index === 0 ||
            index === allDays.length - 1 ||
            index % 3 === 0
        );

        return sampledDays.map((date) => {
            const transactionsUntilDate = completedTransactions.filter((t) => {
                const tDate = parseISO(t.transaction_date);
                return tDate <= date;
            });

            const income = transactionsUntilDate
                .filter((t) => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const expense = transactionsUntilDate
                .filter((t) => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            return {
                date: format(date, 'dd/MM', { locale: ptBR }),
                saldo: initialTotal + income - expense,
            };
        });
    }
}
