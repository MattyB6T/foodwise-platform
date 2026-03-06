import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "./AuthContext";

interface StoreContextType {
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  stores: { storeId: string; name: string }[];
  storesLoading: boolean;
  setSelectedStore: (id: string, name: string) => void;
  refreshStores: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedStoreId, setStoreId] = useState<string | null>(null);
  const [selectedStoreName, setStoreName] = useState<string | null>(null);
  const [stores, setStores] = useState<{ storeId: string; name: string }[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const setSelectedStore = (id: string, name: string) => {
    setStoreId(id);
    setStoreName(name);
  };

  const refreshStores = useCallback(async () => {
    if (!isAuthenticated) return;
    setStoresLoading(true);
    try {
      const res = await api.listStores();
      const storeList = (res.stores || []).map((s: any) => ({
        storeId: s.storeId,
        name: s.name,
      }));
      setStores(storeList);
      // Auto-select first store if none selected
      if (!selectedStoreId && storeList.length > 0) {
        setStoreId(storeList[0].storeId);
        setStoreName(storeList[0].name);
      }
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setStoresLoading(false);
    }
  }, [isAuthenticated, selectedStoreId]);

  useEffect(() => {
    refreshStores();
  }, [refreshStores]);

  return (
    <StoreContext.Provider
      value={{ selectedStoreId, selectedStoreName, stores, storesLoading, setSelectedStore, refreshStores }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
