import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { Screen } from '../types.js';
import {
  detectShells,
  isShellIntegrated,
  installShellPrompt,
  removeShellPrompt,
} from '../hooks/setup.js';
import type { ShellName } from '../hooks/setup.js';
import BackButton from './BackButton.js';

interface ShellPromptScreenProps {
  onScreenChange: (screen: Screen) => void;
  onQuit: () => void;
}

const SHELL_LABELS: Record<ShellName, string> = {
  bash: 'Bash (~/.bashrc)',
  zsh: 'Zsh (~/.zshrc)',
  starship: '⭐ Starship (~/.config/starship.toml)',
};

export default function ShellPromptScreen({ onScreenChange, onQuit }: ShellPromptScreenProps) {
  const shells = detectShells();
  const [, setRefresh] = useState(0);

  if (shells.length === 0) {
    const items = [
      { label: '← Back (Enter)', value: 'back' },
    ];

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>🖥️ Shell Prompt Integration</Text>
        <Box marginTop={1} />
        <Text dimColor>No supported shell config files found.</Text>
        <Text dimColor>Supported: ~/.bashrc, ~/.zshrc, Starship</Text>
        <Box marginTop={1} />
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'back') onScreenChange({ type: 'sticky-persona' });
          }}
        />
      </Box>
    );
  }

  interface MenuItem {
    label: string;
    value: string;
  }

  const items: MenuItem[] = shells.map((shell) => {
    const integrated = isShellIntegrated(shell);
    return {
      label: `${integrated ? '✅' : '⬜'} ${SHELL_LABELS[shell]}`,
      value: shell,
    };
  });

  items.push({ label: '🚪 Quit', value: 'quit' });

  const onSelect = (item: { value: string }) => {
    if (item.value === 'quit') {
      onQuit();
      return;
    }

    const shell = item.value as ShellName;
    if (isShellIntegrated(shell)) {
      removeShellPrompt(shell);
    } else {
      installShellPrompt(shell);
    }
    setRefresh((n) => n + 1);
  };

  useInput((_input, key) => {
    if (key.escape) onScreenChange({ type: 'sticky-persona' });
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🖥️ Shell Prompt Integration</Text>
      <Box marginTop={1} />
      <Text dimColor>Add your active persona to your terminal prompt.</Text>
      <Text dimColor>Toggle the shells you want to enable:</Text>
      <Box marginTop={1} />
      <SelectInput items={items} onSelect={onSelect} />
      <BackButton />
    </Box>
  );
}