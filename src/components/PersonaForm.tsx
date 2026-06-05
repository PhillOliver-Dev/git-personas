import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import type { Persona } from '../types.js';
import { detectGpgKeys, detectSshKeys } from '../store.js';
import BackButton from './BackButton.js';

interface PersonaFormProps {
  initial?: Partial<Persona>;
  onSubmit: (persona: Persona) => void;
  onCancel: () => void;
  title: string;
}

export default function PersonaForm({ initial, onSubmit, onCancel, title }: PersonaFormProps) {
  const gpgKeys = detectGpgKeys();
  const sshKeys = detectSshKeys();

  const [name, setName] = useState(initial?.name || '');
  const [user, setUser] = useState(initial?.user || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [gpgKey, setGpgKey] = useState(initial?.gpgKey || '');
  const [sshKey, setSshKey] = useState(initial?.sshKey || '');
  const [defaultBranch, setDefaultBranch] = useState(initial?.defaultBranch || '');
  const [step, setStep] = useState(0);

  const isEdit = !!initial?.name;
  const steps = isEdit
    ? ['user', 'email', 'gpg', 'ssh', 'branch', 'confirm']
    : ['name', 'user', 'email', 'gpg', 'ssh', 'branch', 'confirm'];

  const currentStep = steps[step];

  // Global Escape handler: go back a step or cancel
  useInput((_input, key) => {
    if (key.escape && !['gpg', 'ssh'].includes(currentStep)) {
      if (step > 0) {
        setStep(step - 1);
      } else {
        onCancel();
      }
    }
  });

  const handleGpgSelect = (item: { value: string }) => {
    setGpgKey(item.value);
    setStep(step + 1);
  };

  const handleSshSelect = (item: { value: string }) => {
    setSshKey(item.value);
    setStep(step + 1);
  };

  const handleSubmit = () => {
    if (!name.trim() || !user.trim() || !email.trim()) return;
    onSubmit({
      name: name.trim(),
      user: user.trim(),
      email: email.trim(),
      gpgKey: gpgKey || undefined,
      sshKey: sshKey || undefined,
      defaultBranch: defaultBranch.trim() || undefined,
    });
  };

  // Confirm step: Enter submits, Escape goes back
  useInput((_input, key) => {
    if (currentStep === 'confirm') {
      if (key.return) handleSubmit();
      if (key.escape) setStep(step - 1);
    }
  });

  // Escape handler for GPG/SSH select screens
  useInput((_input, key) => {
    if (key.escape && ['gpg', 'ssh'].includes(currentStep)) {
      setStep(step - 1);
    }
  });

  if (currentStep === 'gpg') {
    const items = [
      { label: '(none — skip GPG signing)', value: '' },
      ...gpgKeys.map((k) => ({
        label: `${k.uid} [${k.id}]`,
        value: k.id,
      })),
    ];
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>🔑 Select GPG Signing Key</Text>
        <Text dimColor>Current: {gpgKey || '(none)'}</Text>
        <Box marginTop={1} />
        <SelectInput items={items} onSelect={handleGpgSelect} />
        <BackButton />
      </Box>
    );
  }

  if (currentStep === 'ssh') {
    const items = [
      { label: '(none — use default SSH)', value: '' },
      ...sshKeys.map((k) => ({
        label: `${k.comment} (${k.path})`,
        value: k.path,
      })),
    ];
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>🔑 Select SSH Key</Text>
        <Text dimColor>Current: {sshKey || '(none)'}</Text>
        <Box marginTop={1} />
        <SelectInput items={items} onSelect={handleSshSelect} />
        <BackButton />
      </Box>
    );
  }

  if (currentStep === 'confirm') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>{title}</Text>
        <Box marginTop={1} />
        <Text>  Name: <Text bold>{name}</Text></Text>
        <Text>  User: {user}</Text>
        <Text>  Email: {email}</Text>
        <Text>  GPG Key: {gpgKey || '(none)'}</Text>
        <Text>  SSH Key: {sshKey || '(none)'}</Text>
        <Text>  Default Branch: {defaultBranch || '(system default)'}</Text>
        <Box marginTop={1} />
        <Text dimColor>Enter to confirm · Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{title}</Text>
      <Text dimColor>Step {step + 1} of {steps.length}</Text>
      <Box marginTop={1} />

      {currentStep === 'name' && (
        <Box>
          <Text>Name: </Text>
          <TextInput value={name} onChange={setName} onSubmit={() => setStep(1)} placeholder="e.g. work, personal" />
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}

      {currentStep === 'user' && (
        <Box>
          <Text>Git User Name: </Text>
          <TextInput value={user} onChange={setUser} onSubmit={() => setStep(step + 1)} placeholder="e.g. Phil" />
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}

      {currentStep === 'email' && (
        <Box>
          <Text>Git Email: </Text>
          <TextInput value={email} onChange={setEmail} onSubmit={() => setStep(step + 1)} placeholder="e.g. phil@example.com" />
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}

      {currentStep === 'branch' && (
        <Box>
          <Text>Default Branch: </Text>
          <TextInput value={defaultBranch} onChange={setDefaultBranch} onSubmit={() => setStep(step + 1)} placeholder="e.g. main (leave empty for default)" />
          <Text dimColor>Press Enter to continue (leave blank to skip)</Text>
        </Box>
      )}

      <BackButton />
    </Box>
  );
}
