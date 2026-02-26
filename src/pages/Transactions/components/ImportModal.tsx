import { useState, useRef } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { Ofx } from 'ofx-data-extractor';
import { format, isBefore, startOfToday, isValid } from 'date-fns';
import { supabase } from '../../../lib/supabase';

interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
}

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
}

interface ImportModalProps {
    onClose: () => void;
    accounts: Account[];
    categories: Category[];
    userId: string;
    onImportComplete: () => void;
}

interface ParsedTransaction {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category_id?: string;
    selected: boolean;
}

export function ImportModal({ onClose, accounts, categories, userId, onImportComplete }: ImportModalProps) {
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
    const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
    const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [mapping, setMapping] = useState({
        date: -1,
        description: -1,
        amount: -1,
    });
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length > 0) {
                processFiles(selectedFiles);
            }
        }
    };

    const parseAmount = (value: string): number => {
        if (!value) return 0;
        // Se houver ponto e vírgula, assume que o ponto é milhar e a vírgula é decimal (PT-BR)
        // Ex: 1.500,00 -> 1500.00
        if (value.includes('.') && value.includes(',')) {
            const cleanValue = value.replace(/\./g, '').replace(',', '.');
            return parseFloat(cleanValue);
        }
        // Se houver apenas vírgula, assume que é decimal
        // Ex: 1500,00 -> 1500.00
        if (value.includes(',')) {
            return parseFloat(value.replace(',', '.'));
        }
        // Caso contrário, assume formato padrão (pode ter ponto como decimal ou nada)
        return parseFloat(value);
    };

    const findTransactions = (obj: any): any[] => {
        if (!obj || typeof obj !== 'object') return [];

        let found: any[] = [];

        // Se encontramos a tag STMTTRN diretamente
        if (obj.STMTTRN) {
            return Array.isArray(obj.STMTTRN) ? obj.STMTTRN : [obj.STMTTRN];
        }

        // Busca recursiva
        for (const key in obj) {
            if (key === 'STMTTRN') {
                const trns = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
                found = found.concat(trns);
            } else if (typeof obj[key] === 'object') {
                found = found.concat(findTransactions(obj[key]));
            }
        }

        return found;
    };

    const autoCategorize = (description: string, type: 'income' | 'expense'): string | undefined => {
        const desc = description.toLowerCase();

        const rules = [
            { keywords: ['mercado', 'supermercado', 'paizao', 'mufato', 'angeloni', 'atacad'], category: 'Alimentação' },
            { keywords: ['posto', 'combustivel', 'gasolina', 'etanol', 'uber', '99app'], category: 'Transporte' },
            { keywords: ['restaurante', 'ifood', 'bking', 'mcdonalds', 'pizza', 'burger'], category: 'Alimentação' },
            { keywords: ['farmacia', 'droga', 'saude', 'hospital', 'medico'], category: 'Saúde' },
            { keywords: ['aluguel', 'condominio', 'luz', 'copel', 'agua', 'sanepar', 'internet'], category: 'Moradia' },
            { keywords: ['netflix', 'spotify', 'disney', 'prime helper', 'cinema', 'steam'], category: 'Lazer' },
            { keywords: ['pix', 'transferencia'], category: 'Transferência' }
        ];

        for (const rule of rules) {
            if (rule.keywords.some(k => desc.includes(k))) {
                const cat = categories.find(c => c.name.toLowerCase() === rule.category.toLowerCase() && c.type === type);
                if (cat) return cat.id;
            }
        }

        return undefined;
    };

    const processFiles = async (filesToProcess: File[]) => {
        setLoading(true);
        const allTransactions: ParsedTransaction[] = [];

        for (const file of filesToProcess) {
            const isOfx = file.name.toLowerCase().endsWith('.ofx');
            const isCsv = file.name.toLowerCase().endsWith('.csv');

            if (isOfx) {
                const text = await file.text();
                try {
                    const ofx = new Ofx(text);
                    const ofxData = ofx.toJson();
                    console.log('OFX Data structure:', ofxData);

                    const transactions = findTransactions(ofxData);

                    if (transactions.length === 0) {
                        alert(`Não foi possível encontrar transações no arquivo: ${file.name}`);
                        continue;
                    }

                    const mapped = transactions.map((t: any) => {
                        const dateStr = t.DTPOSTED || '';
                        const dateMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
                        const date = dateMatch
                            ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                            : format(new Date(), 'yyyy-MM-dd');

                        const amount = parseAmount(String(t.TRNAMT || '0'));
                        const type = amount > 0 ? 'income' : 'expense' as 'income' | 'expense';
                        const description = t.MEMO || t.NAME || 'Sem descrição';

                        return {
                            date,
                            description,
                            amount: Math.abs(amount),
                            type,
                            category_id: autoCategorize(description, type),
                            selected: !!dateMatch,
                        };
                    });
                    allTransactions.push(...mapped);
                } catch (err) {
                    console.error('Erro ao processar OFX:', err);
                }
            } else if (isCsv) {
                // Just extract headers for mapping if it's the first CSV
                if (csvHeaders.length === 0) {
                    Papa.parse(file, {
                        complete: (results) => {
                            const rows = results.data as string[][];
                            if (rows.length > 0) {
                                setCsvHeaders(rows[0]);
                                setCsvRows(rows.slice(1));
                                setStep('mapping');
                            }
                        },
                        header: false,
                        skipEmptyLines: true,
                    });
                    setLoading(false);
                    return; // Wait for mapping
                }
            }
        }

        if (allTransactions.length > 0) {
            setParsedData(allTransactions);
            setStep('preview');
        } else if (step === 'upload') {
            setLoading(false);
        }
    };

    const handleApplyMapping = () => {
        if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
            alert('Por favor, mapeie todas as colunas necessárias.');
            return;
        }

        const transactions = csvRows.map(row => {
            const amount = parseAmount(row[mapping.amount] || '0');

            // Try to parse Brazilian date DD/MM/YYYY or YYYY-MM-DD
            let date = row[mapping.date] || '';
            if (date.includes('/')) {
                const [d, m, y] = date.split('/');
                date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }

            const description = row[mapping.description] || 'Sem descrição';
            const type = amount > 0 ? 'income' : 'expense' as 'income' | 'expense';

            return {
                date,
                description,
                amount: Math.abs(amount),
                type,
                category_id: autoCategorize(description, type),
                selected: true,
            };
        }).filter(t => !isNaN(t.amount) && t.date);

        setParsedData(transactions);
        setStep('preview');
    };

    const handleImport = async () => {
        setLoading(true);
        const selectedTransactions = parsedData.filter(t => t.selected);
        const today = startOfToday();

        const insertData = selectedTransactions.map(t => {
            const transactionDate = new Date(t.date);
            const status = isBefore(transactionDate, today) || transactionDate.toDateString() === today.toDateString()
                ? 'completed'
                : 'pending';

            return {
                user_id: userId,
                account_id: selectedAccountId,
                category_id: t.category_id || categories.find(c => c.type === t.type)?.id || categories[0].id,
                type: t.type,
                amount: t.amount,
                transaction_date: t.date,
                description: t.description,
                status,
            };
        });

        const { error } = await supabase.from('transactions').insert(insertData);

        if (error) {
            console.error('Erro na importação:', error);
            alert('Erro ao importar transações.');
        } else {
            onImportComplete();
            onClose();
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="card max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-border/50">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Upload className="w-6 h-6 text-primary" />
                        Importar Transações
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="label">1. Selecionar Conta de Destino</label>
                                <select
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    className="select"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    multiple
                                    accept=".csv,.ofx"
                                    className="hidden"
                                />
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Clique ou arraste arquivos aqui</h3>
                                <p className="text-text-secondary">Suporta arquivos .CSV e .OFX (extrato bancário)</p>
                            </div>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-6">
                            <div className="bg-primary/10 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-semibold text-primary">Ajuste o mapeamento do CSV</h4>
                                    <p className="text-sm text-primary/80">Identifique quais colunas do seu arquivo correspondem aos campos abaixo.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="label">Data</label>
                                    <select
                                        value={mapping.date}
                                        onChange={(e) => setMapping({ ...mapping, date: parseInt(e.target.value) })}
                                        className="select"
                                    >
                                        <option value={-1}>Selecionar coluna...</option>
                                        {csvHeaders.map((h, i) => (
                                            <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="label">Descrição</label>
                                    <select
                                        value={mapping.description}
                                        onChange={(e) => setMapping({ ...mapping, description: parseInt(e.target.value) })}
                                        className="select"
                                    >
                                        <option value={-1}>Selecionar coluna...</option>
                                        {csvHeaders.map((h, i) => (
                                            <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="label">Valor</label>
                                    <select
                                        value={mapping.amount}
                                        onChange={(e) => setMapping({ ...mapping, amount: parseInt(e.target.value) })}
                                        className="select"
                                    >
                                        <option value={-1}>Selecionar coluna...</option>
                                        {csvHeaders.map((h, i) => (
                                            <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-hover text-text-secondary">
                                        <tr>
                                            {csvHeaders.map((h, i) => (
                                                <th key={i} className="px-4 py-3 font-medium">{h || `Col ${i + 1}`}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvRows.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-t border-border">
                                                {row.map((cell, j) => (
                                                    <td key={j} className="px-4 py-3 truncate max-w-[200px]">{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-hover/30 p-4 rounded-xl border border-border">
                                <div>
                                    <h3 className="text-lg font-semibold">{parsedData.length} transações encontradas</h3>
                                    <div className="text-sm text-text-secondary">Selecione as que deseja importar e defina as categorias.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs font-medium text-text-secondary whitespace-nowrap">Aplicar categoria em todos:</div>
                                    <select
                                        className="select py-1 text-xs min-w-[150px]"
                                        onChange={(e) => {
                                            const categoryId = e.target.value;
                                            if (!categoryId) return;
                                            const selectedCat = categories.find(c => c.id === categoryId);
                                            const newData = parsedData.map(t => {
                                                if (t.type === selectedCat?.type) {
                                                    return { ...t, category_id: categoryId };
                                                }
                                                return t;
                                            });
                                            setParsedData(newData);
                                        }}
                                    >
                                        <option value="">Selecionar...</option>
                                        <optgroup label="Despesas">
                                            {categories.filter(c => c.type === 'expense').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Receitas">
                                            {categories.filter(c => c.type === 'income').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {parsedData.map((t, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary/30 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={t.selected}
                                            onChange={() => {
                                                const newData = [...parsedData];
                                                newData[i].selected = !newData[i].selected;
                                                setParsedData(newData);
                                            }}
                                            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                            <div className="text-sm font-medium">
                                                {isValid(new Date(t.date)) ? format(new Date(t.date), 'dd/MM/yyyy') : 'Data inválida'}
                                            </div>
                                            <div className="text-sm font-semibold truncate md:col-span-1" title={t.description}>{t.description}</div>
                                            <div className="md:col-span-2">
                                                <select
                                                    value={t.category_id || ''}
                                                    onChange={(e) => {
                                                        const newData = [...parsedData];
                                                        newData[i].category_id = e.target.value;
                                                        setParsedData(newData);
                                                    }}
                                                    className="select py-1 text-xs"
                                                >
                                                    <option value="">Selecionar categoria...</option>
                                                    {categories
                                                        .filter(c => c.type === t.type)
                                                        .map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <div className={`text-right font-bold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                                {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-surface-hover/30 flex gap-3">
                    {step === 'mapping' && (
                        <button
                            onClick={() => setStep('upload')}
                            className="btn-ghost"
                            disabled={loading}
                        >
                            Voltar
                        </button>
                    )}
                    {step === 'preview' && (
                        <button
                            onClick={() => setStep(csvHeaders.length > 0 ? 'mapping' : 'upload')}
                            className="btn-ghost"
                            disabled={loading}
                        >
                            Voltar
                        </button>
                    )}

                    <div className="flex-1" />

                    {step === 'mapping' && (
                        <button onClick={handleApplyMapping} className="btn-primary min-w-[200px]">
                            Continuar para Prévia
                        </button>
                    )}

                    {step === 'preview' && (
                        <button
                            onClick={handleImport}
                            disabled={loading || parsedData.filter(t => t.selected).length === 0}
                            className="btn-success min-w-[200px] flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            Importar {parsedData.filter(t => t.selected).length} Transações
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
