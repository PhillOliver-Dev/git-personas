import os from 'node:os';

const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const PERSONAS_CONFIG_DIR = `${CONFIG_DIR}/personas`;
const BACKUPS_DIR = `${CONFIG_DIR}/backups`;
const GITCONFIG_PATH = `${os.homedir()}/.gitconfig`;

// Markers for the managed section in ~/.gitconfig
const MANAGED_SECTION_START = '# === BEGIN git-personas managed config ===';
const MANAGED_SECTION_END = '# === END git-personas managed config ===';

// File paths
const PERSONAS_FILE = `${CONFIG_DIR}/personas.json`;
const REPO_PERSONAS_FILE = `${CONFIG_DIR}/repo-personas.json`;
const PATH_MAPPINGS_FILE = `${CONFIG_DIR}/path-mappings.json`;

// Prefix for gitdir patterns
const GITDIR_PREFIX = 'gitdir:';

export {
  CONFIG_DIR,
  PERSONAS_CONFIG_DIR,
  BACKUPS_DIR,
  GITCONFIG_PATH,
  MANAGED_SECTION_START,
  MANAGED_SECTION_END,
  PERSONAS_FILE,
  REPO_PERSONAS_FILE,
  PATH_MAPPINGS_FILE,
  GITDIR_PREFIX,
};