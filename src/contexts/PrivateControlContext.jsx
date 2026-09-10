import { createContext, useContext, useState, useCallback, useRef } from "react";

const PrivateControlContext = createContext(null);

export function PrivateControlProvider({ children }) {
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [privateUser, setPrivateUser] = useState(null);

  const enterPrivateMode = useCallback((user) => {
    setPrivateUser(user);
    setIsPrivateMode(true);
    setShowControlPanel(true);
    setShowLoginModal(false);
  }, []);

  const exitPrivateMode = useCallback(() => {
    setIsPrivateMode(false);
    setShowControlPanel(false);
    setShowLoginModal(false);
    setPrivateUser(null);
  }, []);

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const toggleControlPanel = useCallback(() => {
    if (!isPrivateMode) return;
    setShowControlPanel((prev) => !prev);
  }, [isPrivateMode]);

  return (
    <PrivateControlContext.Provider
      value={{
        isPrivateMode,
        showLoginModal,
        showControlPanel,
        privateUser,
        enterPrivateMode,
        exitPrivateMode,
        openLoginModal,
        closeLoginModal,
        toggleControlPanel,
      }}
    >
      {children}
    </PrivateControlContext.Provider>
  );
}

export function usePrivateControl() {
  const ctx = useContext(PrivateControlContext);
  if (!ctx) throw new Error("usePrivateControl must be used within PrivateControlProvider");
  return ctx;
}

// Long-press detection hook
export function useLongPress(callback, { delay = 2500 } = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const targetRef = useRef(null);

  const start = useCallback((_e) => {
    _e.preventDefault();
    isLongPressRef.current = false;
    targetRef.current = _e.currentTarget;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      callback(_e);
    }, delay);
  }, [callback, delay]);

  const stop = useCallback((_e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}
