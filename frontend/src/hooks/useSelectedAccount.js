import { useEffect, useMemo, useRef, useState } from "react";
import { getAccountDetail } from "../api/dashboardApi.js";

export function useSelectedAccount(accounts, refreshToken, enabled) {
  const abortControllerRef = useRef(null);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedAccountKey, setSelectedAccountKey] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const platformOptions = useMemo(
    () => [...new Set(accounts.map((account) => account.platform))].sort((left, right) => left.localeCompare(right)),
    [accounts],
  );

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      setSelectedPlatform("all");
      setSelectedAccountKey(null);
      setSelectedAccount(null);
      setIsDetailLoading(false);
      setDetailError("");
      return;
    }

    if (accounts.length === 0) {
      abortControllerRef.current?.abort();
      setSelectedPlatform("all");
      setSelectedAccountKey(null);
      setSelectedAccount(null);
      setIsDetailLoading(false);
      setDetailError("");
      return;
    }

    if (selectedPlatform !== "all" && !platformOptions.includes(selectedPlatform)) {
      setSelectedPlatform("all");
    }

    if (selectedAccountKey && !accounts.some((account) => account.accountKey === selectedAccountKey)) {
      setSelectedAccountKey(null);
    }
  }, [accounts, enabled, platformOptions, selectedAccountKey, selectedPlatform]);

  const selectedSummary = useMemo(
    () => accounts.find((account) => account.accountKey === selectedAccountKey) ?? null,
    [accounts, selectedAccountKey],
  );

  const filteredAccounts = useMemo(() => {
    if (selectedPlatform === "all") {
      return accounts;
    }

    return accounts.filter((account) => account.platform === selectedPlatform);
  }, [accounts, selectedPlatform]);

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
    clearSelectedAccount() {
      setSelectedAccountKey(null);
    },
    detailError,
    filteredAccounts,
    isDetailLoading,
    platformOptions,
    selectAccount(accountKey) {
      const account = accounts.find((entry) => entry.accountKey === accountKey);
      setSelectedAccountKey(accountKey);

      if (account) {
        setSelectedPlatform(account.platform);
      }
    },
    selectPlatform(platform) {
      setSelectedPlatform(platform);
      setSelectedAccountKey(null);
    },
    selectedAccount,
    selectedAccountKey,
    selectedPlatform,
    selectedSummary,
  };
}
