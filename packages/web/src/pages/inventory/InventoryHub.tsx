import { useSearchParams } from "react-router-dom";
import { PageTabs } from "../../components/PageTabs";
import { InventoryPage } from "./InventoryPage";
import { CountsPage } from "../counts/CountsPage";
import { ExpirationPage } from "../expiration/ExpirationPage";
import { TempLogsPage } from "../temp-logs/TempLogsPage";

const tabs = [
  { key: "inventory", label: "Stock Levels", icon: "inventory" },
  { key: "counts", label: "Counts", icon: "counts" },
  { key: "expiration", label: "Expiration", icon: "expiration" },
  { key: "temp-logs", label: "Temp Logs", icon: "temp-logs" },
];

export function InventoryHub() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "inventory";

  const handleTabChange = (key: string) => {
    if (key === "inventory") {
      setParams({});
    } else {
      setParams({ tab: key });
    }
  };

  return (
    <div>
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      {activeTab === "inventory" && <InventoryPage />}
      {activeTab === "counts" && <CountsPage />}
      {activeTab === "expiration" && <ExpirationPage />}
      {activeTab === "temp-logs" && <TempLogsPage />}
    </div>
  );
}
