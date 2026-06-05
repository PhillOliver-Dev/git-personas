import React, { useState, useMemo } from 'react';
import { useInput, useApp } from 'ink';
import type { Screen } from './types.js';
import { loadStore, saveStore, ensureConfigDir, addPersona, updatePersona, getPersona, applyPersona, importCurrentProfile } from './store.js';
import MainScreen from './components/MainScreen.js';
import PersonaForm from './components/PersonaForm.js';
import EditSelectScreen from './components/EditSelectScreen.js';
import DeleteScreen from './components/DeleteScreen.js';
import SwitchScreen from './components/SwitchScreen.js';
import SuccessScreen from './components/SuccessScreen.js';
import StickyPersonaScreen from './components/StickyPersonaScreen.js';

export default function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>({ type: 'main' });

  // Global: Escape on main screen quits the app
  useInput((_input, key) => {
    if (key.escape && screen.type === 'main') {
      exit();
    }
  });

  // Load store once, importing current git profile on first launch
  const store = useMemo(() => {
    const loaded = loadStore();
    const imported = importCurrentProfile(loaded);
    if (imported !== loaded) {
      saveStore(imported);
    }
    return imported;
  }, []);

  switch (screen.type) {
    case 'main':
      return (
        <MainScreen
          store={store}
          onScreenChange={setScreen}
          onQuit={exit}
        />
      );

    case 'create': {
      return (
        <PersonaForm
          title="➕ Create Persona"
          onSubmit={(persona) => {
            try {
              ensureConfigDir();
              const updated = addPersona(persona, store);
              saveStore(updated);
              setScreen({ type: 'success', message: `Created persona "${persona.name}"` });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              setScreen({ type: 'success', message: `Error: ${msg}` });
            }
          }}
          onCancel={() => setScreen({ type: 'main' })}
        />
      );
    }

    case 'edit': {
      if (!screen.name) {
        return (
          <EditSelectScreen store={store} onScreenChange={setScreen} />
        );
      }
      const persona = getPersona(screen.name, store);
      if (!persona) {
        return (
          <SuccessScreen
            message="Persona not found."
            onContinue={() => setScreen({ type: 'main' })}
            onQuit={exit}
          />
        );
      }
      return (
        <PersonaForm
          title={`✏️ Edit "${persona.name}"`}
          initial={persona}
          onSubmit={(updated) => {
            const newStore = updatePersona(screen.name, updated, store);
            saveStore(newStore);
            if (store.active === screen.name) {
              applyPersona(updated);
            }
            setScreen({ type: 'success', message: `Updated persona "${persona.name}"` });
          }}
          onCancel={() => setScreen({ type: 'main' })}
        />
      );
    }

    case 'delete':
      return <DeleteScreen store={store} onScreenChange={setScreen} />;

    case 'switch':
      return <SwitchScreen store={store} onScreenChange={setScreen} />;

    case 'sticky':
      return <StickyPersonaScreen onScreenChange={setScreen} onQuit={exit} />;

    case 'success':
      return (
        <SuccessScreen
          message={screen.message}
          onContinue={() => setScreen({ type: 'main' })}
          onQuit={exit}
        />
      );
  }
}
