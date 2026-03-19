import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "../api/authApi.js";
import { HttpRequestError } from "../api/httpClient.js";

function detectInitialMode() {
  return window.location.pathname === "/reset-password" ? "reset" : "login";
}

function readResetTokenFromLocation() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function useAuthSession() {
  const abortControllerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState(detectInitialMode);
  const [resetToken, setResetToken] = useState(readResetTokenFromLocation);

  const refreshSession = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError("");

    try {
      const payload = await getCurrentUser({ signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      setUser(payload.user ?? null);
    } catch (requestError) {
      if (requestError.name === "AbortError") {
        return;
      }

      if (requestError instanceof HttpRequestError && requestError.status === 401) {
        setUser(null);
        return;
      }

      setUser(null);
      setError(requestError.message);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshSession();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refreshSession]);

  const switchMode = useCallback((nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");

    if (nextMode !== "reset" && window.location.pathname === "/reset-password") {
      window.history.replaceState({}, "", "/");
      setResetToken("");
    }
  }, []);

  const register = useCallback(async (payload) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await registerUser(payload);
      setMessage(response.system_message);
      setMode("login");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const login = useCallback(async (payload) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await loginUser(payload);
      setUser(response.user ?? null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await logoutUser();
      setUser(null);
      setMode("login");
      setMessage(response.system_message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const forgotPassword = useCallback(async (payload) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await requestPasswordReset(payload);
      setMessage(response.system_message);
      setMode("login");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const submitPasswordReset = useCallback(
    async (payload) => {
      setIsSubmitting(true);
      setError("");
      setMessage("");

      try {
        const response = await resetPassword({
          password: payload.password,
          token: resetToken,
        });
        setMessage(response.system_message);
        setMode("login");
        setResetToken("");
        window.history.replaceState({}, "", "/");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [resetToken],
  );

  const authView = useMemo(
    () => ({
      mode,
      resetToken,
    }),
    [mode, resetToken],
  );

  return {
    authView,
    error,
    forgotPassword,
    isLoading,
    isSubmitting,
    login,
    logout,
    message,
    refreshSession,
    register,
    resetPassword: submitPasswordReset,
    switchMode,
    user,
  };
}
