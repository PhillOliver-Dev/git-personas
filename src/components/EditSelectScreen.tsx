import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { PersonaStore, Screen } from '../types.js';
import BackButton from './BackButton.js';

interface EditSelectScreenProps {
  store: PersonaStore;
  onScreenChange: (screen: Screen) => void;
}

export default function EditSelectScreen({ store, onScreenChange }: EditSelectScreenProps) {
  const items = store.personas.map((p) => ({
    label: `${p.name} — ${p.user} <${p.email}>`,
    value: p.name,
  }));

  const onSelect = (item: { value: string }) => {
    onScreenChange({ type: 'edit', name: item.value });
  };

  useInput((_input, key) => {
    if (key.escape) onScreenChange({ type: 'main' });
  });

  if (store.personas.length === 0) {
    useInput((_input, key) => {
      if (key.return || key.escape) onScreenChange({ type: 'main' });
    });
    return (
      <Box padding={1}>
        <Text>No personas to edit. Create one first.</Text>
        <Text dimColor>Press Enter or Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>✏️ Select persona to edit</Text>
      <Box marginTop={1} />
      <SelectInput items={items} onSelect={onSelect} />
      <BackButton />
    </Box>
  );
}
