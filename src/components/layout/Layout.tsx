import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
    LayoutDashboard,
    Wallet,
    ArrowLeftRight,
    CreditCard,
    TrendingUp,
    FileText,
    LogOut,
    Menu,
    X,
    Settings,
    BookOpen,
} from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
}

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/accounts', icon: Wallet, label: 'Contas' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
    { to: '/extrato', icon: BookOpen, label: 'Extrato' },
    { to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
    { to: '/investments', icon: TrendingUp, label: 'Investimentos' },
    { to: '/debts', icon: FileText, label: 'Dívidas' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
];

export function Layout({ children }: LayoutProps) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-surface border-b border-surface-hover z-40 flex items-center justify-between px-4">
                <h1 className="text-xl font-bold text-gradient">FluxoFinanceiro</h1>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                >
                    {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 h-full w-64 bg-surface border-r border-surface-hover z-50 transition-transform duration-300
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-surface-hover">
                        <h1 className="text-2xl font-bold text-gradient">FluxoFinanceiro</h1>
                        <p className="text-sm text-text-muted mt-1">{user?.email}</p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Logout */}
                    <div className="p-4 border-t border-surface-hover">
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-danger transition-all w-full"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Sair</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
                <div className="p-4 lg:p-8">{children}</div>
            </main>
        </div>
    );
}
