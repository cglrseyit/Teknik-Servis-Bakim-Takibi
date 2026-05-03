import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EquipmentListPage from './pages/EquipmentListPage';
import EquipmentFormPage from './pages/EquipmentFormPage';
import EquipmentDetailPage from './pages/EquipmentDetailPage';
import PlansListPage from './pages/PlansListPage';
import PlanFormPage from './pages/PlanFormPage';
import PlanDetailPage from './pages/PlanDetailPage';
import UsersPage from './pages/UsersPage';
import MyTasksPage from './pages/MyTasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  return (
    <AuthProvider>
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/equipment" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><EquipmentListPage /></ProtectedRoute>} />
        <Route path="/equipment/new" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><EquipmentFormPage /></ProtectedRoute>} />
        <Route path="/equipment/:id" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><EquipmentDetailPage /></ProtectedRoute>} />
        <Route path="/equipment/:id/edit" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><EquipmentFormPage /></ProtectedRoute>} />
        <Route path="/plans" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><PlansListPage /></ProtectedRoute>} />
        <Route path="/plans/new" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><PlanFormPage /></ProtectedRoute>} />
        <Route path="/plans/:id/edit" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><PlanFormPage /></ProtectedRoute>} />
        <Route path="/plans/:id" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><PlanDetailPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/tasks/my" element={<ProtectedRoute><MyTasksPage /></ProtectedRoute>} />
        <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['admin','teknik_muduru','order_taker']}><ReportsPage /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
    </AuthProvider>
  );
}
