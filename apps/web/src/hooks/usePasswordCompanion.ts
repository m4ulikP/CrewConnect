import { useCallback, useRef, useState } from "react";

export function usePasswordCompanion() {
  const [isGroupFocused, setIsGroupFocused] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isGroupFocusedRef = useRef(false);

  const notifyTyping = useCallback(() => {
    // Only activate watching state if the password group currently has focus (ignores background autofill)
    if (!isGroupFocusedRef.current) return;
    setIsWatching(true);
  }, []);

  const handleGroupFocus = useCallback((e?: React.FocusEvent<HTMLElement>) => {
    isGroupFocusedRef.current = true;
    setIsGroupFocused(true);

    // If focusing an input that already has entered characters, activate watching state
    const input = e?.currentTarget?.querySelector?.(
      'input[type="password"], input[type="text"]'
    ) as HTMLInputElement | null;
    const targetInput =
      e?.target && "value" in (e.target as object) ? (e.target as HTMLInputElement) : null;
    const val = input?.value ?? targetInput?.value;

    if (val && val.length > 0) {
      setIsWatching(true);
    }
    // Focusing an empty password field leaves isWatching = false (normal state)
  }, []);

  const handleGroupBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    // Reset avatar to normal state only when focus truly leaves the password control group
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      isGroupFocusedRef.current = false;
      setIsGroupFocused(false);
      setIsWatching(false);
    }
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsPasswordVisible((prev) => !prev);
  }, []);

  return {
    isPasswordFocused: isWatching,
    isPasswordVisible,
    isTyping: isWatching,
    isWatching,
    isGroupFocused,
    notifyTyping,
    handleGroupFocus,
    handleGroupBlur,
    toggleVisibility,
  };
}
