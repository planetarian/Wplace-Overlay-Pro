/// <reference types="tampermonkey" />
import { loadConfig, applyTheme } from './core/store';
import { ensureHook, setUpdateUI } from './core/hook';
import { injectStyles } from './ui/styles';
import { createUI, updateUI } from './ui/panel';

export async function bootstrapApp() {
  injectStyles();
  await loadConfig();
  applyTheme();
  createUI();
  setUpdateUI(() => updateUI());
  ensureHook();
  console.log('Overlay Pro UI ready.');
}