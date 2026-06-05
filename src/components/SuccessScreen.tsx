import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';

interface SuccessScreenProps {
  message: string;
  onContinue: () => void;
  onQuit: () => void;
}

export default function SuccessScreen({ message, onContinue, onQuit }: SuccessScreenProps) {
  useInput((_input, key) => {
    if (key.return) onContinue();
    if (key.escape) onQuit();
  });

  const items = [
    { label: 'Continue', value: 'continue' },
    { label: '🚪 Quit', value: 'quit' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">✓ {message}</Text>
      <Box marginTop={1} />
      <SelectInput
        items={items}
        onSelect={(item) => {
          if (item.value === 'continue') onContinue();
          if (item.value === 'quit') onQuit();
        }}
      />
    </Box>
  );
}
