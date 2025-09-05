import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './index.css'

// Screens
import HomeScreen from './screens/HomeScreen'
import NewVisitScreen from './screens/NewVisitScreen'
import CaptureFlowScreen from './screens/CaptureFlowScreen'
import CaptureScreen from './screens/CaptureScreen'
import ReviewScreen from './screens/ReviewScreen'
import ProcessingScreen from './screens/ProcessingScreen'
import EstimateScreen from './screens/EstimateScreen'
import HistoryScreen from './screens/HistoryScreen'
import SettingsScreen from './screens/SettingsScreen'
import FinalizeVisitScreen from './screens/FinalizeVisitScreen'
import AuthScreen from './screens/AuthScreen'
import ApprovalScreen from './screens/ApprovalScreen'
import NotFoundScreen from './screens/NotFoundScreen'

// Use HashRouter for Capacitor compatibility
const router = createHashRouter([
  {
    path: '/auth',
    element: <AuthScreen />
  },
  {
    path: '/approve/:token',
    element: <ApprovalScreen />
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'new-visit', element: <NewVisitScreen /> },
      { path: 'capture/:visitId', element: <CaptureFlowScreen /> },
      { path: 'capture', element: <CaptureScreen /> }, // Legacy route
      { path: 'finalize/:visitId', element: <FinalizeVisitScreen /> },
      { path: 'review/:visitId', element: <ReviewScreen /> },
      { path: 'review', element: <ReviewScreen /> }, // Legacy route
      { path: 'processing/:visitId', element: <ProcessingScreen /> },
      { path: 'estimate/:estimateId', element: <EstimateScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <NotFoundScreen /> }
    ]
  },
  {
    path: '*',
    element: <NotFoundScreen />
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)