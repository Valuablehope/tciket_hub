import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

console.log('🚀 Starting app...');

// Test component to see if React is working
const TestComponent = () => {
  console.log('✅ TestComponent is rendering');
  return <div style={{ padding: '20px', fontSize: '18px' }}>Test Component is Working!</div>;
};

// Temporarily use TestComponent instead of App to debug
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        {/* Temporarily replace <App /> with <TestComponent /> to test */}
        <TestComponent />
        {/* <App /> */}
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

console.log('🎯 React root created and render called');