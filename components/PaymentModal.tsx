import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Euro, Info } from 'lucide-react';
import { Patient, Payment, PaymentInput, PaymentMethod, User } from '../types';
import { dbService } from '../services/dbService';
import { PAYMENT_CONCEPTS, PAYMENT_METHODS, formatMoney, localTodayISO, patientFullName } from '../constants';
import {
  Field, InlineAlert, Modal, btnGhost, btnPrimary, btnSecondary, inputClass,
} from './ui';

interface PaymentModalProps {
  open: boolean;
  /** Si se pasa, el modal edita ese cobro; si no, crea uno nuevo. */
  payment?: Payment | null;
  /** Datos precargados (p. ej. desde facturación o agenda). */
  defaults?: Partial<PaymentInput>;
  professionals: User[];
  patients: Patient[];
  actor?: User;
  onClose: () => void;
  /** Se dispara tras guardar correctamente (la recarga la hace el padre). */
  onSaved: (payment: Payment) => void;
}

interface FormState {
  concept: string;
  customConcept: string;
  amount: string;
  method: PaymentMethod;
  paymentDate: string;
  professionalId: string;
  patientId: string;
  appointmentId: string;
  invoiceId: string;
  notes: string;
}

const buildInitialForm = (payment?: Payment | null, defaults?: Partial<PaymentInput>): FormState => {
  const source = payment
    ? {
        concept: payment.concept,
        amount: String(payment.amount),
        method: payment.method,
        paymentDate: payment.paymentDate,
        professionalId: payment.professionalId || '',
        patientId: payment.patientId || '',
        appointmentId: payment.appointmentId || '',
        invoiceId: payment.invoiceId || '',
        notes: payment.notes || '',
      }
    : {
        concept: defaults?.concept || 'otro',
        amount: defaults?.amount !== undefined ? String(defaults.amount) : '',
        method: (defaults?.method as PaymentMethod) || 'efectivo',
        paymentDate: defaults?.paymentDate || localTodayISO(),
        professionalId: defaults?.professionalId || '',
        patientId: defaults?.patientId || '',
        appointmentId: defaults?.appointmentId || '',
        invoiceId: defaults?.invoiceId || '',
        notes: defaults?.notes || '',
      };
  const known = PAYMENT_CONCEPTS.some(c => c.value === source.concept);
  return {
    ...source,
    concept: known ? source.concept : 'otro',
    customConcept: known ? '' : source.concept,
  };
};

const PaymentModal: React.FC<PaymentModalProps> = ({
  open, payment, defaults, professionals, patients, actor, onClose, onSaved,
}) => {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(payment, defaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm(payment, defaults));
    setSaving(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const amount = useMemo(() => Number(form.amount.replace(',', '.')), [form.amount]);
  const finalConcept = form.concept === 'otro' ? form.customConcept.trim() : form.concept;

  const submit = async () => {
    setError('');
    if (!finalConcept) { setError('Indica el concepto del movimiento.'); return; }
    if (!form.amount.trim() || Number.isNaN(amount) || amount === 0) { setError('Introduce un importe distinto de cero. Usa un valor negativo para devoluciones.'); return; }
    if (!form.paymentDate) { setError('La fecha es obligatoria.'); return; }
    setSaving(true);
    try {
      const payload: PaymentInput = {
        concept: finalConcept,
        amount: Math.round(amount * 100) / 100,
        method: form.method,
        paymentDate: form.paymentDate,
        professionalId: form.professionalId || null,
        patientId: form.patientId || null,
        appointmentId: form.appointmentId || null,
        invoiceId: form.invoiceId || null,
        notes: form.notes.trim(),
      };
      const saved = payment
        ? await dbService.updatePayment(payment.id, payload, actor)
        : await dbService.createPayment(payload, actor);
      onSaved(saved);
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el cobro.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={payment ? 'Editar cobro' : 'Registrar cobro'}
      subtitle={payment ? 'Los cambios quedan registrados en auditoría' : 'Cobro manual, devolución o ajuste de caja'}
      accent="bg-fisio-500"
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>Cancelar</button>
          <button type="button" onClick={submit} className={btnPrimary} disabled={saving}>
            <Euro size={15} /> {saving ? 'Guardando…' : payment ? 'Guardar cambios' : 'Registrar cobro'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert level="danger">{error}</InlineAlert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Concepto" required>
            <select className={inputClass} value={form.concept} onChange={e => set({ concept: e.target.value })}>
              {PAYMENT_CONCEPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              <option value="otro">Otro / devolución</option>
            </select>
          </Field>
          {form.concept === 'otro' && (
            <Field label="Describe el concepto" required>
              <input className={inputClass} value={form.customConcept} onChange={e => set({ customConcept: e.target.value })} placeholder="Ej. Devolución sesión cancelada" />
            </Field>
          )}
          <Field label="Importe (€)" required hint="Importe negativo para devoluciones.">
            <input type="number" step="0.01" className={inputClass} value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="0,00" />
          </Field>
          <Field label="Fecha" required>
            <input type="date" className={inputClass} value={form.paymentDate} onChange={e => set({ paymentDate: e.target.value })} />
          </Field>
        </div>

        <Field label="Método de pago">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => set({ method: m.value as PaymentMethod })}
                className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                  form.method === m.value
                    ? 'border-fisio-300 bg-fisio-50 text-fisio-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Paciente">
            <select className={inputClass} value={form.patientId} onChange={e => set({ patientId: e.target.value })}>
              <option value="">Sin asignar</option>
              {patients.map(p => <option key={p.id} value={p.id}>{patientFullName(p)} · {p.dni}</option>)}
            </select>
          </Field>
          <Field label="Profesional">
            <select className={inputClass} value={form.professionalId} onChange={e => set({ professionalId: e.target.value })}>
              <option value="">Sin asignar</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas">
          <textarea rows={2} className={`${inputClass} resize-y`} value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Observaciones del cobro o devolución…" />
        </Field>

        <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] text-stone-500">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {form.amount && !Number.isNaN(amount) ? <>Importe: <strong>{formatMoney(amount)}</strong>. </> : null}
            Cada movimiento queda vinculado a su autor y se registra en el historial de auditoría.
          </span>
        </div>

        {form.invoiceId && (
          <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <CreditCard size={12} /> Vinculado a una factura existente.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default PaymentModal;
