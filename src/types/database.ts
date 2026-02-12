export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            accounts: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    type: 'checking' | 'investment'
                    balance: number
                    active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    type: 'checking' | 'investment'
                    balance?: number
                    active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    type?: 'checking' | 'investment'
                    balance?: number
                    active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            categories: {
                Row: {
                    id: string
                    name: string
                    type: 'income' | 'expense'
                    icon: string
                    color: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    type: 'income' | 'expense'
                    icon: string
                    color: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    type?: 'income' | 'expense'
                    icon?: string
                    color?: string
                    created_at?: string
                }
            }
            transactions: {
                Row: {
                    id: string
                    user_id: string
                    account_id: string
                    category_id: string
                    type: 'income' | 'expense' | 'transfer'
                    amount: number
                    transaction_date: string
                    description: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    account_id: string
                    category_id: string
                    type: 'income' | 'expense' | 'transfer'
                    amount: number
                    transaction_date: string
                    description: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    account_id?: string
                    category_id?: string
                    type?: 'income' | 'expense' | 'transfer'
                    amount?: number
                    transaction_date?: string
                    description?: string
                    created_at?: string
                }
            }
            credit_cards: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    due_day: number
                    card_limit: number
                    active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    due_day: number
                    card_limit: number
                    active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    due_day?: number
                    card_limit?: number
                    active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            credit_card_purchases: {
                Row: {
                    id: string
                    credit_card_id: string
                    category_id: string
                    total_amount: number
                    installments: number
                    purchase_date: string
                    first_due_month: string
                    description: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    credit_card_id: string
                    category_id: string
                    total_amount: number
                    installments: number
                    purchase_date: string
                    first_due_month: string
                    description: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    credit_card_id?: string
                    category_id?: string
                    total_amount?: number
                    installments?: number
                    purchase_date?: string
                    first_due_month?: string
                    description?: string
                    created_at?: string
                }
            }
            installments: {
                Row: {
                    id: string
                    purchase_id: string
                    installment_number: number
                    amount: number
                    due_date: string
                    paid: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    purchase_id: string
                    installment_number: number
                    amount: number
                    due_date: string
                    paid?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    purchase_id?: string
                    installment_number?: number
                    amount?: number
                    due_date?: string
                    paid?: boolean
                    created_at?: string
                }
            }
            assets: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    type: string
                    purchase_value: number
                    purchase_date: string
                    description: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    type: string
                    purchase_value: number
                    purchase_date: string
                    description: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    type?: string
                    purchase_value?: number
                    purchase_date?: string
                    description?: string
                    created_at?: string
                }
            }
            debts: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    principal_amount: number
                    interest_amount: number
                    remaining_balance: number
                    start_date: string
                    description: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    principal_amount: number
                    interest_amount: number
                    remaining_balance: number
                    start_date: string
                    description: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    principal_amount?: number
                    interest_amount?: number
                    remaining_balance?: number
                    start_date?: string
                    description?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            debt_payments: {
                Row: {
                    id: string
                    debt_id: string
                    principal_paid: number
                    interest_paid: number
                    payment_date: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    debt_id: string
                    principal_paid: number
                    interest_paid: number
                    payment_date: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    debt_id?: string
                    principal_paid?: number
                    interest_paid?: number
                    payment_date?: string
                    created_at?: string
                }
            }
            investment_returns: {
                Row: {
                    id: string
                    account_id: string
                    return_amount: number
                    reference_month: string
                    description: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    account_id: string
                    return_amount: number
                    reference_month: string
                    description: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    account_id?: string
                    return_amount?: number
                    reference_month?: string
                    description?: string
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
