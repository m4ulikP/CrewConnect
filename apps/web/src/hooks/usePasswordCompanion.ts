import { useCallback, useEffect, useRef, useState } from "react";

const TYPING_INACTIVITY_MS = 650;

export function usePasswordCompanion() {
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const typingTimeoutRef = useRef<number | null>(null);

  const clearTypingTimer = useCallback(() => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, [clearTypingTimer]);

  const notifyTyping = useCallback(() => {
    if (!isPasswordFocused) return;
    clearTypingTimer();
    setIsTyping(true);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
      typingTimeoutRef.current = null;
    }, TYPING_INACTIVITY_MS);
  }, [isPasswordFocused, clearTypingTimer]);

  const handleGroupFocus = useCallback(() => {
    setIsPasswordFocused(true);
  }, []);

  const handleGroupBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        clearTypingTimer();
        setIsTyping(false);
        setIsPasswordFocused(false);
      }
    },
    [clearTypingTimer]
  );

  const toggleVisibility = useCallback(() => {
    setIsPasswordFocused(true);
    setIsPasswordVisible((prev) => !prev);
  }, []);

  return {
    isPasswordFocused,
    isPasswordVisible,
    isTyping,
    notifyTyping,
    handleGroupFocus,
    handleGroupBlur,
    toggleVisibility,
  };
}
