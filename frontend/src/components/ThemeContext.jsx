import { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('offlinegold-theme');
    return stored !== null ? stored === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('offlinegold-theme', dark ? 'dark' : 'light');
    document.body.classList.toggle('light-mode', !dark);
  }, [dark]);

  const toggle = () => setDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button className="header-btn" onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}