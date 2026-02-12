
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';

export type Investment = {
    id: string;
    name: string;
    ticker?: string;
    type: 'stock' | 'fii' | 'fixed_income' | 'crypto' | 'treasure' | 'other';
    current_price: number;
    quantity: number;
    average_price: number;
};

type AssetFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    investment?: Investment | null;
};

export function AssetFormModal({ isOpen, onClose, onSave, investment }: AssetFormModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Investment>>({
        name: '',
        ticker: '',
        type: 'stock',
        quantity: 0,
        average_price: 0,
        current_price: 0
    });

    useEffect(() => {
        if (investment) {
            setFormData(investment);
        } else {
            setFormData({
                name: '',
                ticker: '',
                type: 'stock',
                quantity: 0,
                average_price: 0,
                current_price: 0
            });
        }
    }, [investment, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (investment) {
                const { error } = await supabase
                    .from('investments')
                    .update({
                        name: formData.name,
                        ticker: formData.ticker,
                        type: formData.type,
                        current_price: formData.current_price, // Idealmente atualizado via API/Manual
                        // Quantity e Average Price geralmente são atualizados via Transações, 
                        // mas permitimos edição manual para ajuste inicial
                        quantity: formData.quantity,
                        average_price: formData.average_price
                    })
                    .eq('id', investment.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('investments')
                    .insert({
                        user_id: user!.id,
                        name: formData.name,
                        ticker: formData.ticker,
                        type: formData.type,
                        current_price: formData.current_price,
                        quantity: formData.quantity,
                        average_price: formData.average_price
                    });

                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving investment:', error);
            alert('Erro ao salvar ativo.');
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
                        {investment ? 'Editar Ativo' : 'Novo Ativo'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Petrobras, Tesouro Selic..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Código (Ticker)</label>
                            <input
                                type="text"
                                className="input uppercase"
                                value={formData.ticker || ''}
                                onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                                placeholder="Ex: PETR4"
                            />
                        </div>
                        <div>
                            <label className="label">Tipo</label>
                            <select
                                className="select"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                            >
                                <option value="stock">Ação</option>
                                <option value="fii">FII</option>
                                <option value="fixed_income">Renda Fixa</option>
                                <option value="treasure">Tesouro Direto</option>
                                <option value="crypto">Criptomoeda</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-surface-hover rounded-lg border border-border">
                        <p className="text-sm text-text-secondary mb-3">Posição Inicial (Opcional)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label text-xs">Quantidade</label>
                                <input
                                    type="number"
                                    step="0.00000001"
                                    className="input text-sm"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="label text-xs">Preço Médio</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input text-sm"
                                    value={formData.average_price}
                                    onChange={e => setFormData({ ...formData, average_price: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="mt-2">
                            <label className="label text-xs">Preço Atual (Estimado)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input text-sm"
                                value={formData.current_price}
                                onChange={e => setFormData({ ...formData, current_price: parseFloat(e.target.value) })}
                            />
                        </div>
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
