import { IconContext } from "@phosphor-icons/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from "react-router";
import { Toaster } from "./components/toast";
import { Shell } from "./shell/Shell";
import { Splash } from "./shell/Splash";
import { queryClient } from "./lib/queries";
import { SessionProvider, useSession } from "./lib/session";
import Today from "./routes/Today";

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const Component = lazy(load);
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
};

function RouteFallback() {
  return (
    <div className="space-y-3 pt-6" role="status" aria-label="Loading">
      <div className="skeleton h-9 w-40" />
      <div className="skeleton h-28" />
      <div className="skeleton h-20" />
    </div>
  );
}

/** Signed in and onboarded; otherwise off to login or welcome. */
function RequireSession({ onboarding = false, children }: { onboarding?: boolean; children: ReactNode }) {
  const { status, me } = useSession();
  const location = useLocation();
  if (status === "loading") return <Splash />;
  if (status === "anon") {
    const next = location.pathname + location.search;
    return <Navigate to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
  }
  if (!onboarding && me?.needs_onboarding) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === "loading") return <Splash />;
  if (status === "ready") return <Navigate to="/" replace />;
  return <>{children}</>;
}

const routeError = page(() => import("./routes/RouteError"));

const router = createBrowserRouter([
  {
    // One boundary around everything: any route that throws while rendering
    // gets the friendly screen, and the crash is reported.
    errorElement: routeError,
    children: [
      {
        element: (
          <PublicOnly>
            <Outlet />
          </PublicOnly>
        ),
        children: [
          { path: "/login", element: page(() => import("./routes/auth/Login")) },
          { path: "/signup", element: page(() => import("./routes/auth/Signup")) },
          { path: "/forgot-password", element: page(() => import("./routes/auth/ForgotPassword")) },
          { path: "/recover", element: page(() => import("./routes/auth/Recover")) },
        ],
      },
      // Reachable signed in or out: they arrive from an email.
      { path: "/reset-password", element: page(() => import("./routes/auth/ResetPassword")) },
      { path: "/verify-email", element: page(() => import("./routes/auth/VerifyEmail")) },
      { path: "/confirm-email", element: page(() => import("./routes/auth/ConfirmEmail")) },
      { path: "/unsubscribe", element: page(() => import("./routes/auth/Unsubscribe")) },
      {
        path: "/welcome",
        element: <RequireSession onboarding>{page(() => import("./routes/Welcome"))}</RequireSession>,
      },
      {
        element: (
          <RequireSession>
            <Shell />
          </RequireSession>
        ),
        children: [
          { path: "/", element: <Today /> },
          { path: "/log", element: page(() => import("./routes/log/LogPage")) },
          { path: "/workouts/live", element: page(() => import("./routes/log/LiveWorkout")) },
          { path: "/workouts/:id", element: page(() => import("./routes/log/WorkoutDetail")) },
          { path: "/workouts/:id/edit", element: page(() => import("./routes/log/EditWorkout")) },
          { path: "/history", element: page(() => import("./routes/History")) },
          { path: "/progress", element: page(() => import("./routes/progress/Progress")) },
          { path: "/progress/xp", element: page(() => import("./routes/progress/Xp")) },
          { path: "/recap", element: page(() => import("./routes/Recap")) },
          { path: "/recap/month", element: page(() => import("./routes/MonthRecap")) },
          { path: "/records", element: page(() => import("./routes/progress/Records")) },
          { path: "/records/history", element: page(() => import("./routes/progress/RecordHistory")) },
          { path: "/review", element: page(() => import("./routes/Review")) },
          { path: "/achievements", element: page(() => import("./routes/progress/Achievements")) },
          { path: "/body", element: page(() => import("./routes/progress/Body")) },
          { path: "/food", element: page(() => import("./routes/progress/Food")) },
          { path: "/journal", element: page(() => import("./routes/Journal")) },
          { path: "/insights", element: page(() => import("./routes/Insights")) },
          { path: "/habits", element: page(() => import("./routes/habits/Habits")) },
          { path: "/habits/:id", element: page(() => import("./routes/habits/HabitDetail")) },
          { path: "/exercises", element: page(() => import("./routes/library/Exercises")) },
          { path: "/exercises/:id", element: page(() => import("./routes/library/ExerciseDetail")) },
          { path: "/routines", element: page(() => import("./routes/library/Routines")) },
          { path: "/plans", element: page(() => import("./routes/plans/Plans")) },
          { path: "/plans/:id", element: page(() => import("./routes/plans/PlanDetail")) },
          { path: "/routines/:id", element: page(() => import("./routes/library/RoutineEditor")) },
          { path: "/feed", element: page(() => import("./routes/social/Feed")) },
          { path: "/feed/:id", element: page(() => import("./routes/social/EventDetail")) },
          { path: "/people", element: page(() => import("./routes/social/People")) },
          { path: "/u/:handle", element: page(() => import("./routes/social/Profile")) },
          { path: "/u/:handle/:list", element: page(() => import("./routes/social/FollowList")) },
          { path: "/groups", element: page(() => import("./routes/social/Groups")) },
          { path: "/buddies", element: page(() => import("./routes/social/Buddies")) },
          { path: "/groups/:id", element: page(() => import("./routes/social/GroupDetail")) },
          { path: "/challenges", element: page(() => import("./routes/social/Challenges")) },
          { path: "/challenges/:id", element: page(() => import("./routes/social/ChallengeDetail")) },
          { path: "/leaderboards", element: page(() => import("./routes/social/Leaderboards")) },
          { path: "/notifications", element: page(() => import("./routes/Notifications")) },
          { path: "/you", element: page(() => import("./routes/You")) },
          { path: "/settings", element: page(() => import("./routes/settings/Settings")) },
          { path: "/settings/:section", element: page(() => import("./routes/settings/Settings")) },
          { path: "/tools", element: page(() => import("./routes/Tools")) },
          { path: "/admin", element: page(() => import("./routes/Admin")) },
          { path: "*", element: page(() => import("./routes/NotFound")) },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ size: 20, weight: "regular", mirrored: false }}>
        <SessionProvider>
          <RouterProvider router={router} />
          <Toaster />
        </SessionProvider>
      </IconContext.Provider>
    </QueryClientProvider>
  );
}
