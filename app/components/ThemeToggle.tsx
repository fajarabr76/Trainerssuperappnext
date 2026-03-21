'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion } from 'motion/react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-all duration-300 border border-border shadow-sm active:scale-95"
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        <motion.div
          initial={false}
          animate={{
            scale: theme === 'dark' ? 0 : 1,
            rotate: theme === 'dark' ? 90 : 0,
            opacity: theme === 'dark' ? 0 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Sun className="w-5 h-5 text-primary" />
        </motion.div>
        <motion.div
          initial={false}
          animate={{
            scale: theme === 'dark' ? 1 : 0,
            rotate: theme === 'dark' ? 0 : -90,
            opacity: theme === 'dark' ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Moon className="w-5 h-5 text-primary" />
        </motion.div>
      </div>
    </motion.button>
  );
}
