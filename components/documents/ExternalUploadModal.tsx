import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileUp, ShieldCheck, Upload } from 'lucide-react';
import {
  CenterSettings, ClinicalSpecialty, DocumentCategory, Patient, SignatureCondition, User,
} from '../../types';
import { Badge, Field, InlineAlert, Modal, btnGhost, btnPrimary, inputClass } from '../ui';
import { DOCUMENT_CATEGORIES, SIGNATURE_CONDITION_LABELS, categoryMeta } from '../../services/documentTemplates';
import { uploadExternallySignedDocument } from '../../services/documentService';
import { CLINICAL_SPECIALTIES, formatDate, patientFullName } from '../../constants';

interface Props {
  open: boolean;
  patient: Patient;
  user: User;
  settings: CenterSettings;
  onClose: () => void;
  onCreated: (document: any) => void;
}

const conditions: SignatureCondition[] = ['paciente', 'representante_legal', 'representante_legal_2', 'tutor', 'otro'];

const ExternalUploadModal: React.FC<Props> = ({ open, patient, user, settings, onClose, onCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('general');
  const [specialty, setSpecialty] = useState<ClinicalSpecialty | ''>('');
  const [signedByName, setSignedByName] = useState('');
  const [signedByCondition, setSignedByCondition] = useState<SignatureCondition>('paciente');
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setNotice('');
    setFile(null);
    setTitle('Documento firmado externamente');
    setCategory('general');
    setSpecialty('');
    setSignedByName(patientFullName(patient));
    setSignedByCondition('paciente');
    setSignedAt(new Date().toISOString().slice(0, 10));
    setMethod('');
    setNotes('');
    setVerified(false);
    setSaving(false);
  }, [open, patient]);

  if (!open) return null;

  const selectCategory = (value: DocumentCategory) => {
    setCategory(value);
    if (value === 'psicologia' || value === 'fisioterapia' || value === 'nutricion' || value === 'logopedia') {
      setSpecialty(value as ClinicalSpecialty);
    } else if (value === 'privacidad' || value === 'general') {
      setSpecialty('');
    }
  };

  const selectCondition = (value: SignatureCondition) => {
    setSignedByCondition(value);
    if (value === 'representante_legal') setSignedByName(patient.legalGuardian?.name || '');
    else if (value === 'representante_legal_2' || value === 'tutor') setSignedByName(patient.secondaryLegalGuardian?.name || patient.legalGuardian?.name || '');
    else if (value === 'paciente') setSignedByName(patientFullName(patient));
  };

  const submit = async () => {
    setError('');
    setNotice('');
    if (!file) {
      setError('Selecciona el PDF firmado.');
      return;
    }
    if (!verified) {
      setError('Confirma que has comprobado el archivo, el firmante y la representación.');
      return;
    }
    setSaving(true);
    try {
      const document = await uploadExternallySignedDocument({
        patient, actor: user, settings, file, title, category,
        specialty: specialty || null, signedByName, signedByCondition, signedAt, method, notes,
      });
      setNotice('Documento externo archivado con huella SHA-256.');
      onCreated(document);
    } catch (e: any) {
      setError(e?.message || 'No se pudo incorporar el documento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Incorporar documento firmado externamente"
      subtitle={`${patientFullName(patient)} · verificación e incorporación al expediente`}
      size="lg"
      accent="bg-logo-700"
      footer={
        <>
          <button className={btnGhost} onClick={onClose} disabled={saving}>Cerrar</button>
          <button className={btnPrimary} onClick={submit} disabled={saving}>
            <Upload size={15} /> {saving ? 'Verificando…' : 'Verificar y archivar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert level="danger" title="No se ha archivado">{error}</InlineAlert>}
        {notice && <InlineAlert level="success" title="Documento incorporado">{notice}</InlineAlert>}

        <InlineAlert level="warning" title="Verificación manual obligatoria">
          Solo para documentos firmados fuera de la plataforma. Comprueba el archivo, quién firma y con qué representación. La huella SHA-256 acredita que el archivo no cambia desde su incorporación, no la validez jurídica de la firma externa.
        </InlineAlert>

        <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/60 p-5 text-center">
          <FileUp size={26} className="mx-auto text-stone-400" />
          <p className="mt-2 text-sm font-semibold text-stone-700">{file ? file.name : 'Selecciona un PDF firmado'}</p>
          <p className="mt-0.5 text-[11px] text-stone-500">Máximo 3 MB · solo PDF · se calcula la huella al incorporarlo</p>
          <label className={btnPrimary + ' mt-3 cursor-pointer'}>
            <Upload size={15} /> {file ? 'Cambiar archivo' : 'Elegir PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Título del documento" required className="md:col-span-2">
            <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} />
          </Field>
          <Field label="Categoría" required>
            <select className={inputClass} value={category} onChange={e => selectCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Especialidad" hint="Obligatoria para documentos clínicos si la categoría no la determina.">
            <select className={inputClass} value={specialty} onChange={e => setSpecialty(e.target.value as ClinicalSpecialty | '')}>
              <option value="">Transversal / no aplica</option>
              {CLINICAL_SPECIALTIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Firmante (nombre completo)" required>
            <input className={inputClass} value={signedByName} onChange={e => setSignedByName(e.target.value)} />
          </Field>
          <Field label="Condición del firmante" required>
            <select className={inputClass} value={signedByCondition} onChange={e => selectCondition(e.target.value as SignatureCondition)}>
              {conditions.map(condition => <option key={condition} value={condition}>{SIGNATURE_CONDITION_LABELS[condition]}</option>)}
            </select>
          </Field>
          <Field label="Fecha de firma" required>
            <input className={inputClass} type="date" value={signedAt} onChange={e => setSignedAt(e.target.value)} />
          </Field>
          <Field label="Método y verificación externa" required hint="Ejemplo: firma manuscrita escaneada y verificada presencialmente; proveedor externo X con certificado; etc.">
            <input className={inputClass} value={method} onChange={e => setMethod(e.target.value)} placeholder="No afirmes un nivel que no puedas acreditar" />
          </Field>
          <Field label="Observaciones" className="md:col-span-2">
            <textarea className={inputClass + ' min-h-[80px]'} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Incidencias, comprobaciones, documentación adjunta…" />
          </Field>
        </div>

        <div className={`rounded-xl border p-3 ${categoryMeta(category).tone}`}>
          <Badge className={categoryMeta(category).tone}>{categoryMeta(category).short}</Badge>
          <p className="mt-1 text-[11px] opacity-80">{categoryMeta(category).description}</p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-stone-300 bg-white p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={verified} onChange={e => setVerified(e.target.checked)} />
          <span>
            <strong className="block text-stone-800">He verificado el archivo y la representación</strong>
            <span className="text-xs leading-relaxed text-stone-500">El PDF corresponde a este paciente, está firmado, el firmante y su condición son correctos y no se está sustituyendo un documento válido sin dejar trazabilidad. La fecha declarada es {signedAt ? formatDate(signedAt) : '—'}.</span>
          </span>
        </label>

        <div className="flex items-center gap-2 text-[10px] text-stone-500">
          <ShieldCheck size={13} /> Se archivará como documento externo verificado, con autor, fecha de incorporación, huella y evento de auditoría.
        </div>
        <div className="flex items-center gap-2 text-[10px] text-amber-700">
          <AlertTriangle size={13} /> Si el documento es de un menor, la firma del progenitor no se presume suficiente: revisa la representación en la ficha.
        </div>
      </div>
    </Modal>
  );
};

export default ExternalUploadModal;
