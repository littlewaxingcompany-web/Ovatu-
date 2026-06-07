import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Webhook, ListTree, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-orange-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-orange-100 shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold text-orange-600">Ovatu Relay</h1>
        </div>
        <nav className="mt-6">
          <Link to="/dashboard" className="flex items-center px-6 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
            <LayoutDashboard className="w-5 h-5 mr-3" />
            Dashboard
          </Link>
          <Link to="/webhooks" className="flex items-center px-6 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
            <Webhook className="w-5 h-5 mr-3" />
            Webhooks
          </Link>
          <Link to="/events" className="flex items-center px-6 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
            <ListTree className="w-5 h-5 mr-3" />
            Events
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-6 py-3 mt-10 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
