import React from 'react';
import { Box, Text } from 'ink';

interface BackButtonProps {
  label?: string;
}

export default function BackButton({ label = '← Back (Esc)' }: BackButtonProps) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{label}</Text>
    </Box>
  );
}
