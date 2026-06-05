import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { PersonaStore, Screen } from '../types.js';
import { deletePersona, saveStore } from '../store.js';
import BackButton from './BackButton.js';

interface DeleteScreenProps {
  store: PersonaStore;
  onScreenChange: (screen: Screen) => void;
}

export default function DeleteScreen({ store, onScreenChange }: DeleteScreenProps) {
  const items = store.personas.map((p) => ({
    label: `🗑️  ${p.name} — ${p.user} <${p.email}>`,
    value: p.name,
  }));

  const onSelect = (item: { value: string }) => {
    const updated = deletePersona(item.value, store);
    saveStore(updated);
    onScreenChange({ type: 'success', message: `Deleted persona "${item.value}"` });
  };

  if (store.personas.length === 0) {
    useInput((_input, key) => {
      if (key.return || key.escape) onScreenChange({ type: 'main' });
    });
    return (
      <Box padding={1}>
        <Text>No personas to delete.</Text>
        <Text dimColor>Press Enter or Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🗑️ Select persona to delete</Text>
      <Box marginTop={1} />
      <SelectInput items={items} onSelect={onSelect} />
      <BackButton onBack={() => onScreenChange({ type: 'main' })} />
    </Box>
  );
}
