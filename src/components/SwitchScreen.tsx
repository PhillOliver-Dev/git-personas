import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { PersonaStore, Screen } from '../types.js';
import { getPersona, applyPersona, clearActivePersona, setActive, saveStore } from '../store.js';
import BackButton from './BackButton.js';

interface SwitchScreenProps {
  store: PersonaStore;
  onScreenChange: (screen: Screen) => void;
}

export default function SwitchScreen({ store, onScreenChange }: SwitchScreenProps) {
  const items = [
    { label: '⚪  (none — clear active persona)', value: '__none__' },
    ...store.personas.map((p) => ({
      label: `${p.name === store.active ? '🟢' : '⚪'} ${p.name} — ${p.user} <${p.email}>`,
      value: p.name,
    })),
  ];

  const onSelect = (item: { value: string }) => {
    if (item.value === '__none__') {
      clearActivePersona();
      const updated = setActive(null, store);
      saveStore(updated);
      onScreenChange({ type: 'success', message: 'Cleared active persona' });
    } else {
      const persona = getPersona(item.value, store);
      if (persona) {
        applyPersona(persona);
        const updated = setActive(item.value, store);
        saveStore(updated);
        onScreenChange({ type: 'success', message: `Switched to "${item.value}"` });
      }
    }
  };

  // Always call hooks before conditional returns
  useInput((_input, key) => {
    if (key.escape) onScreenChange({ type: 'main' });
  });

  if (store.personas.length === 0) {
    return (
      <Box padding={1}>
        <Text>No personas to switch to.</Text>
        <Text dimColor>Press Enter or Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🔄 Switch Active Persona</Text>
      <Box marginTop={1} />
      <SelectInput items={items} onSelect={onSelect} />
      <BackButton />
    </Box>
  );
}