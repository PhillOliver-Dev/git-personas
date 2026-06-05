import type { Persona, PersonaStore } from './store.js';

export type Screen =
  | { type: 'main' }
  | { type: 'create' }
  | { type: 'edit'; name: string }
  | { type: 'delete' }
  | { type: 'switch' }
  | { type: 'success'; message: string };

export type { Persona, PersonaStore };
