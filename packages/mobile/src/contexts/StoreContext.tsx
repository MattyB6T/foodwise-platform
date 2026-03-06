import React, { createContext, useContext, useState } from "react";

interface StoreContextType {
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  setSelectedStore: (id: string, name: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedStoreId, setStoreId] = useState<string | null>(null);
  const [selectedStoreName, setStoreName] = useState<string | null>(null);

  const setSelectedStore = (id: string, name: string) => {
    setStoreId(id);
    setStoreName(name);
  };

  return (
    <StoreContext.Provider
      value={{ selectedStoreId, selectedStoreName, setSelectedStore }}
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
