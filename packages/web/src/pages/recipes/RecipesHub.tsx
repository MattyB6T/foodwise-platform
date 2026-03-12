import { useSearchParams } from "react-router-dom";
import { PageTabs } from "../../components/PageTabs";
import { RecipesPage } from "./RecipesPage";
import { PrepListsPage } from "../prep-lists/PrepListsPage";

const tabs = [
  { key: "recipes", label: "Recipes", icon: "recipes" },
  { key: "prep-lists", label: "Prep Lists", icon: "prep-lists" },
];

export function RecipesHub() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "recipes";

  const handleTabChange = (key: string) => {
    if (key === "recipes") {
      setParams({});
    } else {
      setParams({ tab: key });
    }
  };

  return (
    <div>
      <PageTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      {activeTab === "recipes" && <RecipesPage />}
      {activeTab === "prep-lists" && <PrepListsPage />}
    </div>
  );
}
