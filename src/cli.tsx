#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './index.js';

const { waitUntilExit, clear } = render(React.createElement(App));

waitUntilExit().then(() => {
  clear();
});
