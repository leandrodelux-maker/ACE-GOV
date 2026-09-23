import { useCallback, useEffect, useState } from 'react';

/**
 * Aba ativa de um hub sincronizada com a rota.
 *
 * - Quando a rota muda (voltar/avançar, link direto), `initialTab` muda e a aba acompanha.
 * - Ao clicar numa aba, `onTabChange` avisa o App para atualizar a URL.
 */
export function useHubTab<T extends string>(initialTab: T, onTabChange?: (tab: T) => void): [T, (tab: T) => void] {
  const [activeTab, setActiveTab] = useState<T>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const changeTab = useCallback(
    (tab: T) => {
      setActiveTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange]
  );

  return [activeTab, changeTab];
}
