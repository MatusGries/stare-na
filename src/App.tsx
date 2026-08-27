import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy: keeps the root route's bundle free of the user-galaxy code
// (the ML stack itself lives in the worker chunk — eng-review decision 3A)
const You = lazy(() => import("./pages/You.tsx"));
const UserGalaxy = lazy(() => import("./pages/UserGalaxy.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div style={{ height: "100vh", background: "#000004" }} />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/you" element={<You />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE USERNAME + CATCH-ALL ROUTES */}
            <Route path="/:username" element={<UserGalaxy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
