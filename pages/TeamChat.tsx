import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, LockKeyhole, MessageSquare, MessageSquarePlus,
  RefreshCw, Search, Send, ShieldCheck, UserPlus,
} from 'lucide-react';
import { ChatMessage, ChatRoom, User } from '../types';
import { dbService, isDemoMode } from '../services/dbService';
import { getProfessionalLabel } from '../constants';
import {
  Avatar, Badge, EmptyState, Field, InlineAlert, Modal, PageHeader, SectionCard,
  btnGhost, btnPrimary, btnSecondary, inputClass,
} from '../components/ui';

interface TeamChatProps {
  user: User;
}

const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return 'Hoy';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

const roomDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return timeLabel(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const TeamChat: React.FC<TeamChatProps> = ({ user }) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef<ChatRoom | null>(null);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  const loadRooms = useCallback(async () => {
    try {
      const data = await dbService.getRooms(user.id);
      const visible = data.filter(room => !room.participants?.length || room.participants.some(p => p.id === user.id));
      setRooms(visible);
      const current = activeRoomRef.current;
      if (current) {
        const fresh = visible.find(r => r.id === current.id);
        if (fresh) setActiveRoom(fresh);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las conversaciones.');
    }
  }, [user.id]);

  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await dbService.getMessages(roomId);
      setMessages(data);
    } catch (e: any) {
      if (!silent) setError(e?.message || 'No se pudieron cargar los mensajes.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const initialLoad = async () => {
    setLoading(true);
    setError('');
    try {
      const [profs] = await Promise.all([dbService.getProfessionals()]);
      setProfessionals(profs.filter(p => p.id !== user.id));
      await loadRooms();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la mensajería.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { initialLoad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id]);

  useEffect(() => {
    if (!activeRoom) { setMessages([]); return; }
    loadMessages(activeRoom.id);
    // Actualización periódica sin suscripciones directas: funciona igual en demo y producción.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(activeRoom.id, true);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [activeRoom?.id, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const visibleRooms = useMemo(() => {
    const term = roomSearch.trim().toLowerCase();
    return rooms.filter(room => !term || room.name.toLowerCase().includes(term));
  }, [rooms, roomSearch]);

  const filteredProfessionals = useMemo(() => {
    const term = professionalSearch.trim().toLowerCase();
    return professionals.filter(p => {
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || getProfessionalLabel(p).toLowerCase().includes(term);
    });
  }, [professionals, professionalSearch]);

  const openRoom = (room: ChatRoom) => {
    setActiveRoom(room);
    setError('');
  };

  const startConversation = async (otherUserId: string) => {
    setCreating(true);
    setError('');
    try {
      const result = await dbService.createDirectChat(user.id, otherUserId);
      if (!result.success || !result.roomId) throw new Error(result.error || 'No se pudo crear la conversación.');
      await loadRooms();
      const other = professionals.find(p => p.id === otherUserId);
      const room = rooms.find(r => r.id === result.roomId) || {
        id: result.roomId,
        type: 'direct' as const,
        name: other?.name || 'Conversación directa',
        updatedAt: new Date().toISOString(),
        participants: other ? [other] : [],
      };
      setActiveRoom(room);
      setShowNewChat(false);
      setProfessionalSearch('');
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la conversación.');
    } finally {
      setCreating(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || !activeRoom || sending) return;

    setSending(true);
    setError('');
    setInput('');

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      roomId: activeRoom.id,
      senderId: user.id,
      senderName: user.name,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const ok = await dbService.sendMessage(activeRoom.id, user.id, content);
      if (!ok) throw new Error('El mensaje no se pudo guardar.');
      await loadMessages(activeRoom.id, true);
      await loadRooms();
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
      setError(e?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const activeParticipants = activeRoom?.participants?.filter(p => p.id !== user.id) || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Equipo"
        title="Mensajería interna"
        description="Comunicación entre profesionales del centro. No sustituye a la historia clínica ni al consentimiento informado."
        icon={MessageSquare}
        accent="bg-slate-700"
        actions={
          <>
            <button onClick={() => { setError(''); initialLoad(); }} className={btnSecondary} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button onClick={() => setShowNewChat(true)} className={btnPrimary}>
              <MessageSquarePlus size={16} /> Nueva conversación
            </button>
          </>
        }
      />

      {isDemoMode && (
        <InlineAlert level="warning" title="Entorno de demostración">
          Los mensajes son ficticios y se guardan solo en este navegador. No escribas información de pacientes reales.
        </InlineAlert>
      )}

      <InlineAlert level="info" title="Privacidad de las comunicaciones">
        Usa la mensajería solo para coordinación administrativa y organizativa. No compartas informes, diagnósticos
        ni datos identificativos de pacientes: la historia clínica y los documentos firmados tienen sus propios
        canales y permisos. Los adjuntos permanecen deshabilitados hasta configurar un almacenamiento privado.
      </InlineAlert>

      {error && (
        <InlineAlert level="danger" title="Incidencia" action={<button onClick={() => setError('')} className={btnSecondary}>Cerrar</button>}>
          {error}
        </InlineAlert>
      )}

      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(41,37,36,0.04)] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Lista de conversaciones */}
        <aside className={`flex min-h-[560px] flex-col border-stone-200 lg:border-r ${activeRoom ? 'hidden lg:flex' : 'flex'}`}>
          <div className="border-b border-stone-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-stone-800">Conversaciones</p>
              <Badge>{rooms.length}</Badge>
            </div>
            <div className="relative mt-3">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
                placeholder="Buscar conversación"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-sm text-stone-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
                Cargando conversaciones…
              </div>
            ) : !visibleRooms.length ? (
              <EmptyState
                icon={MessageSquarePlus}
                title={rooms.length ? 'Sin coincidencias' : 'Aún no hay conversaciones'}
                description={rooms.length ? 'Prueba con otro nombre.' : 'Inicia una conversación directa con un compañero.'}
                action={!rooms.length ? <button onClick={() => setShowNewChat(true)} className={btnSecondary}>Nueva conversación</button> : undefined}
              />
            ) : (
              visibleRooms.map(room => {
                const selected = activeRoom?.id === room.id;
                const others = room.participants?.filter(p => p.id !== user.id) || [];
                return (
                  <button
                    key={room.id}
                    onClick={() => openRoom(room)}
                    className={`flex w-full items-center gap-3 border-b border-stone-50 px-4 py-3.5 text-left transition-colors ${
                      selected ? 'border-l-2 border-l-stone-700 bg-stone-50' : 'hover:bg-stone-50/70'
                    }`}
                  >
                    <Avatar name={room.type === 'group' ? room.name : others[0]?.name || room.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-stone-800">{room.name}</p>
                        <span className="shrink-0 text-[10px] text-stone-400">{roomDate(room.updatedAt)}</span>
                      </div>
                      <p className="truncate text-[11px] text-stone-400">
                        {room.type === 'group' ? `${room.participants?.length || 0} participantes` : 'Conversación directa'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversación */}
        <section className={`flex min-h-[560px] flex-col ${!activeRoom ? 'hidden lg:flex' : 'flex'}`}>
          {!activeRoom ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-stone-50/40 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm">
                <MessageSquare size={24} />
              </div>
              <p className="text-sm font-semibold text-stone-700">Selecciona una conversación</p>
              <p className="mt-1 max-w-sm text-sm text-stone-500">
                Elige un chat de la lista o crea uno nuevo con otro profesional del centro.
              </p>
              <button onClick={() => setShowNewChat(true)} className={`${btnSecondary} mt-4`}>
                <UserPlus size={16} /> Nueva conversación
              </button>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setActiveRoom(null)} className={`${btnGhost} -ml-1 px-2 lg:hidden`} aria-label="Volver">
                    <ArrowLeft size={18} />
                  </button>
                  <Avatar name={activeParticipants[0]?.name || activeRoom.name} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-800">{activeRoom.name}</p>
                    <p className="flex items-center gap-1 text-[11px] text-stone-400">
                      <LockKeyhole size={11} /> Uso interno
                      {activeRoom.type === 'group' && activeParticipants.length > 0 && ` · ${activeParticipants.length} compañeros`}
                    </p>
                  </div>
                </div>
                <Badge className="hidden border-fisio-200 bg-fisio-50 text-fisio-800 sm:inline-flex">
                  <ShieldCheck size={11} /> Solo equipo
                </Badge>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f6] p-4">
                {loadingMessages && !messages.length ? (
                  <div className="flex items-center justify-center py-12 text-sm text-stone-400">Cargando mensajes…</div>
                ) : !messages.length ? (
                  <div className="py-12 text-center text-sm text-stone-400">
                    Todavía no hay mensajes. Escribe el primero para iniciar la conversación.
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const mine = message.senderId === user.id;
                    const previous = messages[index - 1];
                    const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                    return (
                      <React.Fragment key={message.id}>
                        {newDay && (
                          <p className="py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">
                            {dayLabel(message.createdAt)}
                          </p>
                        )}
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex max-w-[85%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                            {!mine && activeRoom.type === 'group' && (
                              <p className="mb-0.5 px-1 text-[10px] font-semibold text-stone-500">{message.senderName}</p>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                mine
                                  ? 'rounded-br-md bg-stone-800 text-white'
                                  : 'rounded-bl-md border border-stone-200 bg-white text-stone-800'
                              } ${message.id.startsWith('temp-') ? 'opacity-60' : ''}`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            <p className="mt-1 px-1 text-[10px] text-stone-400">
                              {timeLabel(message.createdAt)}{message.id.startsWith('temp-') ? ' · enviando…' : ''}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={send} className="border-t border-stone-100 bg-white p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                    rows={1}
                    placeholder="Escribe un mensaje de coordinación…"
                    className={`${inputClass} max-h-32 min-h-[44px] resize-y py-2.5`}
                  />
                  <button type="submit" disabled={!input.trim() || sending} className={`${btnPrimary} h-[44px] px-3.5`} aria-label="Enviar mensaje">
                    <Send size={17} />
                  </button>
                </div>
                <p className="mt-1.5 flex items-start gap-1 text-[10px] text-stone-400">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  No incluyas datos clínicos ni identificativos de pacientes en mensajes internos.
                </p>
              </form>
            </>
          )}
        </section>
      </div>

      <Modal
        open={showNewChat}
        onClose={() => { setShowNewChat(false); setProfessionalSearch(''); }}
        title="Nueva conversación"
        subtitle="Selecciona un profesional del centro."
        size="sm"
        footer={<button onClick={() => setShowNewChat(false)} className={btnSecondary}>Cancelar</button>}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={professionalSearch}
              onChange={e => setProfessionalSearch(e.target.value)}
              placeholder="Buscar por nombre o especialidad"
              className={`${inputClass} pl-9`}
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-stone-100">
            {!filteredProfessionals.length ? (
              <p className="px-4 py-8 text-center text-sm text-stone-400">
                {professionals.length ? 'No hay coincidencias.' : 'No hay otros profesionales registrados.'}
              </p>
            ) : (
              filteredProfessionals.map(professional => (
                <button
                  key={professional.id}
                  onClick={() => startConversation(professional.id)}
                  disabled={creating}
                  className="flex w-full items-center gap-3 border-b border-stone-50 px-3 py-3 text-left transition-colors last:border-0 hover:bg-stone-50 disabled:opacity-60"
                >
                  <Avatar name={professional.name} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{professional.name}</p>
                    <p className="truncate text-xs text-stone-400">{getProfessionalLabel(professional)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            Si ya existe una conversación directa con esa persona, se reutilizará la misma.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default TeamChat;
