import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

interface StoreContextType {
  stores: any[];
  selectedStoreId: string | null;
  selectedStoreName: string;
  setSelectedStoreId: (id: string) => void;
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORE_KEY = "leantable_selected_store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(
    localStorage.getItem(STORE_KEY)
  );

  const { data, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.listStores(),
    enabled: isAuthenticated,
  });

  const stores = data?.stores || [];

  // Auto-select first store if none selected
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreIdState(stores[0].storeId);
      localStorage.setItem(STORE_KEY, stores[0].storeId);
    }
  }, [stores, selectedStoreId]);

  const setSelectedStoreId = (id: string) => {
    setSelectedStoreIdState(id);
    localStorage.setItem(STORE_KEY, id);
  };

  const selectedStoreName = stores.find((s: any) => s.storeId === selectedStoreId)?.name || "Select Store";

  return (
    <StoreContext.Provider value={{ stores, selectedStoreId, selectedStoreName, setSelectedStoreId, isLoading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
