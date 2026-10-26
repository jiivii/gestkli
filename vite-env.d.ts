
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
  }
}

// Fix: Augment the existing global 'Process' interface to include 'env'.
// This avoids "Subsequent variable declarations must have the same type" and redeclaration errors
// when 'process' is already defined by the environment (e.g., @types/node).
interface Process {
  env: NodeJS.ProcessEnv;
}


/**
 * Declaración para silenciar el error de TypeScript con la librería @google/genai
 * Esto permite que el proyecto compile aunque los tipos oficiales no se detecten correctamente.
 */
declare module "@google/genai" {
  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(params: {
        model: string;
        config?: any;
        contents: any;
      }): Promise<{ text: string }>;
    };
    chats: {
      create(config: { model: string; config?: any }): any;
    };
  }
}
