// Re-export all types from store for backward compatibility
export type {
  Persona,
  PersonaStore,
  PersonaSnapshot,
  RepoPersonaMapping,
  RepoPersonas,
  PathMapping,
  PathMappings,
} from './store.js';

export type { GitKeys, GpgKey, SshKey } from './store.js';

// Screen types
export type Screen = MainScreen | CreateScreen | EditScreen | DeleteScreen | SwitchScreen | StickyPersonaScreen | ShellPromptScreen | SuccessScreen;

export interface MainScreen {
  type: 'main';
}

export interface CreateScreen {
  type: 'create';
}

export interface EditScreen {
  type: 'edit';
  name: string;
  personaName: string;
}

export interface DeleteScreen {
  type: 'delete';
  personaName: string;
  name: string;
}

export interface SwitchScreen {
  type: 'switch';
}

export interface StickyPersonaScreen {
  type: 'sticky-persona';
  subtype?: 'shell-prompt';
}

export interface ShellPromptScreen {
  type: 'shell-prompt';
  subtype?: 'sticky';
}

export interface SuccessScreen {
  type: 'success';
  message: string;
}