import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Banknote, CheckCircle2, CreditCard, Download, Euro, FileText, Package,
  Plus, Printer, ReceiptText, RefreshCw, Search, ShieldCheck, Trash2, TrendingDown, Wallet, XCircle,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  CashClosing, CenterSettings, Expense, Invoice, InvoiceItem, InvoiceStatus, Patient, Payment,
  PaymentMethod, Service, SessionPackage, User,
} from '../types';
import { dbService } from '../services/dbService';
import { hasPermission } from '../services/permissions';
import {
  CLINICAL_SPECIALTIES, EXPENSE_CATEGORIES, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS,
  PAYMENT_METHODS, ROLE_PROFILES, SPECIALTY_LABELS, formatDate, formatMoney, localMonthStartISO,
  localTodayISO, patientFullName,
} from '../constants';
import {
  Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, ProgressBar, SectionCard, StatCard,
  Tabs, btnGhost, btnPrimary, btnSecondary, btnDanger, cardClass, inputClass,
} from '../components/ui';
import PaymentModal from '../components/PaymentModal';
import { downloadCsv, escapeHtml, printHtmlDocument } from '../services/exportUtils';

interface Props { user: User; }

type TabId = 'summary' | 'invoices' | 'payments' | 'expenses' | 'packages' | 'cash' | 'export';

const TAB_IDS: TabId[] = ['summary', 'invoices', 'payments', 'expenses', 'packages', 'cash', 'export'];

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const invoicePending = (invoice: Invoice): number => Math.max(0, invoice.total - invoice.amountPaid);

const isOverdue = (invoice: Invoice): boolean =>
  ['emitida', 'parcial'].includes(invoice.status) && invoice.dueDate < localTodayISO();

