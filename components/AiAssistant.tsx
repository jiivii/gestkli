
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Sparkles, Bot, Plus, History, Trash2, Save, Maximize2, Minimize2, Lock, AlertCircle, Download, Cloud, Loader2 } from 'lucide-react';
// Correct import as per guidelines
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { dbService } from '../services/dbService';
import { User } from '../types';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface SavedChat {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose, user }) => {
  const [currentChatId, setCurrentChatId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'model', 
      text: `Hola **${user.name.split(' ')[0]}**, soy tu consultor clínico senior. Tus consultas ahora se sincronizan con tu cuenta para que puedas acceder a ellas desde cualquier dispositivo.

¿En qué podemos trabajar hoy? 
- Análisis de casos clínicos.
- Revisión de guías de práctica clínica.
- Estructuración de informes de evolución.` 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        loadCloudHistory();
    }
  }, [isOpen, user.id]);

  const loadCloudHistory = async () => {
    setIsInitialLoading(true);
    const history = await dbService.getAiHistory(user.id);
    const mapped = history.map((h: any) => ({
        id: h.id,
        title: h.title,
        date: new Date(h.updated_at).toLocaleString(),
        messages: h.messages
    }));
    setSavedChats(mapped);
    setIsInitialLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startNewChat = () => {
    setCurrentChatId(crypto.randomUUID());
    setMessages([{ 
      id: '1', 
      role: 'model', 
      text: `Sesión clínica reiniciada. Estoy listo para procesar tu consulta siguiendo protocolos de psicología sanitaria.` 
    }]);
    setLastError(null);
  };

  const syncConversation = async (msgs: Message[]) => {
      const firstUserMsg = msgs.find(m => m.role === 'user')?.text || "Consulta Clínica";
      const title = firstUserMsg.slice(0, 40) + (firstUserMsg.length > 40 ? "..." : "");
      await dbService.saveAiConversation(user.id, currentChatId, title, msgs);
      // Recargar lista lateral para ver cambios en títulos o nuevas entradas
      const history = await dbService.getAiHistory(user.id);
      setSavedChats(history.map((h: any) => ({
          id: h.id, title: h.title, date: new Date(h.updated_at).toLocaleString(), messages: h.messages
      })));
  };

  const handleExport = () => {
    if (messages.length <= 1) return;
    const timestamp = new Date().toLocaleString();
    let content = `# INFORME DE CONSULTORÍA CLÍNICA IA - KLINIKA\n**Fecha:** ${timestamp}\n**Profesional:** ${user.name}\n\n---\n\n`;
    messages.forEach(msg => {
      const role = msg.role === 'user' ? `[PROFESIONAL]` : `[ASISTENTE IA]`;
      content += `### ${role}\n${msg.text}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_Clinico_IA_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSavedChat = (chat: SavedChat) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setLastError(null);
    if (window.innerWidth < 768) setShowHistory(false);
  };

  const deleteSavedChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const success = await dbService.deleteAiConversation(id);
    if (success) {
        setSavedChats(prev => prev.filter(c => c.id !== id));
        if (currentChatId === id) startNewChat();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setLastError(null);
    const userText = input;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: userText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Fix: Follow strictly the SDK initialization guidelines using process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `Actúas como un Psicólogo Sanitario o Clínico Senior especializado en TCC y ACT. Tu objetivo es ofrecer orientación técnica basada en la evidencia. Responde siempre de forma profesional, estructurada y empática. Usa Markdown (negritas, listas, tablas). No proporcionas diagnósticos definitivos, sino apoyo al razonamiento del profesional.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        config: { systemInstruction, temperature: 0.7 }
      });

      // Fix: Access response.text as a property, not a method, as per SDK documentation
      const text = response.text || "Lo siento, hubo un error procesando la respuesta.";
      const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text };
      const finalMessages = [...updatedMessages, modelMsg];
      setMessages(finalMessages);
      
      // Sincronizar con Supabase
      await syncConversation(finalMessages);

    } catch (error: any) {
      const errorMsg = error.message?.includes("429") ? "Cuota agotada temporalmente." : "Error de conexión.";
      setLastError(errorMsg);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'model', text: `AVISO: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-md" onClick={onClose} />
      <div className={`fixed z-[9999] bg-white shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${isFullScreen ? 'inset-0' : 'inset-4 md:inset-10 lg:inset-x-24 lg:inset-y-12 rounded-2xl'}`}>
        {/* Header */}
        <div className="bg-primary-800 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg"><Sparkles size={20} className="text-yellow-300" /></div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Consultoría Clínica IA</h2>
              <p className="text-[10px] text-primary-200 uppercase tracking-widest font-bold flex items-center">
                <Cloud size={10} className="mr-1"/> Sincronizado con {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden ${showHistory ? 'w-full md:w-80' : 'w-0'}`}>
            <div className="p-4 border-b bg-white flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center">Historial en la Nube</span>
            </div>
            <div className="p-4 shrink-0">
              <button onClick={startNewChat} className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold text-sm shadow-md transition-all">
                <Plus size={18} className="mr-2" /> Nueva Sesión
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-2 pb-4">
              {isInitialLoading ? (
                  <div className="p-8 text-center flex flex-col items-center text-gray-400">
                      <Loader2 size={24} className="animate-spin mb-2" />
                      <span className="text-xs">Recuperando chats...</span>
                  </div>
              ) : savedChats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs italic">No hay consultas en tu cuenta</div>
              ) : (
                savedChats.map(chat => (
                  <div key={chat.id} onClick={() => loadSavedChat(chat)} className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${currentChatId === chat.id ? 'bg-white border-primary-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-100'}`}>
                    <div className="pr-6">
                      <p className={`text-sm font-semibold truncate ${currentChatId === chat.id ? 'text-primary-700' : 'text-gray-700'}`}>{chat.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{chat.date}</p>
                    </div>
                    <button onClick={(e) => deleteSavedChat(e, chat.id)} className="absolute right-2 top-3 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col bg-white min-w-0">
            <div className="h-14 border-b border-gray-100 px-6 flex items-center justify-between bg-white z-10">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowHistory(!showHistory)} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg md:hidden"><History size={20} /></button>
                <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-sm font-bold text-gray-700">Canal de Evidencia Clínico</span></div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleExport} disabled={messages.length <= 1} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 disabled:opacity-50 transition-colors">
                  <Download size={14} className="mr-1.5"/> Exportar
                </button>
              </div>
            </div>

            {lastError && <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-xs">{lastError}</div>}

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50/50">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    {msg.role === 'model' && (
                      <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center mr-4 shadow-lg shrink-0 border-2 border-white">
                        <Bot size={20} className="text-white"/>
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl p-4 md:p-6 text-sm border shadow-sm ${
                      msg.role === 'user' ? 'bg-primary-700 text-white rounded-br-none border-primary-800' : 'bg-white text-gray-800 border-gray-200 rounded-bl-none'
                    }`}>
                      {msg.role === 'model' ? (
                        <article className="prose prose-sm prose-slate max-w-none prose-headings:text-primary-800 prose-headings:mb-2 prose-strong:text-primary-900">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </article>
                      ) : <p>{msg.text}</p>}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center space-x-3 p-4 bg-white border border-gray-100 rounded-2xl w-fit shadow-md animate-pulse">
                    <Loader2 size={18} className="text-primary-600 animate-spin" />
                    <span className="text-xs font-bold text-primary-700">Sincronizando razonamiento...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 md:p-8 bg-white border-t border-gray-100">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSend} className="relative group">
                  <textarea rows={2} disabled={isLoading} placeholder="Escribe tu consulta..." className="w-full pl-6 pr-16 py-4 border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 bg-gray-50 focus:bg-white transition-all resize-none shadow-sm" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }} />
                  <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-3 bottom-3 p-3 bg-primary-700 text-white rounded-xl hover:bg-primary-800 disabled:opacity-50 shadow-lg active:scale-95 transition-all">
                    <Send size={20} />
                  </button>
                </form>
                <div className="mt-4 flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                  <p className="flex items-center italic"><Lock size={10} className="mr-1"/> Cifrado de extremo a extremo.</p>
                  <p className="bg-gray-50 px-2 py-1 rounded border border-gray-100">CLOUD SYNC ACTIVE</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default AiAssistant;
