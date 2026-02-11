import { createHashRouter } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ReviewPage from './pages/ReviewPage';
import MorePage from './pages/MorePage';
import QuizPage from './pages/QuizPage';
import WordBankPage from './pages/WordBankPage';
import AddWordPage from './pages/AddWordPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AdminEditListPage from './pages/AdminEditListPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SupabaseTestPage from './pages/SupabaseTestPage';

export const router = createHashRouter([
  {
    path: '/test',
    element: <SupabaseTestPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ReviewPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'quiz', element: <QuizPage /> },
      { path: 'words', element: <WordBankPage /> },
      { path: 'words/add', element: <AddWordPage /> },
      { path: 'words/edit/:id', element: <AddWordPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'admin/edit', element: <AdminEditListPage /> },
      { path: 'admin/edit/:id', element: <AdminEditListPage /> },
    ],
  },
]);
