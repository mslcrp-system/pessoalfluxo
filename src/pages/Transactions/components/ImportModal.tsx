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
                    const transactions = ofxData?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN || [];

                    const mapped = (Array.isArray(transactions) ? transactions : [transactions]).map((t: any) => {
                        const dateStr = t.DTPOSTED || '';
                        const dateMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
                        const date = dateMatch
                            ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                            : format(new Date(), 'yyyy-MM-dd'); // Fallback to today if parsing fails

                        const amountStr = String(t.TRNAMT || '0').replace(',', '.');
                        const amount = parseFloat(amountStr);

                        return {
                            date,
                            description: t.MEMO || t.NAME || 'Sem descrição',
                            amount: Math.abs(amount),
                            type: amount > 0 ? 'income' : 'expense' as 'income' | 'expense',
                            selected: !!dateMatch, // Deselect by default if date is invalid
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
                    });
                    setLoading(false);
                    return; // Wait for mapping
                }
            }
        }

        if (allTransactions.length > 0) {
            setParsedData(allTransactions);
            setStep('preview');
        }
        setLoading(false);
    };

    const handleApplyMapping = () => {
        if (mapping.date === -1 || mapping.description === -1 || mapping.amount === -1) {
            alert('Por favor, mapeie todas as colunas necessárias.');
            return;
        }

        const transactions = csvRows.map(row => {
            const amountStr = row[mapping.amount]?.replace(',', '.') || '0';
            const amount = parseFloat(amountStr);

            // Try to parse Brazilian date DD/MM/YYYY or YYYY-MM-DD
            let date = row[mapping.date] || '';
            if (date.includes('/')) {
                const [d, m, y] = date.split('/');
                date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }

            return {
                date,
                description: row[mapping.description] || 'Sem descrição',
                amount: Math.abs(amount),
                type: amount > 0 ? 'income' : 'expense' as 'income' | 'expense',
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
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">{parsedData.length} transações encontradas</h3>
                                <div className="text-sm text-text-secondary">Selecione as que deseja importar</div>
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
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                            <div className="text-sm font-medium">
                                                {isValid(new Date(t.date)) ? format(new Date(t.date), 'dd/MM/yyyy') : 'Data inválida'}
                                            </div>
                                            <div className="text-sm font-semibold truncate md:col-span-2">{t.description}</div>
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
