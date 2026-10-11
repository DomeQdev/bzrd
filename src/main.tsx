import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useProject } from './store/project';

if (import.meta.env.DEV) (window as unknown as { __bzrd: typeof useProject }).__bzrd = useProject;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
