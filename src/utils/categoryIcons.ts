
import {
    Home, Utensils, Car, ShoppingBag, Heart, GraduationCap, Zap,
    CreditCard, DollarSign, Briefcase, TrendingUp, Music, Plane,
    Smartphone, Coffee, Gift, Shield, HelpCircle
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
    'home': Home,
    'utensils': Utensils,
    'car': Car,
    'shopping-bag': ShoppingBag,
    'heart': Heart,
    'graduation-cap': GraduationCap,
    'zap': Zap,
    'credit-card': CreditCard,
    'dollar-sign': DollarSign,
    'briefcase': Briefcase,
    'trending-up': TrendingUp,
    'music': Music,
    'plane': Plane,
    'smartphone': Smartphone,
    'coffee': Coffee,
    'gift': Gift,
    'shield': Shield
};

export const CATEGORY_COLORS = [
    '#6366f1', // Indigo (Primary)
    '#ef4444', // Red
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#64748b', // Slate
];

export function getCategoryIcon(iconName: string): LucideIcon {
    return CATEGORY_ICONS[iconName] || HelpCircle;
}
