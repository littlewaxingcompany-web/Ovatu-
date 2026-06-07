const Dashboard = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to your Ovatu Webhook Relay dashboard.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Connection Status</h3>
          <div className="mt-4 flex items-center">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse mr-2"></div>
            <span className="text-lg font-semibold text-gray-900">Connected to Ovatu</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Last synced: Just now</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Webhooks</h3>
          <p className="mt-4 text-3xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-500">Configured targets</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Events Processed</h3>
          <p className="mt-4 text-3xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-500">Last 24 hours</p>
        </div>
      </div>

      <div className="mt-12 bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-orange-50">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">No recent activity to show.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