const itemId = () => `ii-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const Billing: React.FC<Props> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'summary';
  const [tab, setTab] = useState<TabId>(TAB_IDS.includes(initialTab) ? initialTab : 'summary');
  const canManage = hasPermission(user, 'billing.manage');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cashError, setCashError] = useState('');
  const [notice, setNotice] = useState('');

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseStatus, setExpenseStatus] = useState('');

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<{
    patientId: string; date: string; dueDate: string; taxRate: string; notes: string;
    status: InvoiceStatus; items: InvoiceItem[];
  }>({ patientId: '', date: localTodayISO(), dueDate: addDays(localTodayISO(), 30), taxRate: '0', notes: '', status: 'emitida', items: [] });
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoicePayment, setInvoicePayment] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('tarjeta');

  const [paymentModal, setPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({ date: localTodayISO(), method: 'transferencia', status: 'pagado', category: 'Otros' });

  const [packageModal, setPackageModal] = useState(false);
  const [packageForm, setPackageForm] = useState<Partial<SessionPackage>>({ purchaseDate: localTodayISO(), totalSessions: 5, specialty: CLINICAL_SPECIALTIES[0] });

  const [openingFloat, setOpeningFloat] = useState('0');
  const [countedCash, setCountedCash] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [exportFrom, setExportFrom] = useState(localMonthStartISO());
  const [exportTo, setExportTo] = useState(localTodayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get('tab') as TabId | null;
    if (fromUrl && TAB_IDS.includes(fromUrl) && fromUrl !== tab) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeTab = (id: string) => {
    const next = (TAB_IDS.includes(id as TabId) ? id : 'summary') as TabId;
    setTab(next);
    setError('');
    setCashError('');
    setSearchParams({ tab: next }, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [inv, pay, exp, pack, cash, pats, profs, servs, cfg] = await Promise.all([
        dbService.getInvoices(),
        dbService.getPayments(),
        dbService.getExpenses(),
        dbService.getPackages(),
        dbService.getCashClosings(),
        dbService.getPatients(user.id, user.role),
        dbService.getProfessionals(),
        dbService.getServices(),
        dbService.getSettings(),
      ]);
      setInvoices(inv);
      setPayments(pay);
      setExpenses(exp);
      setPackages(pack);
      setClosings(cash);
      setPatients(pats);
      setProfessionals(profs.filter(p => p.role !== 'admin'));
      setServices(servs);
      setSettings(cfg);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos de facturación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id]);

  const monthStart = localMonthStartISO();
  const today = localTodayISO();

  const metrics = useMemo(() => {
    const billedMonth = invoices.filter(i => i.date >= monthStart && i.status !== 'anulada').reduce((s, i) => s + i.total, 0);
    const collectedMonth = payments.filter(p => p.paymentDate >= monthStart).reduce((s, p) => s + p.amount, 0);
    const pending = invoices.filter(i => i.status !== 'anulada').reduce((s, i) => s + invoicePending(i), 0);
    const expenseMonth = expenses.filter(e => e.date >= monthStart && e.status === 'pagado').reduce((s, e) => s + e.amount, 0);
    const overdue = invoices.filter(isOverdue).length;
    return {
      billedMonth, collectedMonth, pending, expenseMonth,
      profit: collectedMonth - expenseMonth,
      overdue,
      invoiceCount: invoices.filter(i => i.status !== 'anulada').length,
      paymentCount: payments.filter(p => p.paymentDate >= monthStart).length,
    };
  }, [invoices, payments, expenses, monthStart]);

  const revenueBySpecialty = useMemo(() => {
    return CLINICAL_SPECIALTIES.map(specialty => {
      const profile = ROLE_PROFILES[specialty];
      const total = invoices
        .filter(i => i.date >= monthStart && i.status !== 'anulada')
        .reduce((sum, invoice) => {
          const own = invoice.items.filter(item => {
            const service = services.find(s => s.id === item.serviceId);
            return service?.specialty === specialty;
          });
          return sum + own.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        }, 0);
      return { name: profile.shortLabel, total, fill: profile.hex, specialty };
    });
  }, [invoices, services, monthStart]);

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    if (invoiceStatus && inv.status !== invoiceStatus) return false;
    if (!invoiceSearch.trim()) return true;
    const patient = patients.find(p => p.id === inv.patientId);
    const hay = `${inv.number} ${inv.patientName || ''} ${patient ? patientFullName(patient) : ''}`.toLowerCase();
    return hay.includes(invoiceSearch.toLowerCase());
  }), [invoices, invoiceStatus, invoiceSearch, patients]);

  const filteredPayments = useMemo(() => payments.filter(p => {
    if (paymentMethod && p.method !== paymentMethod) return false;
    if (!paymentSearch.trim()) return true;
    const patient = patients.find(x => x.id === p.patientId);
    const hay = `${p.concept} ${p.notes || ''} ${p.patientName || ''} ${patient ? patientFullName(patient) : ''} ${p.professionalName || ''}`.toLowerCase();
    return hay.includes(paymentSearch.toLowerCase());
  }), [payments, paymentMethod, paymentSearch, patients]);

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    if (expenseStatus && e.status !== expenseStatus) return false;
    if (!expenseSearch.trim()) return true;
    return `${e.supplier} ${e.category} ${e.reference || ''} ${e.notes || ''}`.toLowerCase().includes(expenseSearch.toLowerCase());
  }), [expenses, expenseStatus, expenseSearch]);

  const invoiceTotals = useMemo(() => {
    const subtotal = invoiceForm.items.reduce((s, item) => s + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const taxRate = Number(invoiceForm.taxRate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    return { subtotal, taxRate, taxAmount, total: subtotal + taxAmount };
  }, [invoiceForm.items, invoiceForm.taxRate]);

  const todayCash = useMemo(() => {
    const todayPayments = payments.filter(p => p.paymentDate === today);
    const cash = todayPayments.filter(p => p.method === 'efectivo').reduce((s, p) => s + p.amount, 0);
    const card = todayPayments.filter(p => p.method === 'tarjeta').reduce((s, p) => s + p.amount, 0);
    const other = todayPayments.filter(p => ['transferencia', 'bizum'].includes(p.method)).reduce((s, p) => s + p.amount, 0);
    const cashExpenses = expenses
      .filter(e => e.date === today && e.status === 'pagado' && e.method === 'efectivo')
      .reduce((s, e) => s + e.amount, 0);
    const opening = Number(openingFloat) || 0;
    const expected = opening + cash - cashExpenses;
    const counted = countedCash === '' ? expected : Number(countedCash) || 0;
    return { cash, card, other, cashExpenses, opening, expected, counted, difference: counted - expected };
  }, [payments, expenses, today, openingFloat, countedCash]);

  const todayClosing = closings.find(c => c.date === today);

  // ----------------------------------------------------------
  // Facturas
  // ----------------------------------------------------------
  const openNewInvoice = () => {
    setEditingInvoice(null);
    setInvoiceForm({
      patientId: '', date: localTodayISO(), dueDate: addDays(localTodayISO(), 30),
      taxRate: '0', notes: '', status: 'emitida', items: [{
        id: itemId(), serviceId: null, description: '', quantity: 1, unitPrice: 0,
      }],
    });
    setInvoiceModal(true);
  };

  const openEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceForm({
      patientId: invoice.patientId, date: invoice.date, dueDate: invoice.dueDate,
      taxRate: String(invoice.taxRate), notes: invoice.notes || '', status: invoice.status,
      items: invoice.items.map(i => ({ ...i })),
    });
    setInvoiceModal(true);
    setInvoiceDetail(null);
  };

  const addInvoiceItem = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    const nextItem = {
      id: itemId(), serviceId: service?.id || null,
      description: service?.name || '', quantity: 1, unitPrice: service?.price || 0,
    };
    setInvoiceForm(prev => {
      const blankIndex = prev.items.findIndex(i => !i.description.trim() && !i.serviceId && Number(i.unitPrice) === 0);
      if (blankIndex >= 0) {
        const items = [...prev.items];
        items[blankIndex] = nextItem;
        return { ...prev, items };
      }
      return { ...prev, items: [...prev.items, nextItem] };
    });
  };

  const updateInvoiceItem = (id: string, patch: Partial<InvoiceItem>) => {
    setInvoiceForm(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  };

  const saveInvoice = async () => {
    setError('');
    if (!invoiceForm.patientId) { setError('Selecciona el paciente de la factura.'); return; }
    const items = invoiceForm.items.filter(i => i.description.trim() && Number(i.quantity) > 0);
    if (!items.length) { setError('Añade al menos una línea con descripción y cantidad.'); return; }
    setSaving(true);
    try {
      const saved = await dbService.saveInvoice({
        ...(editingInvoice || {}),
        id: editingInvoice?.id,
        patientId: invoiceForm.patientId,
        date: invoiceForm.date,
        dueDate: invoiceForm.dueDate,
        items,
        subtotal: invoiceTotals.subtotal,
        taxRate: invoiceTotals.taxRate,
        taxAmount: invoiceTotals.taxAmount,
        total: invoiceTotals.total,
        amountPaid: editingInvoice?.amountPaid || 0,
        status: invoiceForm.status,
        notes: invoiceForm.notes,
        createdBy: user.id,
      }, user);
      setInvoiceModal(false);
      setNotice(`Factura ${saved.number} guardada correctamente.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la factura.');
    } finally {
      setSaving(false);
    }
  };

  const issueInvoice = async (invoice: Invoice) => {
    try {
      await dbService.saveInvoice({ ...invoice, status: 'emitida' }, user);
      setNotice(`Factura ${invoice.number} emitida.`);
      await load();
      if (invoiceDetail?.id === invoice.id) setInvoiceDetail({ ...invoice, status: 'emitida' });
    } catch (e: any) {
      setError(e?.message || 'No se pudo emitir la factura.');
    }
  };

  const annulInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`¿Anular la factura ${invoice.number}? El registro se conserva para trazabilidad.`)) return;
    try {
      await dbService.saveInvoice({ ...invoice, status: 'anulada' }, user);
      setNotice(`Factura ${invoice.number} anulada.`);
      setInvoiceDetail(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo anular la factura.');
    }
  };

  const openInvoicePayment = (invoice: Invoice) => {
    setInvoicePayment(invoice);
    setPayAmount(invoicePending(invoice).toFixed(2));
    setPayMethod((invoice.method as PaymentMethod) || 'tarjeta');
  };

  const submitInvoicePayment = async () => {
    if (!invoicePayment) return;
    const amount = Number(payAmount);
    if (Number.isNaN(amount) || amount <= 0) { setError('Introduce un importe mayor que cero.'); return; }
    const pending = invoicePending(invoicePayment);
    if (amount > pending + 0.01) { setError(`El importe supera lo pendiente (${formatMoney(pending)}).`); return; }
    setSaving(true);
    try {
      const updated = await dbService.registerInvoicePayment(invoicePayment.id, Math.round(amount * 100) / 100, payMethod, user);
      setInvoicePayment(null);
      setInvoiceDetail(updated);
      setNotice(`Cobro registrado. Factura ${updated.number}: ${updated.status === 'pagada' ? 'pagada' : 'pago parcial'}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar el cobro.');
    } finally {
      setSaving(false);
    }
  };

  const printInvoice = (invoice: Invoice) => {
    const patient = patients.find(p => p.id === invoice.patientId);
    const center = settings;
    const rows = invoice.items.map(item => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatMoney(item.unitPrice)}</td>
        <td class="num">${formatMoney(item.quantity * item.unitPrice)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
      <title>Factura ${escapeHtml(invoice.number)}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #292524; font-size: 11pt; line-height: 1.5; }
        .top { display: flex; justify-content: space-between; border-bottom: 1px solid #d6d3d1; padding-bottom: 14px; }
        h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: .04em; }
        .muted { color: #78716c; font-size: 10px; }
        .box { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 22px; }
        th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #78716c; border-bottom: 1px solid #d6d3d1; padding: 8px 6px; }
        td { padding: 8px 6px; border-bottom: 1px solid #e7e5e4; }
        .num { text-align: right; white-space: nowrap; }
        .totals { margin-left: auto; width: 280px; margin-top: 18px; }
        .totals tr td { border: 0; padding: 4px 6px; }
        .totals .grand td { border-top: 1px solid #292524; font-weight: bold; font-size: 13px; padding-top: 8px; }
        .foot { margin-top: 40px; font-size: 9px; color: #78716c; border-top: 1px solid #e7e5e4; padding-top: 10px; }
        .status { display: inline-block; border: 1px solid #d6d3d1; border-radius: 20px; padding: 2px 10px; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
      </style></head><body>
      <div class="top">
        <div>
          <h1>${escapeHtml(center?.centerName || 'Sinestesya')}</h1>
          <div class="muted">${escapeHtml(center?.legalName || 'Sinestesya Salud Integral S.L.')}</div>
          <div class="muted">${escapeHtml(center?.cif || '')}</div>
          <div class="muted">${escapeHtml(center?.address || '')}</div>
          <div class="muted">${escapeHtml(center?.phone || '')} · ${escapeHtml(center?.email || '')}</div>
        </div>
        <div style="text-align:right">
          <h1>FACTURA</h1>
          <div><strong>${escapeHtml(invoice.number)}</strong></div>
          <div class="muted">Fecha: ${formatDate(invoice.date)}</div>
          <div class="muted">Vencimiento: ${formatDate(invoice.dueDate)}</div>
          <div style="margin-top:8px"><span class="status">${escapeHtml(INVOICE_STATUS_LABELS[invoice.status] || invoice.status)}</span></div>
        </div>
      </div>
      <div class="box">
        <div>
          <div class="muted" style="text-transform:uppercase;letter-spacing:.08em">Facturar a</div>
          <div><strong>${escapeHtml(invoice.patientName || (patient ? patientFullName(patient) : 'Paciente'))}</strong></div>
          <div class="muted">${escapeHtml(patient?.dni || '')}</div>
          <div class="muted">${escapeHtml(patient?.address || '')}</div>
          <div class="muted">${escapeHtml(patient?.email || '')}</div>
        </div>
        <div>
          <div class="muted" style="text-transform:uppercase;letter-spacing:.08em">Concepto</div>
          <div>${escapeHtml(invoice.items.map(i => i.description).join(' · '))}</div>
          ${invoice.notes ? `<div class="muted" style="margin-top:8px">${escapeHtml(invoice.notes)}</div>` : ''}
        </div>
      </div>
      <table>
        <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${formatMoney(invoice.subtotal)}</td></tr>
        <tr><td>IVA (${invoice.taxRate}%)</td><td class="num">${formatMoney(invoice.taxAmount)}</td></tr>
        <tr class="grand"><td>Total</td><td class="num">${formatMoney(invoice.total)}</td></tr>
        <tr><td>Pagado</td><td class="num">${formatMoney(invoice.amountPaid)}</td></tr>
        <tr><td>Pendiente</td><td class="num">${formatMoney(invoicePending(invoice))}</td></tr>
      </table>
      <div class="foot">
        Documento generado por ${escapeHtml(center?.centerName || 'Sinestesya')} el ${formatDate(localTodayISO())}.
        Conserve este documento para cualquier reclamación. Los datos personales se tratan conforme al RGPD y la LOPDGDD.
      </div>
      </body></html>`;
    printHtmlDocument(html, `Factura ${invoice.number}`);
  };

  // ----------------------------------------------------------
  // Cobros
  // ----------------------------------------------------------
  const removePayment = async (payment: Payment) => {
    if (!window.confirm(`¿Eliminar el cobro de ${formatMoney(payment.amount)}? Esta acción queda auditada.`)) return;
    try {
      await dbService.deletePayment(payment.id, user);
      setNotice('Cobro eliminado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el cobro.');
    }
  };

  // ----------------------------------------------------------
  // Gastos
  // ----------------------------------------------------------
  const openExpense = (expense?: Expense) => {
    setEditingExpense(expense || null);
    setExpenseForm(expense ? { ...expense } : {
      date: localTodayISO(), supplier: '', category: 'Otros', specialty: 'general',
      amount: 0, method: 'transferencia', status: 'pagado', reference: '', notes: '',
    });
    setExpenseModal(true);
  };

  const saveExpense = async () => {
    setError('');
    if (!expenseForm.supplier?.trim()) { setError('Indica el proveedor del gasto.'); return; }
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) { setError('Introduce un importe de gasto válido.'); return; }
    setSaving(true);
    try {
      await dbService.saveExpense({ ...expenseForm, amount: Number(expenseForm.amount) }, user);
      setExpenseModal(false);
      setNotice('Gasto guardado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  const removeExpense = async (expense: Expense) => {
    if (!window.confirm(`¿Eliminar el gasto de ${expense.supplier} por ${formatMoney(expense.amount)}?`)) return;
    try {
      await dbService.deleteExpense(expense.id);
      setNotice('Gasto eliminado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el gasto.');
    }
  };

  // ----------------------------------------------------------
  // Bonos
  // ----------------------------------------------------------
  const openPackage = () => {
    setPackageForm({
      patientId: '', name: 'Bono de sesiones', specialty: CLINICAL_SPECIALTIES[0],
      totalSessions: 5, price: 0, purchaseDate: localTodayISO(), expiryDate: addDays(localTodayISO(), 180), notes: '',
    });
    setPackageModal(true);
  };

  const savePackage = async () => {
    setError('');
    if (!packageForm.patientId) { setError('Selecciona el paciente del bono.'); return; }
    if (!packageForm.name?.trim()) { setError('Indica el nombre del bono.'); return; }
    if (!packageForm.totalSessions || Number(packageForm.totalSessions) < 1) { setError('El bono debe tener al menos una sesión.'); return; }
    setSaving(true);
    try {
      await dbService.savePackage({ ...packageForm, totalSessions: Number(packageForm.totalSessions), price: Number(packageForm.price) || 0 });
      setPackageModal(false);
      setNotice('Bono guardado.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el bono.');
    } finally {
      setSaving(false);
    }
  };

  const consumePackage = async (pkg: SessionPackage) => {
    try {
      const ok = await dbService.consumePackageSession(pkg.id);
      if (!ok) { setError('El bono está agotado o no se pudo consumir.'); return; }
      setNotice(`Sesión consumida del bono de ${pkg.patientName || 'paciente'}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo consumir la sesión.');
    }
  };

  // ----------------------------------------------------------
  // Cierre de caja
  // ----------------------------------------------------------
  const closeCash = async () => {
    if (!canManage) return;
    setCashError('');
    if (countedCash === '') { setCashError('Introduce el efectivo contado antes de cerrar caja.'); return; }
    setSaving(true);
    try {
      await dbService.closeCash({
        date: today,
        openingFloat: todayCash.opening,
        totalCash: todayCash.cash,
        totalCard: todayCash.card,
        totalOther: todayCash.other,
        totalExpenses: todayCash.cashExpenses,
        expectedCash: todayCash.expected,
        countedCash: todayCash.counted,
        difference: todayCash.difference,
        notes: cashNotes,
      }, user);
      setNotice('Cierre de caja guardado.');
      setCashError('');
      setCashNotes('');
      setCountedCash('');
      await load();
    } catch (e: any) {
      setCashError(e?.message || 'No se pudo cerrar la caja.');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // Exportación
  // ----------------------------------------------------------
  const exportPayments = () => {
    const rows = payments.filter(p => p.paymentDate >= exportFrom && p.paymentDate <= exportTo);
    downloadCsv(`sinestesya-cobros-${exportFrom}-${exportTo}`, [
      ['Fecha', 'Concepto', 'Importe', 'Método', 'Paciente', 'Profesional', 'Factura', 'Notas'],
      ...rows.map(p => [p.paymentDate, p.concept, p.amount, p.method, p.patientName || '', p.professionalName || '', p.invoiceId || '', p.notes || '']),
    ]);
  };

  const exportInvoices = () => {
    const rows = invoices.filter(i => i.date >= exportFrom && i.date <= exportTo);
    downloadCsv(`sinestesya-facturas-${exportFrom}-${exportTo}`, [
      ['Número', 'Fecha', 'Vencimiento', 'Paciente', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Pendiente', 'Estado'],
      ...rows.map(i => [i.number, i.date, i.dueDate, i.patientName || '', i.subtotal, i.taxAmount, i.total, i.amountPaid, invoicePending(i), i.status]),
    ]);
  };

  const exportExpenses = () => {
    const rows = expenses.filter(e => e.date >= exportFrom && e.date <= exportTo);
    downloadCsv(`sinestesya-gastos-${exportFrom}-${exportTo}`, [
      ['Fecha', 'Proveedor', 'Categoría', 'Importe', 'Método', 'Estado', 'Referencia', 'Notas'],
      ...rows.map(e => [e.date, e.supplier, e.category, e.amount, e.method, e.status, e.reference || '', e.notes || '']),
    ]);
  };

  const exportLedger = () => {
    const rows: (string | number)[][] = [
      ['Fecha', 'Tipo', 'Concepto', 'Importe', 'Método', 'Referencia', 'Notas'],
      ...payments.filter(p => p.paymentDate >= exportFrom && p.paymentDate <= exportTo)
        .map(p => [p.paymentDate, 'Ingreso', p.concept, p.amount, p.method, p.invoiceId || '', p.notes || '']),
      ...expenses.filter(e => e.date >= exportFrom && e.date <= exportTo)
        .map(e => [e.date, 'Gasto', `${e.supplier} · ${e.category}`, -e.amount, e.method, e.reference || '', e.notes || '']),
    ];
    downloadCsv(`sinestesya-libro-${exportFrom}-${exportTo}`, rows);
  };

  const tabs = [
    { id: 'summary', label: 'Resumen', icon: Wallet },
    { id: 'invoices', label: 'Facturas', icon: ReceiptText, count: invoices.length },
    { id: 'payments', label: 'Cobros', icon: CreditCard, count: payments.length },
    { id: 'expenses', label: 'Gastos', icon: TrendingDown, count: expenses.length },
    { id: 'packages', label: 'Bonos', icon: Package, count: packages.length },
    { id: 'cash', label: 'Cierre de caja', icon: Banknote },
    { id: 'export', label: 'Exportar', icon: Download },
  ];

  const renderSummary = () => (
    <div className="space-y-5">
      {error && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}
      {notice && <InlineAlert level="success">{notice}</InlineAlert>}
      {metrics.overdue > 0 && (
        <InlineAlert level="warning" title={`${metrics.overdue} factura(s) vencida(s)`} action={
          <button onClick={() => setTab('invoices')} className={btnSecondary + ' !py-1.5 text-xs'}>Revisar facturas</button>
        }>
          Hay facturas emitidas o con pago parcial cuya fecha de vencimiento ya ha pasado.
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard title="Facturado (mes)" value={formatMoney(metrics.billedMonth)} icon={ReceiptText} tone="blue" hint={`${metrics.invoiceCount} facturas`} />
        <StatCard title="Cobrado (mes)" value={formatMoney(metrics.collectedMonth)} icon={CreditCard} tone="green" hint={`${metrics.paymentCount} movimientos`} />
        <StatCard title="Pendiente de cobro" value={formatMoney(metrics.pending)} icon={AlertTriangle} tone={metrics.pending ? 'orange' : 'neutral'} hint="Facturas no anuladas" />
        <StatCard title="Gastos pagados (mes)" value={formatMoney(metrics.expenseMonth)} icon={TrendingDown} tone="red" />
        <StatCard title="Beneficio de caja" value={formatMoney(metrics.profit)} icon={Euro} tone={metrics.profit >= 0 ? 'green' : 'red'} hint="Cobros − gastos pagados" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Facturación por especialidad" description="Facturas del mes en curso, sin anuladas" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueBySpecialty} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} €`} />
                <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {revenueBySpecialty.map(entry => <Cell key={entry.specialty} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {revenueBySpecialty.map(entry => (
              <div key={entry.specialty} className="rounded-xl border border-stone-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{entry.name}</p>
                <p className="text-sm font-bold text-stone-800">{formatMoney(entry.total)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Caja de hoy" description={todayClosing ? 'Cierre ya registrado' : 'Pendiente de cierre'} actions={
          <button onClick={() => setTab('cash')} className={btnGhost + ' text-xs'}>Abrir cierre</button>
        }>
          <div className="space-y-2 text-sm">
            {[
              ['Efectivo', formatMoney(todayCash.cash)],
              ['Tarjeta', formatMoney(todayCash.card)],
              ['Transferencia / Bizum', formatMoney(todayCash.other)],
              ['Gastos en efectivo', formatMoney(-todayCash.cashExpenses)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                <span className="text-stone-500">{label}</span>
                <span className="font-semibold text-stone-800">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-stone-700">Efectivo esperado</span>
              <span className="text-lg font-bold text-stone-900">{formatMoney(todayCash.expected)}</span>
            </div>
            {todayClosing && (
              <p className="rounded-lg bg-fisio-50 px-3 py-2 text-[11px] text-fisio-800">
                Cerrada por {todayClosing.closedByName || 'administración'} · diferencia {formatMoney(todayClosing.difference)}
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Facturas pendientes" description="Prioriza los vencimientos" padded={false} actions={
          <button onClick={() => setTab('invoices')} className={btnGhost + ' text-xs'}>Ver todas</button>
        }>
          {invoices.filter(i => i.status !== 'anulada' && invoicePending(i) > 0).length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Todo cobrado" description="No hay facturas con importe pendiente." />
          ) : (
            <div className="divide-y divide-stone-100">
              {invoices.filter(i => i.status !== 'anulada' && invoicePending(i) > 0)
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6).map(inv => (
                  <button key={inv.id} onClick={() => setInvoiceDetail(inv)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-800">{inv.number} · {inv.patientName || 'Paciente'}</p>
                      <p className="text-[10px] text-stone-400">Vence {formatDate(inv.dueDate)}{isOverdue(inv) ? ' · vencida' : ''}</p>
                    </div>
                    <span className={`text-sm font-bold ${isOverdue(inv) ? 'text-red-600' : 'text-amber-700'}`}>{formatMoney(invoicePending(inv))}</span>
                  </button>
                ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Últimos cobros" description="Movimientos más recientes" padded={false} actions={
          <button onClick={() => setTab('payments')} className={btnGhost + ' text-xs'}>Ver todos</button>
        }>
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin cobros" />
          ) : (
            <div className="divide-y divide-stone-100">
              {payments.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.amount >= 0 ? 'bg-fisio-50 text-fisio-700' : 'bg-red-50 text-red-600'}`}>
                    <Euro size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-stone-800">{p.concept}</p>
                    <p className="text-[10px] text-stone-400">{formatDate(p.paymentDate)} · {p.method}</p>
                  </div>
                  <span className={`text-sm font-bold ${p.amount >= 0 ? 'text-fisio-700' : 'text-red-600'}`}>{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button onClick={openNewInvoice} className={btnPrimary}><Plus size={15} /> Nueva factura</button>
          <button onClick={() => { setEditingPayment(null); setPaymentModal(true); }} className={btnSecondary}><CreditCard size={15} /> Registrar cobro</button>
          <button onClick={() => openExpense()} className={btnSecondary}><TrendingDown size={15} /> Registrar gasto</button>
          <button onClick={openPackage} className={btnSecondary}><Package size={15} /> Nuevo bono</button>
        </div>
      )}
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-4">
      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-center'}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
          <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar por número o paciente…" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {canManage && <button onClick={openNewInvoice} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Nueva factura</button>}
      </div>

      {filteredInvoices.length === 0 ? (
        <div className={cardClass}><EmptyState icon={ReceiptText} title="Sin facturas" description="Emite una factura desde una cita o créala manualmente." /></div>
      ) : (
        <div className={cardClass + ' overflow-hidden'}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Fecha / vencimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3"><button onClick={() => setInvoiceDetail(inv)} className="font-bold text-stone-800 hover:underline">{inv.number}</button></td>
                    <td className="px-4 py-3 text-xs text-stone-600">{inv.patientName || (patients.find(p => p.id === inv.patientId) ? patientFullName(patients.find(p => p.id === inv.patientId)!) : 'Paciente')}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {formatDate(inv.date)}
                      <span className={`block text-[10px] ${isOverdue(inv) ? 'font-semibold text-red-600' : 'text-stone-400'}`}>Vence {formatDate(inv.dueDate)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">{formatMoney(inv.total)}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-amber-700">{formatMoney(invoicePending(inv))}</td>
                    <td className="px-4 py-3"><Badge className={INVOICE_STATUS_COLORS[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setInvoiceDetail(inv)} className={btnGhost + ' !px-2 !py-1 text-[10px]'}>Ver</button>
                        {canManage && invoicePending(inv) > 0 && inv.status !== 'anulada' && (
                          <button onClick={() => openInvoicePayment(inv)} className={btnGhost + ' border border-fisio-200 !px-2 !py-1 text-[10px] text-fisio-700'}>Cobrar</button>
                        )}
                        {canManage && inv.status === 'borrador' && (
                          <button onClick={() => issueInvoice(inv)} className={btnGhost + ' border border-nutri-200 !px-2 !py-1 text-[10px] text-nutri-700'}>Emitir</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-4">
      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-center'}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
          <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar concepto, paciente, profesional…" value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
          <option value="">Todos los métodos</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {canManage && <button onClick={() => { setEditingPayment(null); setPaymentModal(true); }} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Registrar cobro</button>}
      </div>

      <div className={cardClass + ' overflow-hidden'}>
        {filteredPayments.length === 0 ? (
          <EmptyState icon={CreditCard} title="Sin cobros" description="Registra cobros manuales, pagos de factura o devoluciones." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Paciente / profesional</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3 text-xs text-stone-500">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-stone-800">{p.concept}</p>
                      {p.notes && <p className="text-[10px] text-stone-400">{p.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {p.patientName || '—'}
                      <span className="block text-[10px] text-stone-400">{p.professionalName || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-stone-600">{p.method}</td>
                    <td className={`px-4 py-3 text-right font-bold ${p.amount >= 0 ? 'text-fisio-700' : 'text-red-600'}`}>{formatMoney(p.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => { setEditingPayment(p); setPaymentModal(true); }} className={btnGhost + ' !px-2 !py-1 text-[10px]'}>Editar</button>
                            <button onClick={() => removePayment(p)} className={btnGhost + ' !px-2 !py-1 text-[10px] text-red-600'}><Trash2 size={11} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderExpenses = () => (
    <div className="space-y-4">
      <div className={cardClass + ' flex flex-col gap-2 p-3 md:flex-row md:items-center'}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-stone-400" size={16} />
          <input className={`${inputClass} py-2 pl-10 text-xs`} placeholder="Buscar proveedor, categoría o referencia…" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs text-stone-600" value={expenseStatus} onChange={e => setExpenseStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="pagado">Pagados</option>
          <option value="pendiente">Pendientes</option>
        </select>
        {canManage && <button onClick={() => openExpense()} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Registrar gasto</button>}
      </div>

      <div className={cardClass + ' overflow-hidden'}>
        {filteredExpenses.length === 0 ? (
          <EmptyState icon={TrendingDown} title="Sin gastos" description="Registra proveedores, suministros y gastos del centro." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3 text-xs text-stone-500">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-stone-800">{e.supplier}</p>
                      {e.reference && <p className="text-[10px] text-stone-400">{e.reference}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">{e.category}</td>
                    <td className="px-4 py-3 text-xs capitalize text-stone-500">{e.method}</td>
                    <td className="px-4 py-3">
                      <Badge className={e.status === 'pagado' ? 'border-fisio-200 bg-fisio-50 text-fisio-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">{formatMoney(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => openExpense(e)} className={btnGhost + ' !px-2 !py-1 text-[10px]'}>Editar</button>
                            <button onClick={() => removeExpense(e)} className={btnGhost + ' !px-2 !py-1 text-[10px] text-red-600'}><Trash2 size={11} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderPackages = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">Los bonos descuentan sesiones de forma trazable y no sustituyen al registro clínico.</p>
        {canManage && <button onClick={openPackage} className={btnPrimary + ' !py-2 text-xs'}><Plus size={14} /> Nuevo bono</button>}
      </div>
      {packages.length === 0 ? (
        <div className={cardClass}><EmptyState icon={Package} title="Sin bonos" description="Crea bonos de sesiones para los pacientes que lo necesiten." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map(pkg => {
            const profile = ROLE_PROFILES[pkg.specialty];
            const pct = Math.round((pkg.usedSessions / Math.max(1, pkg.totalSessions)) * 100);
            return (
              <div key={pkg.id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-800">{pkg.name}</p>
                    <p className="text-xs text-stone-500">{pkg.patientName || (patients.find(p => p.id === pkg.patientId) ? patientFullName(patients.find(p => p.id === pkg.patientId)!) : 'Paciente')}</p>
                  </div>
                  <Badge className={`${profile.soft} ${profile.text} ${profile.border}`}>{profile.shortLabel}</Badge>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-stone-500">
                    <span>{pkg.usedSessions} de {pkg.totalSessions} sesiones</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} tone={pkg.status === 'activo' ? profile.solid : 'bg-stone-300'} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                  <span>{formatMoney(pkg.price)} · desde {formatDate(pkg.purchaseDate)}</span>
                  <Badge className={pkg.status === 'activo' ? 'border-fisio-200 bg-fisio-50 text-fisio-800' : 'border-stone-200 bg-stone-50 text-stone-500'}>{pkg.status}</Badge>
                </div>
                {canManage && pkg.status === 'activo' && (
                  <button onClick={() => consumePackage(pkg)} className={btnSecondary + ' mt-3 w-full !py-1.5 text-[11px]'}>
                    <CheckCircle2 size={13} /> Consumir una sesión
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCash = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-1">
        <SectionCard title={`Cierre de caja · ${formatDate(today)}`} description="Arqueo diario de efectivo">
          <div className="space-y-3">
            <Field label="Fondo inicial (€)">
              <input type="number" step="0.01" className={inputClass} value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} />
            </Field>
            <div className="space-y-1.5 rounded-xl bg-stone-50 p-3 text-xs">
              {[
                ['Cobros en efectivo', todayCash.cash],
                ['Cobros con tarjeta', todayCash.card],
                ['Transferencia / Bizum', todayCash.other],
                ['Gastos en efectivo', -todayCash.cashExpenses],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between text-stone-500">
                  <span>{label}</span><span className="font-semibold text-stone-700">{formatMoney(Number(value))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-stone-200 pt-1.5 text-sm">
                <span className="font-semibold text-stone-700">Esperado en caja</span>
                <span className="font-bold text-stone-900">{formatMoney(todayCash.expected)}</span>
              </div>
            </div>
            <Field label="Efectivo contado (€)">
              <input type="number" step="0.01" className={inputClass} value={countedCash} onChange={e => setCountedCash(e.target.value)} placeholder={todayCash.expected.toFixed(2)} />
            </Field>
            <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
              Math.abs(todayCash.difference) < 0.01 ? 'border-fisio-200 bg-fisio-50 text-fisio-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              <span className="font-semibold">Diferencia</span>
              <span className="font-bold">{formatMoney(todayCash.difference)}</span>
            </div>
            <Field label="Notas del cierre">
              <textarea rows={2} className={`${inputClass} resize-y`} value={cashNotes} onChange={e => setCashNotes(e.target.value)} placeholder="Incidencias, cambios, observaciones…" />
            </Field>
            {canManage && cashError && (
              <InlineAlert level="danger">{cashError}</InlineAlert>
            )}
            {canManage && (
              <button onClick={closeCash} className={btnPrimary + ' w-full'} disabled={saving || !!todayClosing}>
                <ShieldCheck size={15} /> {todayClosing ? 'Caja ya cerrada hoy' : saving ? 'Guardando…' : 'Cerrar caja'}
              </button>
            )}
          </div>
        </SectionCard>
        {todayClosing && (
          <InlineAlert level="success" title="Cierre registrado">
            {todayClosing.closedByName || 'Administración'} cerró la caja con una diferencia de {formatMoney(todayClosing.difference)}.
          </InlineAlert>
        )}
      </div>

      <SectionCard title="Historial de cierres" description="Trazabilidad del arqueo diario" className="xl:col-span-2" padded={false}>
        {closings.length === 0 ? (
          <EmptyState icon={Banknote} title="Sin cierres" description="El primer cierre de caja aparecerá aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3 text-right">Efectivo</th>
                  <th className="px-3 py-3 text-right">Tarjeta</th>
                  <th className="px-3 py-3 text-right">Esperado</th>
                  <th className="px-3 py-3 text-right">Contado</th>
                  <th className="px-3 py-3 text-right">Diferencia</th>
                  <th className="px-3 py-3">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {closings.map(c => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-stone-700">{formatDate(c.date)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs">{formatMoney(c.totalCash)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs">{formatMoney(c.totalCard)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs">{formatMoney(c.expectedCash)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs">{formatMoney(c.countedCash)}</td>
                    <td className={`whitespace-nowrap px-3 py-3 text-right text-xs font-bold ${Math.abs(c.difference) < 0.01 ? 'text-fisio-700' : 'text-red-600'}`}>{formatMoney(c.difference)}</td>
                    <td className="px-3 py-3 text-xs text-stone-500">{c.closedByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderExport = () => (
    <div className="space-y-5">
      <SectionCard title="Exportación para asesoría" description="Descarga CSV compatible con Excel (separador ; y UTF-8)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Desde"><input type="date" className={inputClass} value={exportFrom} onChange={e => setExportFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className={inputClass} value={exportTo} onChange={e => setExportTo(e.target.value)} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { label: 'Cobros', desc: 'Ingresos y devoluciones', fn: exportPayments, icon: CreditCard },
            { label: 'Facturas', desc: 'Emitidas, pagadas y pendientes', fn: exportInvoices, icon: ReceiptText },
            { label: 'Gastos', desc: 'Proveedores y categorías', fn: exportExpenses, icon: TrendingDown },
            { label: 'Libro de ingresos y gastos', desc: 'Movimientos combinados', fn: exportLedger, icon: Download },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={item.fn} className={btnSecondary + ' justify-start !px-4 !py-3 text-left'}>
                <Icon size={17} className="shrink-0 text-stone-500" />
                <span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px] font-normal text-stone-400">{item.desc}</span></span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-[11px] text-stone-500">
          <FileText size={14} className="mt-0.5 shrink-0" />
          La exportación se genera en tu navegador. No se envían datos económicos ni clínicos a servidores externos.
        </p>
      </SectionCard>

      <SectionCard title="Resumen del periodo" description={`${exportFrom} → ${exportTo}`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(() => {
            const pays = payments.filter(p => p.paymentDate >= exportFrom && p.paymentDate <= exportTo);
            const exps = expenses.filter(e => e.date >= exportFrom && e.date <= exportTo);
            const invs = invoices.filter(i => i.date >= exportFrom && i.date <= exportTo && i.status !== 'anulada');
            return [
              ['Ingresos', formatMoney(pays.reduce((s, p) => s + p.amount, 0))],
              ['Gastos', formatMoney(exps.reduce((s, e) => s + e.amount, 0))],
              ['Facturado', formatMoney(invs.reduce((s, i) => s + i.total, 0))],
              ['Pendiente', formatMoney(invs.reduce((s, i) => s + invoicePending(i), 0))],
            ];
          })().map(([label, value]) => (
            <div key={label} className="rounded-xl border border-stone-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
              <p className="mt-1 text-lg font-bold text-stone-900">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración · Economía"
        title="Facturación y cobros"
        description="Facturas, cobros parciales, devoluciones, gastos, bonos y cierre de caja en un único flujo."
        icon={Wallet}
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
            {canManage && tab !== 'invoices' && <button onClick={openNewInvoice} className={btnPrimary}><Plus size={15} /> Nueva factura</button>}
          </>
        }
      />

      {error && tab !== 'summary' && <InlineAlert level="danger" title="Aviso">{error}</InlineAlert>}
      {notice && tab !== 'summary' && <InlineAlert level="success">{notice}</InlineAlert>}

      <Tabs items={tabs} active={tab} onChange={changeTab} />

      {loading ? (
        <div className={cardClass + ' p-12 text-center text-sm text-stone-400'}>Cargando facturación…</div>
      ) : (
        <>
          {tab === 'summary' && renderSummary()}
          {tab === 'invoices' && renderInvoices()}
          {tab === 'payments' && renderPayments()}
          {tab === 'expenses' && renderExpenses()}
          {tab === 'packages' && renderPackages()}
          {tab === 'cash' && renderCash()}
          {tab === 'export' && renderExport()}
        </>
      )}

      {/* Modal factura */}
      <Modal
        open={invoiceModal}
        onClose={() => setInvoiceModal(false)}
        title={editingInvoice ? `Editar factura ${editingInvoice.number}` : 'Nueva factura'}
        subtitle="Los datos fiscales del centro se toman de Configuración"
        accent="bg-slate-700"
        size="lg"
        footer={
          <>
            <button onClick={() => setInvoiceModal(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveInvoice} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar factura'}</button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Paciente" required className="sm:col-span-2">
              <select className={inputClass} value={invoiceForm.patientId} onChange={e => { setError(''); setInvoiceForm(prev => ({ ...prev, patientId: e.target.value })); }}>
                <option value="">Seleccionar paciente</option>
                {patients.map(p => <option key={p.id} value={p.id}>{patientFullName(p)} · {p.dni}</option>)}
              </select>
            </Field>
            <Field label="Fecha de emisión"><input type="date" className={inputClass} value={invoiceForm.date} onChange={e => setInvoiceForm(prev => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="Vencimiento"><input type="date" className={inputClass} value={invoiceForm.dueDate} onChange={e => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))} /></Field>
            <Field label="IVA (%)"><input type="number" step="0.5" className={inputClass} value={invoiceForm.taxRate} onChange={e => setInvoiceForm(prev => ({ ...prev, taxRate: e.target.value }))} /></Field>
            <Field label="Estado">
              <select className={inputClass} value={invoiceForm.status} onChange={e => setInvoiceForm(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}>
                <option value="borrador">Borrador</option>
                <option value="emitida">Emitida</option>
                {editingInvoice && editingInvoice.status !== 'borrador' && <option value={editingInvoice.status}>{INVOICE_STATUS_LABELS[editingInvoice.status]}</option>}
              </select>
            </Field>
          </div>

          <div className="rounded-xl border border-stone-200 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Líneas de factura</p>
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs" value="" onChange={e => { if (e.target.value) addInvoiceItem(e.target.value); }}>
                <option value="">+ Añadir servicio…</option>
                {services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} · {formatMoney(s.price)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {invoiceForm.items.map(item => (
                <div key={item.id} className="grid grid-cols-12 items-end gap-1.5">
                  <input className={`${inputClass} col-span-6 !py-1.5 text-xs`} placeholder="Descripción" value={item.description} onChange={e => updateInvoiceItem(item.id, { description: e.target.value })} />
                  <input type="number" min={1} className={`${inputClass} col-span-2 !py-1.5 text-xs`} value={item.quantity} onChange={e => updateInvoiceItem(item.id, { quantity: Number(e.target.value) })} />
                  <input type="number" step="0.01" className={`${inputClass} col-span-3 !py-1.5 text-xs`} value={item.unitPrice} onChange={e => updateInvoiceItem(item.id, { unitPrice: Number(e.target.value) })} />
                  <button onClick={() => setInvoiceForm(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))} className={btnGhost + ' col-span-1 !p-1.5 text-red-500'} title="Quitar línea"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{formatMoney(invoiceTotals.subtotal)}</span></div>
                <div className="flex justify-between text-stone-500"><span>IVA ({invoiceTotals.taxRate}%)</span><span>{formatMoney(invoiceTotals.taxAmount)}</span></div>
                <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-stone-900"><span>Total</span><span>{formatMoney(invoiceTotals.total)}</span></div>
              </div>
            </div>
          </div>

          <Field label="Notas">
            <textarea rows={2} className={`${inputClass} resize-y`} value={invoiceForm.notes} onChange={e => setInvoiceForm(prev => ({ ...prev, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      {/* Detalle factura */}
      <Modal
        open={!!invoiceDetail}
        onClose={() => setInvoiceDetail(null)}
        title={invoiceDetail ? `Factura ${invoiceDetail.number}` : 'Factura'}
        subtitle={invoiceDetail ? `${invoiceDetail.patientName || 'Paciente'} · ${formatDate(invoiceDetail.date)}` : undefined}
        accent="bg-slate-700"
        footer={invoiceDetail ? (
          <>
            <button onClick={() => setInvoiceDetail(null)} className={btnGhost}>Cerrar</button>
            <button onClick={() => printInvoice(invoiceDetail)} className={btnSecondary}><Printer size={15} /> Imprimir / PDF</button>
            {canManage && invoiceDetail.status === 'borrador' && <button onClick={() => issueInvoice(invoiceDetail)} className={btnPrimary}><ReceiptText size={15} /> Emitir</button>}
            {canManage && invoiceDetail.status !== 'anulada' && invoicePending(invoiceDetail) > 0 && (
              <button onClick={() => openInvoicePayment(invoiceDetail)} className={btnPrimary}><CreditCard size={15} /> Registrar cobro</button>
            )}
            {canManage && invoiceDetail.status !== 'anulada' && (
              <button onClick={() => annulInvoice(invoiceDetail)} className={btnDanger}><XCircle size={15} /> Anular</button>
            )}
          </>
        ) : undefined}
      >
        {invoiceDetail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge className={INVOICE_STATUS_COLORS[invoiceDetail.status]}>{INVOICE_STATUS_LABELS[invoiceDetail.status]}</Badge>
              <p className="text-xs text-stone-400">Vence {formatDate(invoiceDetail.dueDate)}</p>
            </div>
            {isOverdue(invoiceDetail) && <InlineAlert level="warning">Esta factura está vencida y tiene {formatMoney(invoicePending(invoiceDetail))} pendientes.</InlineAlert>}
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                  <tr><th className="px-3 py-2">Descripción</th><th className="px-3 py-2 text-right">Cant.</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right">Importe</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoiceDetail.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-stone-700">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{formatMoney(invoiceDetail.subtotal)}</span></div>
              <div className="flex justify-between text-stone-500"><span>IVA ({invoiceDetail.taxRate}%)</span><span>{formatMoney(invoiceDetail.taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-stone-900"><span>Total</span><span>{formatMoney(invoiceDetail.total)}</span></div>
              <div className="flex justify-between text-fisio-700"><span>Pagado</span><span>{formatMoney(invoiceDetail.amountPaid)}</span></div>
              <div className="flex justify-between text-amber-700"><span>Pendiente</span><span>{formatMoney(invoicePending(invoiceDetail))}</span></div>
            </div>
            {invoiceDetail.notes && <p className="rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">{invoiceDetail.notes}</p>}
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">Cobros vinculados</p>
              {payments.filter(p => p.invoiceId === invoiceDetail.id).length === 0 ? (
                <p className="text-xs text-stone-400">Sin cobros vinculados.</p>
              ) : (
                <div className="space-y-1">
                  {payments.filter(p => p.invoiceId === invoiceDetail.id).map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-1.5 text-xs">
                      <span className="text-stone-500">{formatDate(p.paymentDate)} · {p.method}</span>
                      <span className="font-semibold text-fisio-700">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cobro de factura */}
      <Modal
        open={!!invoicePayment}
        onClose={() => setInvoicePayment(null)}
        title="Registrar cobro de factura"
        subtitle={invoicePayment ? `${invoicePayment.number} · pendiente ${formatMoney(invoicePending(invoicePayment))}` : undefined}
        accent="bg-fisio-500"
        size="sm"
        footer={
          <>
            <button onClick={() => setInvoicePayment(null)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={submitInvoicePayment} className={btnPrimary} disabled={saving}><Euro size={15} /> {saving ? 'Registrando…' : 'Registrar cobro'}</button>
          </>
        }
      >
        {invoicePayment && (
          <div className="space-y-3">
            {error && <InlineAlert level="danger">{error}</InlineAlert>}
            <Field label="Importe a cobrar (€)" required>
              <input type="number" step="0.01" className={inputClass} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </Field>
            <Field label="Método">
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.value} type="button" onClick={() => setPayMethod(m.value as PaymentMethod)} className={`rounded-xl border px-2 py-2 text-sm font-semibold ${payMethod === m.value ? 'border-fisio-300 bg-fisio-50 text-fisio-800' : 'border-stone-200 bg-white text-stone-600'}`}>{m.label}</button>
                ))}
              </div>
            </Field>
            <div className="flex gap-2">
              <button onClick={() => setPayAmount(invoicePending(invoicePayment).toFixed(2))} className={btnGhost + ' border border-stone-200 text-xs'}>Cobrar todo</button>
              <button onClick={() => setPayAmount((invoicePending(invoicePayment) / 2).toFixed(2))} className={btnGhost + ' border border-stone-200 text-xs'}>50%</button>
            </div>
            <p className="text-[11px] text-stone-500">Los cobros parciales actualizan la factura a «pago parcial» y generan un movimiento de caja auditado.</p>
          </div>
        )}
      </Modal>

      {/* Modal gasto */}
      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title={editingExpense ? 'Editar gasto' : 'Registrar gasto'}
        subtitle="Proveedores, suministros y gastos del centro"
        accent="bg-nutri-500"
        footer={
          <>
            <button onClick={() => setExpenseModal(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={saveExpense} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar gasto'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Proveedor" required className="sm:col-span-2">
              <input className={inputClass} value={expenseForm.supplier || ''} onChange={e => setExpenseForm(prev => ({ ...prev, supplier: e.target.value }))} />
            </Field>
            <Field label="Fecha"><input type="date" className={inputClass} value={expenseForm.date || ''} onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="Importe (€)" required><input type="number" step="0.01" className={inputClass} value={expenseForm.amount ?? ''} onChange={e => setExpenseForm(prev => ({ ...prev, amount: Number(e.target.value) }))} /></Field>
            <Field label="Categoría">
              <select className={inputClass} value={expenseForm.category || 'Otros'} onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Especialidad">
              <select className={inputClass} value={String(expenseForm.specialty || 'general')} onChange={e => setExpenseForm(prev => ({ ...prev, specialty: e.target.value as any }))}>
                <option value="general">General</option>
                {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Método">
              <select className={inputClass} value={expenseForm.method || 'transferencia'} onChange={e => setExpenseForm(prev => ({ ...prev, method: e.target.value as PaymentMethod }))}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select className={inputClass} value={expenseForm.status || 'pagado'} onChange={e => setExpenseForm(prev => ({ ...prev, status: e.target.value as Expense['status'] }))}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </Field>
            <Field label="Referencia"><input className={inputClass} value={expenseForm.reference || ''} onChange={e => setExpenseForm(prev => ({ ...prev, reference: e.target.value }))} /></Field>
          </div>
          <Field label="Notas"><textarea rows={2} className={`${inputClass} resize-y`} value={expenseForm.notes || ''} onChange={e => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))} /></Field>
        </div>
      </Modal>

      {/* Modal bono */}
      <Modal
        open={packageModal}
        onClose={() => setPackageModal(false)}
        title="Nuevo bono de sesiones"
        subtitle="El consumo queda registrado y es reversible solo desde administración"
        accent="bg-slate-700"
        footer={
          <>
            <button onClick={() => setPackageModal(false)} className={btnGhost} disabled={saving}>Cancelar</button>
            <button onClick={savePackage} className={btnPrimary} disabled={saving}>{saving ? 'Guardando…' : 'Guardar bono'}</button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineAlert level="danger">{error}</InlineAlert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Paciente" required className="sm:col-span-2">
              <select className={inputClass} value={packageForm.patientId || ''} onChange={e => setPackageForm(prev => ({ ...prev, patientId: e.target.value }))}>
                <option value="">Seleccionar paciente</option>
                {patients.map(p => <option key={p.id} value={p.id}>{patientFullName(p)} · {p.dni}</option>)}
              </select>
            </Field>
            <Field label="Nombre del bono" required><input className={inputClass} value={packageForm.name || ''} onChange={e => setPackageForm(prev => ({ ...prev, name: e.target.value }))} /></Field>
            <Field label="Especialidad">
              <select className={inputClass} value={packageForm.specialty || CLINICAL_SPECIALTIES[0]} onChange={e => setPackageForm(prev => ({ ...prev, specialty: e.target.value as any }))}>
                {CLINICAL_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Sesiones"><input type="number" min={1} className={inputClass} value={packageForm.totalSessions ?? 5} onChange={e => setPackageForm(prev => ({ ...prev, totalSessions: Number(e.target.value) }))} /></Field>
            <Field label="Precio (€)"><input type="number" step="0.01" className={inputClass} value={packageForm.price ?? 0} onChange={e => setPackageForm(prev => ({ ...prev, price: Number(e.target.value) }))} /></Field>
            <Field label="Fecha de compra"><input type="date" className={inputClass} value={packageForm.purchaseDate || ''} onChange={e => setPackageForm(prev => ({ ...prev, purchaseDate: e.target.value }))} /></Field>
            <Field label="Caducidad"><input type="date" className={inputClass} value={packageForm.expiryDate || ''} onChange={e => setPackageForm(prev => ({ ...prev, expiryDate: e.target.value }))} /></Field>
          </div>
          <Field label="Notas"><textarea rows={2} className={`${inputClass} resize-y`} value={packageForm.notes || ''} onChange={e => setPackageForm(prev => ({ ...prev, notes: e.target.value }))} /></Field>
        </div>
      </Modal>

      <PaymentModal
        open={paymentModal}
        payment={editingPayment}
        professionals={professionals}
        patients={patients}
        actor={user}
        onClose={() => setPaymentModal(false)}
        onSaved={() => { setPaymentModal(false); setNotice('Cobro guardado.'); load(); }}
      />
    </div>
  );
};

export default Billing;
