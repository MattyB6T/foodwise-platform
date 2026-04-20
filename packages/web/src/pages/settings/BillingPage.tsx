import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageLoader } from "../../components/LoadingSpinner";
import { useSearchParams } from "react-router-dom";

type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";

const PLANS: Record<
  SubscriptionPlan,
  { price: number; maxStores: number; maxStaff: number; features: string[] }
> = {
  free: {
    price: 0,
    maxStores: 1,
    maxStaff: 3,
    features: ["inventory", "waste-logging", "dashboard"],
  },
  starter: {
    price: 29,
    maxStores: 2,
    maxStaff: 10,
    features: [
      "inventory", "waste-logging", "dashboard", "recipes",
      "prep-lists", "temp-logs", "reports",
    ],
  },
  pro: {
    price: 79,
    maxStores: 5,
    maxStaff: 50,
    features: [
      "inventory", "waste-logging", "dashboard", "recipes",
      "prep-lists", "temp-logs", "reports", "pos-integration",
      "ai-assistant", "forecasting", "scheduling",
    ],
  },
  enterprise: {
    price: 199,
    maxStores: 100,
    maxStaff: 999,
    features: [
      "inventory", "waste-logging", "dashboard", "recipes",
      "prep-lists", "temp-logs", "reports", "pos-integration",
      "ai-assistant", "forecasting", "scheduling",
      "security-cameras", "multi-location-analytics", "api-access",
    ],
  },
};

function PlanCard({
  plan,
  current,
  onSelect,
  loading,
}: {
  plan: SubscriptionPlan;
  current: boolean;
  onSelect: () => void;
  loading: boolean;
}) {
  const config = PLANS[plan];
  const { price } = config;

  return (
    <div
      className={`rounded-xl border-2 p-6 transition-colors ${
        current
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      }`}
    >
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
        {plan}
      </h3>
      <div className="mt-2">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          ${price}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
      </div>
      <ul className="mt-4 space-y-2">
        <li className="text-sm text-slate-600 dark:text-slate-300">
          Up to {config.maxStores} store{config.maxStores > 1 ? "s" : ""}
        </li>
        <li className="text-sm text-slate-600 dark:text-slate-300">
          Up to {config.maxStaff} staff members
        </li>
        <li className="text-sm text-slate-600 dark:text-slate-300">
          {config.features.length} features included
        </li>
      </ul>
      <div className="mt-4 space-y-2">
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
            View all features
          </summary>
          <ul className="mt-2 space-y-1 pl-2">
            {config.features.map((f) => (
              <li key={f} className="capitalize">
                {f.replace(/-/g, " ")}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="mt-6">
        {current ? (
          <span className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 py-2">
            Current Plan
          </span>
        ) : plan === "free" ? (
          <span className="block text-center text-sm text-slate-400 dark:text-slate-500 py-2">
            Default plan
          </span>
        ) : (
          <button
            onClick={onSelect}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : `Upgrade to ${plan}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function BillingPage() {
  const [searchParams] = useSearchParams();
  const justSubscribed = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.getSubscription(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => api.createCheckout(plan),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => api.createPortal(),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });

  if (isLoading) return <PageLoader />;

  const currentPlan: SubscriptionPlan = subscription?.plan || "free";
  const status = subscription?.status || "active";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Billing & Subscription
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your subscription plan and billing details
        </p>
      </div>

      {justSubscribed && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Subscription activated successfully! Your plan has been upgraded.
          </p>
        </div>
      )}

      {canceled && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Checkout was canceled. No changes were made to your plan.
          </p>
        </div>
      )}

      <div className="max-w-5xl space-y-6">
        {/* Current plan summary */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Current Plan
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 capitalize">
                {currentPlan}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Status:{" "}
                <span
                  className={`font-medium capitalize ${
                    status === "active"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : status === "past_due"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {status.replace("_", " ")}
                </span>
              </p>
              {subscription?.currentPeriodEnd && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? "Cancels"
                    : "Renews"}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {currentPlan !== "free" && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {portalMutation.isPending
                  ? "Loading..."
                  : "Manage Billing"}
              </button>
            )}
          </div>
          {portalMutation.isError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              Failed to open billing portal. Please try again.
            </p>
          )}
        </div>

        {/* Plan cards */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Available Plans
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              ["free", "starter", "pro", "enterprise"] as SubscriptionPlan[]
            ).map((plan) => (
              <PlanCard
                key={plan}
                plan={plan}
                current={currentPlan === plan}
                onSelect={() => checkoutMutation.mutate(plan)}
                loading={checkoutMutation.isPending}
              />
            ))}
          </div>
          {checkoutMutation.isError && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              Failed to create checkout session. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
