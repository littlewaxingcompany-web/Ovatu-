import React, { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Filter, Trash2 } from 'lucide-react';
import api from '../api';

interface EventLog {
  id: string;
  user_id: string;
  webhook_id: string | null;
  webhook_name?: string; // We might need to join this or the backend provides it
  ovatu_event_id: string | null;
  event_type: string;
  payload: string;
  status: 'pending' | 'sent' | 'failed';
  response_status: number | null;
  sent_at: string | null;
  created_at: string;
}

const eventTypes = [
  { id: '', label: 'All Types' },
  { id: 'new_booking', label: 'New Booking' },
  { id: 'cancelled_booking', label: 'Cancelled' },
  { id: 'rescheduled_booking', label: 'Rescheduled' },
  { id: 'check_in', label: 'Check-in' },
];

const statusTypes = [
  { id: '', label: 'All Statuses' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
  { id: 'pending', label: 'Pending' },
];

const Events = () => {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      // Backend currently doesn't support server-side filtering by type/status in the DB call 
      // but the UI should ideally handle it or we fetch and filter client-side for now.
      // Given the backend code I saw, it only takes limit and offset.
      const response = await api.get(`/events?limit=100&offset=0`);
      setEvents(response.data.events);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredEvents = events.filter((event) => {
    const matchesType = !filterType || event.event_type === filterType;
    const matchesStatus = !filterStatus || event.status === filterStatus;
    return matchesType && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Log</h1>
          <p className="mt-1 text-sm text-gray-500">History of dispatched webhooks</p>
        </div>
        <button
          onClick={fetchEvents}
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-orange-100 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center text-gray-400 mr-2">
          <Filter className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-orange-50/50 border-none rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-orange-500"
        >
          {eventTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-orange-50/50 border-none rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-orange-500"
        >
          {statusTypes.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        
        <div className="ml-auto text-xs text-gray-400">
          Showing {filteredEvents.length} events
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          <p className="mt-4 text-gray-500">Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white border border-orange-100 rounded-xl p-12 text-center shadow-sm">
          <Clock className="mx-auto w-12 h-12 text-orange-200 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No events found</h3>
          <p className="mt-2 text-gray-500">
            {events.length === 0 
              ? "We'll show you the log as soon as Ovatu triggers some activity."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-orange-50">
            <thead className="bg-orange-50/50">
              <tr>
                <th className="w-10 px-6 py-3"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTTP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {filteredEvents.map((event) => (
                <React.Fragment key={event.id}>
                  <tr 
                    className="hover:bg-orange-50/30 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(event.id)}
                  >
                    <td className="px-6 py-4">
                      {expandedId === event.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(event.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        {event.event_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        {getStatusIcon(event.status)}
                        <span className="ml-2 capitalize">{event.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.response_status ? (
                        <span className={event.response_status >= 200 && event.response_status < 300 ? 'text-green-600' : 'text-red-600'}>
                          {event.response_status}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                  {expandedId === event.id && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50 border-t border-orange-100">
                        <div className="text-xs font-mono text-gray-600 bg-white p-4 rounded-lg border border-orange-100 overflow-auto max-h-96">
                          <pre>{JSON.stringify(JSON.parse(event.payload), null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Events;
