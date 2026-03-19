import { useCallback, useEffect, useRef, useState } from "react";
import {
  approvePendingUser,
  listPendingUsers,
  rejectPendingUser,
} from "../api/authApi.js";

export function usePendingUsers({ enabled }) {
  const abortControllerRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (!enabled) {
      setUsers([]);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError("");
    setIsLoading(true);

    try {
      const payload = await listPendingUsers({ signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (requestError) {
      if (requestError.name === "AbortError") {
        return;
      }

      setUsers([]);
      setError(requestError.message);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refresh]);

  const approve = useCallback(async (userId) => {
    setIsSubmitting(true);
    setError("");

    try {
      await approvePendingUser(userId);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [refresh]);

  const reject = useCallback(async (userId) => {
    setIsSubmitting(true);
    setError("");

    try {
      await rejectPendingUser(userId);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [refresh]);

  return {
    approve,
    error,
    isLoading,
    isSubmitting,
    refresh,
    reject,
    users,
  };
}
