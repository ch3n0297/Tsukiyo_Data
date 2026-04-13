import { useCallback, useEffect, useRef, useState } from "react";
import {
  approvePendingUser,
  listPendingUsers,
  rejectPendingUser,
} from "../api/authApi";
import type { PublicUser } from "../types/api";

interface UsePendingUsersOptions {
  enabled: boolean;
}

export function usePendingUsers({ enabled }: UsePendingUsersOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
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
      const payload = await listPendingUsers({ signal: controller.signal }) as { users?: PublicUser[] };

      if (controller.signal.aborted) {
        return;
      }

      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (requestError) {
      if ((requestError as Error).name === "AbortError") {
        return;
      }

      setUsers([]);
      setError((requestError as Error).message);
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

  const approve = useCallback(async (userId: string) => {
    setIsSubmitting(true);
    setError("");

    try {
      await approvePendingUser(userId);
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [refresh]);

  const reject = useCallback(async (userId: string) => {
    setIsSubmitting(true);
    setError("");

    try {
      await rejectPendingUser(userId);
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
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
