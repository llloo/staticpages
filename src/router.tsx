import { createHashRouter } from 'react-router-dom';
import Layout from './components/Layout';
import ReviewPage from './pages/ReviewPage';
import MorePage from './pages/MorePage';
import QuizPage from './pages/QuizPage';
import WordBankPage from './pages/WordBankPage';
import AddWordPage from './pages/AddWordPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <ReviewPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'quiz', element: <QuizPage /> },
      { path: 'words', element: <WordBankPage /> },
      { path: 'words/add', element: <AddWordPage /> },
      { path: 'words/edit/:id', element: <AddWordPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
