import { useEffect, useMemo, useRef, useState } from "react";
import { getAccountDetail } from "../api/dashboardApi.js";

export function useSelectedAccount(accounts, refreshToken, enabled) {
  const abortControllerRef = useRef(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      setSelectedAccountKey(null);
      setSelectedAccount(null);
      setIsDetailLoading(false);
      setDetailError("");
      return;
    }

    if (accounts.length === 0) {
      abortControllerRef.current?.abort();
      setSelectedAccountKey(null);
      setSelectedAccount(null);
      setIsDetailLoading(false);
      setDetailError("");
      return;
    }

    const hasSelectedAccount = accounts.some((account) => account.accountKey === selectedAccountKey);

    if (!hasSelectedAccount) {
      setSelectedAccountKey(accounts[0].accountKey);
    }
  }, [accounts, enabled, selectedAccountKey]);

  const selectedSummary = useMemo(
    () => accounts.find((account) => account.accountKey === selectedAccountKey) ?? null,
    [accounts, selectedAccountKey],
  );

  useEffect(() => {
    abortControllerRef.current?.abort();

    if (!enabled || !selectedSummary) {
      setSelectedAccount(null);
      setIsDetailLoading(false);
      setDetailError("");
      return undefined;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setDetailError("");
    setIsDetailLoading(true);
    setSelectedAccount((current) =>
      current?.accountKey === selectedSummary.accountKey ? current : null,
    );

    void getAccountDetail(selectedSummary.platform, selectedSummary.accountId, {
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setSelectedAccount(payload.account ?? null);
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") {
          return;
        }

        setSelectedAccount(null);
        setDetailError(requestError.message);
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsDetailLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [enabled, refreshToken, selectedSummary?.accountId, selectedSummary?.accountKey, selectedSummary?.platform]);

  return {
    detailError,
    isDetailLoading,
    selectAccount: setSelectedAccountKey,
    selectedAccount,
    selectedAccountKey,
    selectedSummary,
  };
}
