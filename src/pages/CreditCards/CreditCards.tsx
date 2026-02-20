import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { CreditCard, Plus, Trash2, Receipt, DollarSign, Edit, X } from 'lucide-react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { format, addMonths, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CreditCardType = {
    id: string;
    name: string;
    due_day: number;
    card_limit: number;
    active: boolean;
};

type Purchase = {
    id: string;
    credit_card_id: string;
    category_id: string;
    total_amount: number;
    installments: number;
    purchase_date: string;
    first_due_month: string;
    description: string;
    category?: {
        name: string;
        icon: string;
        color: string;
    };
};

type Installment = {
    id: string;
    purchase_id: string;
    installment_number: number;
    amount: number;
    due_date: string;
    paid: boolean;
};

type Category = {
    id: string;
    name: string;
    icon: string;
    color: string;
};

type Account = {
    id: string;
    name: string;
    balance: number;
};

export function CreditCards() {
    const { user } = useAuth();
    const [cards, setCards] = useState<CreditCardType[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showCardModal, setShowCardModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedCard, setSelectedCard] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
    const [paymentAccount, setPaymentAccount] = useState('');

    const [cardForm, setCardForm] = useState({
        name: '',
        due_day: 10,
        card_limit: 0,
    });

    const [purchaseForm, setPurchaseForm] = useState({
        credit_card_id: '',
        category_id: '',
        total_amount: 0,
        installments: 1,
        purchase_date: format(new Date(), 'yyyy-MM-dd'),
        first_due_month: format(new Date(), 'yyyy-MM'),
        description: '',
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        await Promise.all([loadCards(), loadPurchases(), loadCategories(), loadInstallments(), loadAccounts()]);
    };

    const loadCards = async () => {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('user_id', user!.id)
            .eq('active', true)
            .order('name');

        if (!error && data) {
            setCards(data);
            if (data.length > 0 && !selectedCard) {
                setSelectedCard(data[0].id);
            }
        }
    };

    const loadPurchases = async () => {
        const { data, error } = await supabase
            .from('credit_card_purchases')
            .select(`
        *,
        category:categories(name, icon, color)
      `)
            .order('purchase_date', { ascending: false });

        if (!error && data) {
            setPurchases(data as any);
        }
    };

    const loadCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('type', 'expense')
            .order('name');

        if (!error && data) {
            setCategories(data);
        }
    };
    const loadInstallments = async () => {
        const { data, error } = await supabase
            .from('installments')
            .select('*')
            .order('due_date');

        if (!error && data) {
            setInstallments(data);
        }
    };

    const loadAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('id, name, balance')
            .eq('user_id', user!.id)
            .eq('active', true)
            .eq('type', 'checking')
            .order('name');

        if (!error && data) {
            setAccounts(data);
            if (data.length > 0) {
                setPaymentAccount(data[0].id);
            }
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const handleSaveCard = async () => {
        if (!cardForm.name || cardForm.due_day < 1 || cardForm.due_day > 31) {
            alert('Preencha todos os campos corretamente');
            return;
        }

        if (editingCard) {
            const { error } = await supabase
                .from('credit_cards')
                .update({
                    name: cardForm.name,
                    due_day: cardForm.due_day,
                    card_limit: cardForm.card_limit,
                })
                .eq('id', editingCard.id);

            if (error) {
                alert('Erro ao atualizar cartão');
                return;
            }
        } else {
            const { error } = await supabase
                .from('credit_cards')
                .insert({
                    user_id: user!.id,
                    name: cardForm.name,
                    due_day: cardForm.due_day,
                    card_limit: cardForm.card_limit,
                    active: true,
                });

            if (error) {
                alert('Erro ao criar cartão');
                return;
            }
        }

        setShowCardModal(false);
        setEditingCard(null);
        setCardForm({ name: '', due_day: 10, card_limit: 0 });
        loadCards();
    };

    const handleSavePurchase = async () => {
        if (!purchaseForm.credit_card_id || !purchaseForm.category_id || purchaseForm.total_amount <= 0) {
            alert('Preencha todos os campos corretamente');
            return;
        }

        const { data: purchaseData, error: purchaseError } = await supabase
            .from('credit_card_purchases')
            .insert({
                credit_card_id: purchaseForm.credit_card_id,
                category_id: purchaseForm.category_id,
                total_amount: purchaseForm.total_amount,
                installments: purchaseForm.installments,
                purchase_date: purchaseForm.purchase_date,
                first_due_month: `${purchaseForm.first_due_month}-01`,
                description: purchaseForm.description,
            })
            .select()
            .single();

        if (purchaseError || !purchaseData) {
            alert('Erro ao criar compra');
            return;
        }

        const installmentAmount = purchaseForm.total_amount / purchaseForm.installments;
        const firstDueDate = parseISO(`${purchaseForm.first_due_month}-01`);

        const installmentsToCreate = [];
        for (let i = 0; i < purchaseForm.installments; i++) {
            const dueDate = addMonths(firstDueDate, i);
            installmentsToCreate.push({
                purchase_id: purchaseData.id,
                installment_number: i + 1,
                amount: installmentAmount,
                due_date: format(dueDate, 'yyyy-MM-dd'),
                paid: false,
            });
        }

        const { error: installmentsError } = await supabase
            .from('installments')
            .insert(installmentsToCreate);

        if (installmentsError) {
            alert('Erro ao criar parcelas');
            return;
        }

        setShowPurchaseModal(false);
        setPurchaseForm({
            credit_card_id: '',
            category_id: '',
            total_amount: 0,
            installments: 1,
            purchase_date: format(new Date(), 'yyyy-MM-dd'),
            first_due_month: format(new Date(), 'yyyy-MM'),
            description: '',
        });
        loadPurchases();
    };

    const handleDeleteCard = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este cartão?')) return;

        const { error } = await supabase
            .from('credit_cards')
            .update({ active: false })
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir cartão');
            return;
        }

        loadCards();
    };

    const handleDeletePurchase = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta compra?')) return;

        const { error } = await supabase
            .from('credit_card_purchases')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir compra');
            return;
        }

        loadPurchases();
    };

    const openCardModal = (card?: CreditCardType) => {
        if (card) {
            setEditingCard(card);
            setCardForm({
                name: card.name,
                due_day: card.due_day,
                card_limit: card.card_limit,
            });
        } else {
            setEditingCard(null);
            setCardForm({ name: '', due_day: 10, card_limit: 0 });
        }
        setShowCardModal(true);
    };

    const openPurchaseModal = () => {
        setPurchaseForm({
            credit_card_id: selectedCard || cards[0]?.id || '',
            category_id: categories[0]?.id || '',
            total_amount: 0,
            installments: 1,
            purchase_date: format(new Date(), 'yyyy-MM-dd'),
            first_due_month: format(new Date(), 'yyyy-MM'),
            description: '',
        });
        setShowPurchaseModal(true);
    };

    const handlePayInvoice = async () => {
        if (!paymentAccount || !selectedCard) {
            alert('Selecione uma conta para pagamento');
            return;
        }

        // Buscar parcelas do mês selecionado que não foram pagas
        const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
        const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

        const monthInstallments = installments.filter((inst) => {
            const dueDate = parseISO(inst.due_date);
            // Buscar compras deste cartão
            const purchase = purchases.find(p => p.id === inst.purchase_id);
            return (
                purchase?.credit_card_id === selectedCard &&
                !inst.paid &&
                dueDate >= monthStart &&
                dueDate <= monthEnd
            );
        });

        if (monthInstallments.length === 0) {
            alert('Não há parcelas pendentes neste mês');
            return;
        }

        const totalAmount = monthInstallments.reduce((sum, inst) => sum + inst.amount, 0);

        // Buscar categoria padrão de "Cartão de Crédito"
        const { data: categoryData } = await supabase
            .from('categories')
            .select('id')
            .eq('name', 'Cartão de Crédito')
            .single();

        // Criar transação de despesa
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: user!.id,
                account_id: paymentAccount,
                category_id: categoryData?.id || categories[0]?.id,
                type: 'expense',
                amount: totalAmount,
                transaction_date: format(new Date(), 'yyyy-MM-dd'),
                description: `Pagamento fatura ${cards.find(c => c.id === selectedCard)?.name} - ${format(monthStart, 'MM/yyyy', { locale: ptBR })}`,
                status: 'completed',
            });

        if (transactionError) {
            alert('Erro ao criar transação');
            return;
        }

        // Atualizar saldo da conta
        const account = accounts.find(a => a.id === paymentAccount);
        if (account) {
            const { error: balanceError } = await supabase
                .from('accounts')
                .update({ balance: account.balance - totalAmount })
                .eq('id', paymentAccount);

            if (balanceError) {
                alert('Erro ao atualizar saldo');
                return;
            }
        }

        // Marcar parcelas como pagas
        const installmentIds = monthInstallments.map(inst => inst.id);
        const { error: installmentError } = await supabase
            .from('installments')
            .update({ paid: true })
            .in('id', installmentIds);

        if (installmentError) {
            alert('Erro ao marcar parcelas como pagas');
            return;
        }

        alert(`Fatura paga com sucesso! Total: ${formatCurrency(totalAmount)}`);
        setShowPaymentModal(false);
        loadData();
    };

    // Calcular fatura do mês selecionado
    const getMonthInvoice = () => {
        if (!selectedCard) return { installments: [], total: 0 };

        const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
        const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));

        const monthInstallments = installments.filter((inst) => {
            const dueDate = parseISO(inst.due_date);
            const purchase = purchases.find(p => p.id === inst.purchase_id);
            return (
                purchase?.credit_card_id === selectedCard &&
                !inst.paid &&
                dueDate >= monthStart &&
                dueDate <= monthEnd
            );
        });

        const total = monthInstallments.reduce((sum, inst) => sum + inst.amount, 0);
        return { installments: monthInstallments, total };
    };

    const selectedCardPurchases = purchases.filter(p => p.credit_card_id === selectedCard);
    const monthInvoice = getMonthInvoice();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
                        <CreditCard className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                        Cartões de Crédito
                    </h1>
                    <p className="text-text-secondary text-sm md:text-base">Gerencie seus cartões e compras</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => openCardModal()}
                        className="btn-primary flex items-center gap-1 md:gap-2 text-sm"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden md:inline">Novo Cartão</span>
                    </button>
                    <button
                        onClick={openPurchaseModal}
                        className="btn-secondary flex items-center gap-1 md:gap-2 text-sm"
                        disabled={cards.length === 0}
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden md:inline">Nova Compra</span>
                    </button>
                </div>
            </div>

            {cards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((card) => (
                        <div
                            key={card.id}
                            className={`card cursor-pointer transition-all ${selectedCard === card.id ? 'ring-2 ring-primary' : ''
                                }`}
                            onClick={() => setSelectedCard(card.id)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{card.name}</h3>
                                        <p className="text-sm text-text-muted">Venc. dia {card.due_day}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openCardModal(card);
                                        }}
                                        className="p-1 hover:bg-surface-hover rounded"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCard(card.id);
                                        }}
                                        className="p-1 hover:bg-danger/20 rounded text-danger"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Limite</span>
                                    <span className="font-semibold">{formatCurrency(card.card_limit)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card text-center py-12">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 text-text-muted" />
                    <p className="text-text-muted mb-4">Nenhum cartão cadastrado</p>
                    <button onClick={() => openCardModal()} className="btn-primary">
                        <Plus className="w-5 h-5" />
                        Adicionar Primeiro Cartão
                    </button>
                </div>
            )}

            {/* Purchases Section */}
            {selectedCard && (
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Compras</h2>
                    {selectedCardPurchases.length > 0 ? (
                        <div className="space-y-2">
                            {selectedCardPurchases.map((purchase) => (
                                <div
                                    key={purchase.id}
                                    className="p-3 md:p-4 rounded-lg bg-surface-hover hover:bg-surface transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: purchase.category?.color + '20', color: purchase.category?.color }}
                                        >
                                            {(() => {
                                                const Icon = getCategoryIcon(purchase.category?.icon || '');
                                                return <Icon className="w-5 h-5" />;
                                            })()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm md:text-base">{purchase.description}</p>
                                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-text-secondary mt-1">
                                                <span>{purchase.category?.name}</span>
                                                <span className="hidden md:inline">•</span>
                                                <span>{format(parseISO(purchase.purchase_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                                                <span className="hidden md:inline">•</span>
                                                <span>{purchase.installments}x de {formatCurrency(purchase.total_amount / purchase.installments)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div>
                                                    <p className="text-base md:text-lg font-bold">{formatCurrency(purchase.total_amount)}</p>
                                                    <p className="text-xs text-text-muted">
                                                        1ª parcela: {format(parseISO(purchase.first_due_month), 'MM/yyyy', { locale: ptBR })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeletePurchase(purchase.id)}
                                                    className="p-2 hover:bg-danger/20 rounded text-danger"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-text-muted">
                            <p>Nenhuma compra registrada neste cartão</p>
                        </div>
                    )}
                </div>
            )}

            {/* Invoice Section */}
            {selectedCard && (
                <div className="card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Receipt className="w-5 h-5" />
                            Fatura do Mês
                        </h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="month"
                                className="input"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            />
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="btn-primary"
                                disabled={monthInvoice.total === 0}
                            >
                                <DollarSign className="w-5 h-5" />
                                Pagar Fatura
                            </button>
                        </div>
                    </div>

                    {monthInvoice.total > 0 ? (
                        <div className="p-6 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-secondary mb-1">Total a pagar</p>
                                    <p className="text-3xl font-bold text-primary">
                                        {formatCurrency(monthInvoice.total)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-text-secondary mb-1">Parcelas</p>
                                    <p className="text-2xl font-semibold">
                                        {monthInvoice.installments.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-text-muted bg-surface-hover rounded-lg">
                            <p>Nenhuma fatura pendente para este mês</p>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Pagar Fatura</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-surface-hover rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                                <p className="text-sm text-text-secondary mb-1">Valor total da fatura</p>
                                <p className="text-3xl font-bold text-primary">
                                    {formatCurrency(monthInvoice.total)}
                                </p>
                                <p className="text-sm text-text-muted mt-2">
                                    {monthInvoice.installments.length} parcela(s) pendente(s)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Pagar com a conta</label>
                                <select
                                    className="input"
                                    value={paymentAccount}
                                    onChange={(e) => setPaymentAccount(e.target.value)}
                                >
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.name} - {formatCurrency(account.balance)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button onClick={handlePayInvoice} className="btn-primary flex-1">
                                    Confirmar Pagamento
                                </button>
                                <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCardModal && (
                <div className="modal-overlay" onClick={() => setShowCardModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">
                                {editingCard ? 'Editar Cartão' : 'Novo Cartão'}
                            </h2>
                            <button onClick={() => setShowCardModal(false)} className="p-2 hover:bg-surface-hover rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Nome do Cartão</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={cardForm.name}
                                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                                    placeholder="Ex: Nubank, Inter, C6"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Dia de Vencimento</label>
                                <input
                                    type="number"
                                    className="input"
                                    min="1"
                                    max="31"
                                    value={cardForm.due_day}
                                    onChange={(e) => setCardForm({ ...cardForm, due_day: parseInt(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Limite</label>
                                <input
                                    type="number"
                                    className="input"
                                    step="0.01"
                                    value={cardForm.card_limit}
                                    onChange={(e) => setCardForm({ ...cardForm, card_limit: parseFloat(e.target.value) })}
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button onClick={handleSaveCard} className="btn-primary flex-1">
                                    {editingCard ? 'Atualizar' : 'Criar'} Cartão
                                </button>
                                <button onClick={() => setShowCardModal(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPurchaseModal && (
                <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Nova Compra</h2>
                            <button onClick={() => setShowPurchaseModal(false)} className="p-2 hover:bg-surface-hover rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Cartão</label>
                                <select
                                    className="input"
                                    value={purchaseForm.credit_card_id}
                                    onChange={(e) => setPurchaseForm({ ...purchaseForm, credit_card_id: e.target.value })}
                                >
                                    {cards.map((card) => (
                                        <option key={card.id} value={card.id}>
                                            {card.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Categoria</label>
                                <select
                                    className="input"
                                    value={purchaseForm.category_id}
                                    onChange={(e) => setPurchaseForm({ ...purchaseForm, category_id: e.target.value })}
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Descrição</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={purchaseForm.description}
                                    onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                                    placeholder="Ex: Compra na Amazon"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Valor Total</label>
                                    <input
                                        type="number"
                                        className="input"
                                        step="0.01"
                                        value={purchaseForm.total_amount}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, total_amount: parseFloat(e.target.value) })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Parcelas</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min="1"
                                        max="48"
                                        value={purchaseForm.installments}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, installments: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Data da Compra</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={purchaseForm.purchase_date}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">1ª Parcela (Mês/Ano)</label>
                                    <input
                                        type="month"
                                        className="input"
                                        value={purchaseForm.first_due_month}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, first_due_month: e.target.value })}
                                    />
                                </div>
                            </div>

                            {purchaseForm.total_amount > 0 && purchaseForm.installments > 0 && (
                                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                                    <p className="text-sm text-text-secondary mb-1">Valor de cada parcela:</p>
                                    <p className="text-2xl font-bold text-primary">
                                        {formatCurrency(purchaseForm.total_amount / purchaseForm.installments)}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button onClick={handleSavePurchase} className="btn-primary flex-1">
                                    Registrar Compra
                                </button>
                                <button onClick={() => setShowPurchaseModal(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
