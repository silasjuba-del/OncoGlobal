import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { hydrate } from './store/store';
import './styles.css';
import './styles-ai.css';
import './styles-editor.css';
import './styles-browser.css';
import './styles-ux.css';

hydrate().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
