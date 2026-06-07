import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { Screen } from '../types.js';
import { isStickyEnabled, installStickyHooks, uninstallStickyHooks } from '../hooks/setup.js';
import { loadRepoPersonas } from '../store.js';
import BackButton from './BackButton.js';

interface StickyPersonaScreenProps {
  onScreenChange: (screen: Screen) => void;
  onQuit: () => void;
}

export default function StickyPersonaScreen({ onScreenChange, onQuit }: StickyPersonaScreenProps) {
  const enabled = isStickyEnabled();
  const repoCount = Object.keys(loadRepoPersonas()).length;

  if (enabled) {
    const items = [
      { label: '🖥️  Shell Prompt Integration', value: 'shell-prompt' },
      { label: '❌ Disable Sticky Personas', value: 'disable' },
      { label: '🚪 Quit', value: 'quit' },
    ];

    const onSelect = (item: { value: string }) => {
      switch (item.value) {
        case 'shell-prompt': onScreenChange({ type: 'shell-prompt', subtype: 'sticky' }); break;
        case 'disable': {
          try {
            uninstallStickyHooks();
            onScreenChange({ type: 'success', message: 'Sticky personas disabled. Global git hooks removed.' });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            onScreenChange({ type: 'success', message: `Error: ${msg}` });
          }
          break;
        }
        case 'quit': onQuit(); break;
      }
    };

    useInput((_input, key) => {
      if (key.escape) onScreenChange({ type: 'main' });
    });

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📌 Sticky Personas</Text>
        <Box marginTop={1} />
        <Text color="green">● Enabled</Text>
        <Text dimColor>{repoCount} repo{repoCount !== 1 ? 's' : ''} with saved persona mappings</Text>
        <Box marginTop={1} />
        <Text dimColor>Sticky personas automatically switch your git identity</Text>
        <Text dimColor>when you commit in different repositories.</Text>
        <Box marginTop={1} />
        <SelectInput items={items} onSelect={onSelect} />
        <BackButton />
      </Box>
    );
  }

  // Not enabled — show enable prompt
  const items = [
    { label: '✅ Enable Sticky Personas', value: 'enable' },
    { label: '🚪 Quit', value: 'quit' },
  ];

  const onSelect = (item: { value: string }) => {
    switch (item.value) {
      case 'enable': {
        try {
          installStickyHooks();
          onScreenChange({ type: 'success', message: 'Sticky personas enabled! A global pre-commit hook has been installed.' });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          onScreenChange({ type: 'success', message: `Error: ${msg}` });
        }
        break;
      }
      case 'quit': onQuit(); break;
    }
  };

  useInput((_input, key) => {
    if (key.escape) onScreenChange({ type: 'main' });
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>📌 Sticky Personas</Text>
      <Box marginTop={1} />
      <Text color="yellow">● Disabled</Text>
      <Box marginTop={1} />
      <Text dimColor>Enable sticky personas to automatically switch your git</Text>
      <Text dimColor>identity when you commit in different repositories.</Text>
      <Box marginTop={1} />
      <Text dimColor>How it works:</Text>
      <Text dimColor>  • First commit in a repo: you pick a persona</Text>
      <Text dimColor>  • Returning: your saved persona is applied automatically</Text>
      <Text dimColor>  • If the persona was edited: you'll be warned and asked to confirm</Text>
      <Text dimColor>  • Only one persona: auto-applied with a notification</Text>
      <Text dimColor>  • Non-interactive contexts (CI, IDEs): silently skipped</Text>
      <Box marginTop={1} />
      <Text dimColor>This installs a global git pre-commit hook at:</Text>
      <Text>  ~/.config/git-personas/hooks/</Text>
      <Box marginTop={1} />
      <SelectInput items={items} onSelect={onSelect} />
      <BackButton />
    </Box>
  );
}