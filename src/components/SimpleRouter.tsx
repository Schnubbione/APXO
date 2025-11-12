import { useState, useEffect } from 'react';

type RouteConfig = {
  path: string;
  component: React.ComponentType;
};

type SimpleRouterProps = {
  routes: RouteConfig[];
  fallback: React.ComponentType;
};

export function SimpleRouter({ routes, fallback: Fallback }: SimpleRouterProps) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Find matching route
  const matchedRoute = routes.find(route => {
    // Exact match
    if (route.path === currentPath) return true;
    // Support trailing slash
    if (route.path === currentPath + '/') return true;
    if (route.path + '/' === currentPath) return true;
    return false;
  });

  if (matchedRoute) {
    const Component = matchedRoute.component;
    return <Component />;
  }

  return <Fallback />;
}

// Helper to navigate programmatically
export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
