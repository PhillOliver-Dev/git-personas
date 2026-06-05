import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { PersonaStore, Screen } from '../types.js';
import { getPersona } from '../store.js';

interface MainScreenProps {
  store: PersonaStore;
  onScreenChange: (screen: Screen) => void;
  onQuit: () => void;
}

export default function MainScreen({ store, onScreenChange, onQuit }: MainScreenProps) {
  const activePersona = store.active ? getPersona(store.active, store) : null;

  const menuItems = [
    { label: '➕ Create Persona', value: 'create' },
    { label: '✏️  Edit Persona', value: 'edit' },
    { label: '🗑️ Delete Persona', value: 'delete' },
    { label: '🔄 Switch Persona', value: 'switch' },
    { label: '🚪 Quit', value: 'quit' },
  ];

  const onSelect = (item: { value: string }) => {
    switch (item.value) {
      case 'create': onScreenChange({ type: 'create' }); break;
      case 'edit': onScreenChange({ type: 'edit', name: '' }); break;
      case 'delete': onScreenChange({ type: 'delete' }); break;
      case 'switch': onScreenChange({ type: 'switch' }); break;
      case 'quit': onQuit(); break;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🧑‍💼 Git Personas</Text>
      <Box marginTop={1} />

      {activePersona ? (
        <Box>
          <Text color="green">● Active: </Text>
          <Text bold>{activePersona.name}</Text>
          <Text> ({activePersona.user} &lt;{activePersona.email}&gt;)</Text>
        </Box>
      ) : (
        <Text color="yellow">● No active persona</Text>
      )}

      <Box marginTop={1} />

      {store.personas.length > 0 ? (
        <Box flexDirection="column">
          <Text bold>Your personas:</Text>
          {store.personas.map((p) => (
            <Box key={p.name}>
              <Text>
                {'  '}
                {p.name === store.active ? '🟢' : '⚪'} {p.name}
                <Text dimColor> — {p.user} &lt;{p.email}&gt;</Text>
              </Text>
            </Box>
          ))}
          <Box marginTop={1} />
        </Box>
      ) : (
        <Text dimColor>No personas yet. Create one to get started.</Text>
      )}

      <Box marginTop={1} />
      <SelectInput items={menuItems} onSelect={onSelect} />
    </Box>
  );
}
