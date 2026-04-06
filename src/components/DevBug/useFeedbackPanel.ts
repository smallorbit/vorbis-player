import { useState, useCallback } from 'react';
import type { Category, SelectedElement } from '@/types/devbug';

export interface FeedbackPanelState {
  isOpen: boolean;
  selectedElement: SelectedElement | null;
  categories: Category[];
  comment: string;
}

export interface FeedbackPanelActions {
  open: (element: SelectedElement) => void;
  close: () => void;
  toggleCategory: (category: Category) => void;
  setComment: (comment: string) => void;
  reset: () => void;
}

const INITIAL_STATE: FeedbackPanelState = {
  isOpen: false,
  selectedElement: null,
  categories: [],
  comment: '',
};

export function useFeedbackPanel(): FeedbackPanelState & FeedbackPanelActions {
  const [state, setState] = useState<FeedbackPanelState>(INITIAL_STATE);

  const open = useCallback((element: SelectedElement) => {
    setState({ isOpen: true, selectedElement: element, categories: [], comment: '' });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const toggleCategory = useCallback((category: Category) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const setComment = useCallback((comment: string) => {
    setState((prev) => ({ ...prev, comment }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, open, close, toggleCategory, setComment, reset };
}
