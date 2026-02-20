
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
    PieChart, TrendingUp, Plus, DollarSign,
    Trash2, Edit
} from 'lucide-react';
import { AssetFormModal, Investment } from './components/AssetFormModal';
import { OperationModal } from './components/OperationModal';


export function Investments() {
    const { user } = useAuth();
    const [investments, setInvestments] = useState<Investment[]>([]);
    // const [loading, setLoading] = useState(true);
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Investment | null>(null);
    const [showOperationModal, setShowOperationModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Investment | null>(null);

    const handleOperation = (asset: Investment) => {
        setSelectedAsset(asset);
        setShowOperationModal(true);
    };

    useEffect(() => {
        if (user) {
            loadInvestments();
        }
    }, [user]);

    const loadInvestments = async () => {
        try {
            // setLoading(true);
            const { data, error } = await supabase
                .from('investments')
                .select('*')
                .order('type')
                .order('name');

            if (error) throw error;
            setInvestments(data || []);
        } catch (error) {
            console.error('Error loading investments:', error);
            alert('Erro ao carregar investimentos.');
        } finally {
            // setLoading(false);
        }
    };

    const handleEditAsset = (asset: Investment) => {
        setEditingAsset(asset);
        setShowAssetModal(true);
    };

    const handleDeleteAsset = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este ativo? O histórico de transações também será apagado.')) return;

        try {
            const { error } = await supabase
                .from('investments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadInvestments();
        } catch (error) {
            console.error('Error deleting investment:', error);
            alert('Erro ao excluir ativo.');
        }
    };

    const handleCloseModal = () => {
        setShowAssetModal(false);
        setEditingAsset(null);
    };

    // Calculate totals
    const totalInvested = investments.reduce((sum, inv) => sum + (inv.quantity * inv.average_price), 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + (inv.quantity * inv.current_price), 0);
    const totalProfit = totalCurrent - totalInvested;
    const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            stock: 'Ações',
            fii: 'FIIs',
            fixed_income: 'Renda Fixa',
            treasure: 'Tesouro Direto',
            crypto: 'Cripto',
            other: 'Outros'
        };
        return labels[type] || type;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-primary" />
                        Investimentos
                    </h1>
                    <p className="text-text-secondary">Gerencie sua carteira de ativos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setEditingAsset(null); setShowAssetModal(true); }}
                        className="btn-primary"
                    >
                        <Plus className="w-5 h-5" /> Novo Ativo
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-gradient-to-br from-surface to-surface-hover">
                    <p className="text-sm text-text-secondary mb-1">Total Investido (Custo)</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card bg-gradient-to-br from-surface to-surface-hover">
                    <p className="text-sm text-text-secondary mb-1">Saldo Atual (Estimado)</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalCurrent)}</p>
                </div>
                <div className={`card bg-gradient-to-br ${totalProfit >= 0 ? 'from-success/10 to-success/20' : 'from-danger/10 to-danger/20'}`}>
                    <p className="text-sm text-text-secondary mb-1">Rentabilidade Estimada</p>
                    <div className="flex items-center gap-2">
                        <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                        </p>
                        <span className={`text-sm px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                            {profitPercentage.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Assets List */}
            {investments.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {/* Group by type logic could go here, for now simple list */}
                    {/* Desktop table - hidden on mobile */}
                    <div className="card overflow-hidden p-0 hidden md:block">
                        <table className="w-full">
                            <thead className="bg-surface-hover">
                                <tr>
                                    <th className="p-4 text-left text-sm font-semibold text-text-secondary">Ativo</th>
                                    <th className="p-4 text-left text-sm font-semibold text-text-secondary">Tipo</th>
                                    <th className="p-4 text-right text-sm font-semibold text-text-secondary">Qtd</th>
                                    <th className="p-4 text-right text-sm font-semibold text-text-secondary">Preço Médio</th>
                                    <th className="p-4 text-right text-sm font-semibold text-text-secondary">Preço Atual</th>
                                    <th className="p-4 text-right text-sm font-semibold text-text-secondary">Total</th>
                                    <th className="p-4 text-right text-sm font-semibold text-text-secondary">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {investments.map((asset) => {
                                    const total = asset.quantity * asset.current_price;
                                    const cost = asset.quantity * asset.average_price;
                                    const profit = total - cost;

                                    return (
                                        <tr key={asset.id} className="hover:bg-surface-hover/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-semibold">{asset.ticker || asset.name}</div>
                                                <div className="text-xs text-text-secondary">{asset.name}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="badge badge-secondary text-xs">
                                                    {getTypeLabel(asset.type)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono">
                                                {asset.quantity}
                                            </td>
                                            <td className="p-4 text-right font-mono text-text-secondary">
                                                {formatCurrency(asset.average_price)}
                                            </td>
                                            <td className="p-4 text-right font-mono">
                                                {formatCurrency(asset.current_price)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="font-bold">{formatCurrency(total)}</div>
                                                <div className={`text-xs ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOperation(asset)}
                                                        className="p-2 hover:bg-surface-hover rounded text-success"
                                                        title="Nova Operação"
                                                    >
                                                        <DollarSign className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditAsset(asset)}
                                                        className="p-2 hover:bg-surface-hover rounded text-primary"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAsset(asset.id)}
                                                        className="p-2 hover:bg-surface-hover rounded text-danger"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card view - hidden on desktop */}
                    <div className="md:hidden space-y-3">
                        {investments.map((asset) => {
                            const total = asset.quantity * asset.current_price;
                            const cost = asset.quantity * asset.average_price;
                            const profit = total - cost;

                            return (
                                <div key={asset.id} className="card">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold">{asset.ticker || asset.name}</h3>
                                            <p className="text-xs text-text-secondary">{asset.name}</p>
                                        </div>
                                        <span className="badge badge-secondary text-xs">
                                            {getTypeLabel(asset.type)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                            <p className="text-xs text-text-secondary">Qtd</p>
                                            <p className="font-mono">{asset.quantity}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-secondary">PM</p>
                                            <p className="font-mono">{formatCurrency(asset.average_price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-secondary">Atual</p>
                                            <p className="font-mono">{formatCurrency(asset.current_price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-secondary">Total</p>
                                            <p className="font-bold">{formatCurrency(total)}</p>
                                            <p className={`text-xs ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 border-t border-surface-hover pt-3">
                                        <button
                                            onClick={() => handleOperation(asset)}
                                            className="flex-1 p-2 bg-success/10 hover:bg-success/20 rounded text-success text-sm flex items-center justify-center gap-1"
                                        >
                                            <DollarSign className="w-4 h-4" /> Operação
                                        </button>
                                        <button
                                            onClick={() => handleEditAsset(asset)}
                                            className="p-2 hover:bg-surface-hover rounded text-primary"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            className="p-2 hover:bg-surface-hover rounded text-danger"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="card text-center py-12">
                    <PieChart className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sua carteira está vazia</h3>
                    <p className="text-text-secondary mb-4">Comece adicionando seus ativos para acompanhar a rentabilidade</p>
                    <button
                        onClick={() => setShowAssetModal(true)}
                        className="btn-primary"
                    >
                        <Plus className="w-5 h-5" /> Adicionar Primeiro Ativo
                    </button>
                </div>
            )}

            <AssetFormModal
                isOpen={showAssetModal}
                onClose={handleCloseModal}
                onSave={loadInvestments}
                investment={editingAsset}
            />

            {selectedAsset && (
                <OperationModal
                    isOpen={showOperationModal}
                    onClose={() => {
                        setShowOperationModal(false);
                        setSelectedAsset(null);
                    }}
                    onSave={loadInvestments}
                    investment={selectedAsset}
                />
            )}
        </div>
    );
}
