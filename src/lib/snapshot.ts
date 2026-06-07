/**
 * Take a snapshot of a persona for comparison.
 */
export function takeSnapshot(persona: {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}): {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
} {
  return {
    user: persona.user,
    email: persona.email,
    gpgKey: persona.gpgKey,
    sshKey: persona.sshKey,
    defaultBranch: persona.defaultBranch,
  };
}

/**
 * Get the changed fields between two personas.
 */
export function getChangedFields(newPersona: {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}, oldPersona: {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}): string[] {
  const changes: string[] = [];

  if (newPersona.user !== oldPersona.user) changes.push('name');
  if (newPersona.email !== oldPersona.email) changes.push('email');
  if (newPersona.gpgKey !== oldPersona.gpgKey) changes.push('gpgKey');
  if (newPersona.sshKey !== oldPersona.sshKey) changes.push('sshKey');
  if (newPersona.defaultBranch !== oldPersona.defaultBranch) changes.push('defaultBranch');

  return changes;
}