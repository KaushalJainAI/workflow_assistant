import { useThemeContext } from '../contexts/ThemeContext';

/**
 * Hook for managing theme (light/dark mode)
 * Now uses ThemeContext for global synchronization
 */
export function useTheme() {
  return useThemeContext();
}

export default useTheme;
