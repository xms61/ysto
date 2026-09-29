import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { browserAudio } from './audio/engine.ts';
import { localStore, sessionStore } from './storage.ts';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <App audio={browserAudio()} storage={{ local: localStore(), session: sessionStore() }} />
  </StrictMode>,
);
