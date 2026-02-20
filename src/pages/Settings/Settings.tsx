
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Plus, X, Trash2, Edit, Save, Home } from 'lucide-react';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../utils/categoryIcons';

type Category = {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: 'income' | 'expense';
};

export function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'categories' | 'profile'>('categories');
    const [categories, setCategories] = useState<Category[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        icon: 'home',
        color: CATEGORY_COLORS[0],
        type: 'expense' as 'income' | 'expense'
    });

    useEffect(() => {
        if (user) {
            loadCategories();
        }
    }, [user]);

    const loadCategories = async () => {
        try {
            // setLoading(true);
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error loading categories:', error);
            alert('Erro ao carregar categorias.');
        } finally {
            // setLoading(false);
        }
    };

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                icon: category.icon,
                color: category.color,
                type: category.type
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                icon: 'home',
                color: CATEGORY_COLORS[0],
                type: 'expense'
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            alert('Nome é obrigatório');
            return;
        }

        try {
            if (editingCategory) {
                const { error } = await supabase
                    .from('categories')
                    .update({
                        name: formData.name,
                        icon: formData.icon,
                        color: formData.color,
                        type: formData.type
                    })
                    .eq('id', editingCategory.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('categories')
                    .insert({
                        user_id: user!.id,
                        name: formData.name,
                        icon: formData.icon,
                        color: formData.color,
                        type: formData.type
                    });

                if (error) throw error;
            }

            setShowModal(false);
            loadCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Erro ao salvar categoria.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta categoria? Transactions vinculadas podem perder a referência.')) return;

        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Erro ao excluir categoria. Verifique se existem transações vinculadas.');
        }
    };

    const incomeCategories = categories.filter(c => c.type === 'income');
    const expenseCategories = categories.filter(c => c.type === 'expense');

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Configurações</h1>
                    <p className="text-text-secondary text-sm md:text-base">Gerencie suas preferências e categorias</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-border">
                <button
                    className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'categories'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                    onClick={() => setActiveTab('categories')}
                >
                    Categorias
                </button>
            </div>

            {activeTab === 'categories' && (
                <div className="space-y-8">
                    {/* Despesas */}
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <h2 className="text-xl font-semibold text-danger">Despesas</h2>
                            <button
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, type: 'expense' }));
                                    handleOpenModal();
                                }}
                                className="btn-primary bg-danger hover:bg-danger/90 border-danger"
                            >
                                <Plus className="w-5 h-5" /> Nova Despesa
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {expenseCategories.map(item => {
                                const Icon = CATEGORY_ICONS[item.icon] || Home;
                                return (
                                    <div key={item.id} className="card flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                                                style={{ backgroundColor: item.color + '20', color: item.color }}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium">{item.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(item)} className="p-2 hover:bg-surface-hover rounded">
                                                <Edit className="w-4 h-4 text-primary" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-surface-hover rounded">
                                                <Trash2 className="w-4 h-4 text-danger" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Receitas */}
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <h2 className="text-xl font-semibold text-success">Receitas</h2>
                            <button
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, type: 'income' }));
                                    handleOpenModal();
                                }}
                                className="btn-primary bg-success hover:bg-success/90 border-success"
                            >
                                <Plus className="w-5 h-5" /> Nova Receita
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {incomeCategories.map(item => {
                                const Icon = CATEGORY_ICONS[item.icon] || Home;
                                return (
                                    <div key={item.id} className="card flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                                                style={{ backgroundColor: item.color + '20', color: item.color }}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium">{item.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(item)} className="p-2 hover:bg-surface-hover rounded">
                                                <Edit className="w-4 h-4 text-primary" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-surface-hover rounded">
                                                <Trash2 className="w-4 h-4 text-danger" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">
                                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-hover rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Aluguel, Salário..."
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Tipo</label>
                                <div className="flex gap-2">
                                    <button
                                        className={`flex-1 py-2 rounded-lg border transition-colors ${formData.type === 'expense'
                                            ? 'bg-danger/10 border-danger text-danger font-bold'
                                            : 'border-border hover:bg-surface-hover'
                                            }`}
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
                                    >
                                        Despesa
                                    </button>
                                    <button
                                        className={`flex-1 py-2 rounded-lg border transition-colors ${formData.type === 'income'
                                            ? 'bg-success/10 border-success text-success font-bold'
                                            : 'border-border hover:bg-surface-hover'
                                            }`}
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
                                    >
                                        Receita
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Cor</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORY_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData(prev => ({ ...prev, color }))}
                                            className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${formData.color === color ? 'ring-2 ring-offset-2 ring-current scale-110' : ''
                                                }`}
                                            style={{ backgroundColor: color, color: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Ícone</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                                        <button
                                            key={key}
                                            onClick={() => setFormData(prev => ({ ...prev, icon: key }))}
                                            className={`p-2 rounded-lg flex items-center justify-center transition-colors ${formData.icon === key
                                                ? 'bg-primary text-white'
                                                : 'hover:bg-surface-hover text-text-secondary'
                                                }`}
                                            title={key}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={handleSave} className="btn-primary flex-1">
                                    <Save className="w-4 h-4" /> Salvar
                                </button>
                                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">
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
