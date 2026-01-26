import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { Toaster } from 'sonner'
import { AuthProvider } from './lib/auth'
import App from './App'
import EventsListPage from './pages/EventsListPage'
import EventDetailsPage from './pages/EventDetailsPage'
import PlayersPage from './pages/PlayersPage'
import TeamsPage from './pages/TeamsPage'
import BracketPage from './pages/BracketPage'
import ClaimProfilePage from './pages/ClaimProfilePage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <EventsListPage /> },
      { path: 'events', element: <EventsListPage /> },
      { path: 'events/:eventId', element: <EventDetailsPage /> },
      { path: 'events/:eventId/teams', element: <TeamsPage /> },
      { path: 'events/:eventId/bracket', element: <BracketPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'claim-profile', element: <ClaimProfilePage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors />
    </AuthProvider>
  </React.StrictMode>
)
