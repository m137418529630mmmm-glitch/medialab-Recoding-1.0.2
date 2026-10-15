import {createRoot} from 'react-dom/client';
// Fonts are bundled (works offline inside the desktop app).
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/cairo/latin-600.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-700.css';
import '@fontsource/cairo/arabic-800.css';
import '@fontsource/cairo/latin-800.css';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
