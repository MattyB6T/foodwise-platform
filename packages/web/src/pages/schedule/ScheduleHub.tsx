import { useSearchParams } from "react-router-dom";
import { PageTabs } from "../../components/PageTabs";
import { SchedulePage } from "./SchedulePage";
import { TimesheetsPage } from "../timesheets/TimesheetsPage";

const tabs = [
  { key: "schedule", label: "Schedule", icon: "schedule" },
  { key: "timesheets", label: "Timesheets", icon: "timesheets" },
];

export function ScheduleHub() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "schedule";

  const handleTabChange = (key: string) => {
    if (key === "schedule") {
      setParams({});
    } else {
      setParams({ tab: key });
    }
  };

  return (
    <div>
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      {activeTab === "schedule" && <SchedulePage />}
      {activeTab === "timesheets" && <TimesheetsPage />}
    </div>
  );
}
