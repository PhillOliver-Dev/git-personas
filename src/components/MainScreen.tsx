import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { PersonaStore, Screen } from '../types.js';
import { getPersona } from '../store.js';
import { isStickyEnabled } from '../hooks/setup.js';

interface MainScreenProps {
  store: PersonaStore;
  onScreenChange: (screen: Screen) => void;
  onQuit: () => void;
}

export default function MainScreen({ store, onScreenChange, onQuit }: MainScreenProps) {
  const activePersona = store.active ? getPersona(store.active, store) : null;
  const stickyEnabled = isStickyEnabled();

  const menuItems = [
    { label: '➕ Create Persona', value: 'create' },
    { label: '✏️  Edit Persona', value: 'edit' },
    { label: '🗑️  Delete Persona', value: 'delete' },
    { label: '🔄 Switch Persona', value: 'switch' },
    { label: `📌 Sticky Personas ${stickyEnabled ? '(enabled)' : '(disabled)'}`, value: 'sticky' },
    { label: '🚪 Quit', value: 'quit' },
  ];

  const onSelect = (item: { value: string }) => {
    switch (item.value) {
      case 'create': onScreenChange({ type: 'create' }); break;
      case 'edit': onScreenChange({ type: 'edit', personaName: '', name: '' }); break;
      case 'delete': onScreenChange({ type: 'delete', personaName: '', name: '' }); break;
      case 'switch': onScreenChange({ type: 'switch' }); break;
      case 'sticky': onScreenChange({ type: 'sticky-persona' }); break;
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
          <Text> ({activePersona.user} {'<'}{activePersona.email}{'>'})</Text>
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
                <Text dimColor> — {p.user} {'<'}{p.email}{'>'}</Text>
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