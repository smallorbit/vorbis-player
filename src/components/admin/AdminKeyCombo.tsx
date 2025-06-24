import { useEffect, useState, useMemo } from 'react';

interface AdminKeyComboProps {
  onActivate: () => void;
}

const AdminKeyCombo: React.FC<AdminKeyComboProps> = ({ onActivate }) => {
  const [keySequence, setKeySequence] = useState<string[]>([]);
  const [lastKeyTime, setLastKeyTime] = useState<number>(0);
  
  // Secret key sequence: Triple-click the 'A' key
  const targetSequence = useMemo(() => ['KeyA', 'KeyA', 'KeyA'], []);
  const sequenceTimeout = 1500; // Reset sequence after 1.5 seconds

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Reset sequence if too much time has passed
      if (currentTime - lastKeyTime > sequenceTimeout) {
        setKeySequence([]);
      }
      
      setLastKeyTime(currentTime);
      
      // Add current key to sequence
      const newSequence = [...keySequence, event.code];
      
      // Keep only the last targetSequence.length keys
      const trimmedSequence = newSequence.slice(-targetSequence.length);
      setKeySequence(trimmedSequence);
      
      // Check if sequence matches
      if (trimmedSequence.length === targetSequence.length) {
        const matches = trimmedSequence.every((key, index) => key === targetSequence[index]);
        if (matches) {
          onActivate();
          setKeySequence([]); // Reset after activation
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keySequence, lastKeyTime, onActivate, targetSequence]);

  return null; // This component doesn't render anything
};

export default AdminKeyCombo;