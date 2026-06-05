import React from 'react';
import { Box, useInput } from 'ink';
import SelectInput from 'ink-select-input';

interface BackButtonProps {
  onBack: () => void;
  label?: string;
}

export default function BackButton({ onBack, label = '← Back' }: BackButtonProps) {
  // Intercept Escape key globally for this component
  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const item = { label, value: '__back__' };

  return (
    <Box marginTop={1}>
      <SelectInput
        items={[item]}
        onSelect={() => onBack()}
      />
    </Box>
  );
}
