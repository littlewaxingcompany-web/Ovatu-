import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../api';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: number;
}

const eventTypes = [
  { id: 'new_booking', label: 'New Booking' },
  { id: 'cancelled_booking', label: 'Cancelled' },
  { id: 'rescheduled_booking', label: 'Rescheduled' },
  { id: 'check_in', label: 'Check-in' },
];

const Webhooks = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const fetchWebhooks = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/webhooks');
      setWebhooks(response.data.webhooks);
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const openModal = (webhook: Webhook | null = null) => {
    setEditingWebhook(webhook);
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setSelectedEvents(webhook.events);
      setActive(webhook.active === 1);
    } else {
      setName('');
      setUrl('');
      setSelectedEvents([]);
      setActive(true);
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWebhook(null);
  };

  const handleEventToggle = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!name.trim()) return setFormError('Name is required');
    if (!url.trim()) return setFormError('Zapier URL is required');
    if (selectedEvents.length === 0) return setFormError('Select at least one event type');

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        url,
        events: selectedEvents,
        active: active ? 1 : 0,
      };

      if (editingWebhook) {
        await api.put(`/webhooks/${editingWebhook.id}`, payload);
      } else {
        await api.post('/webhooks', payload);
      }
      
      await fetchWebhooks();
      closeModal();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
    
    try {
      await api.delete(`/webhooks/${id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
      alert('Failed to delete webhook');
    }
  };

  const toggleActive = async (webhook: Webhook) => {
    try {
      const newActive = webhook.active === 1 ? 0 : 1;
      await api.put(`/webhooks/${webhook.id}`, { active: newActive });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? { ...w, active: newActive } : w))
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-500">Configure where to send Ovatu events</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Webhook
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          <p className="mt-4 text-gray-500">Loading your webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white border border-orange-100 rounded-xl p-12 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No webhooks yet</h3>
          <p className="mt-2 text-gray-500 max-w-sm mx-auto">
            Connect Ovatu to Zapier or other services by adding your first webhook configuration.
          </p>
          <button
            onClick={() => openModal()}
            className="mt-6 text-orange-600 font-medium hover:text-orange-700"
          >
            Create your first webhook &rarr;
          </button>
        </div>
      ) : (
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-orange-50">
            <thead className="bg-orange-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {webhook.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="truncate max-w-xs block" title={webhook.url}>
                      {webhook.url}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((e) => (
                        <span key={e} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          {e.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => toggleActive(webhook)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        webhook.active === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {webhook.active === 1 ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Paused
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openModal(webhook)}
                      className="text-gray-400 hover:text-orange-600 mr-3 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeModal}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>&#8203;

            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="w-full">
                      <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">
                        {editingWebhook ? 'Edit Webhook' : 'New Webhook'}
                      </h3>
                      
                      {formError && (
                        <div className="mb-4 bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {formError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Name</label>
                          <input
                            type="text"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                            placeholder="e.g. New Booking -> WhatsApp"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Zapier Webhook URL</label>
                          <input
                            type="url"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                            placeholder="https://hooks.zapier.com/hooks/catch/..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subscribe to Events</label>
                          <div className="grid grid-cols-2 gap-2">
                            {eventTypes.map((event) => (
                              <label key={event.id} className="flex items-center space-x-2 text-sm p-2 border border-orange-50 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                  checked={selectedEvents.includes(event.id)}
                                  onChange={() => handleEventToggle(event.id)}
                                />
                                <span className="text-gray-700">{event.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Webhook Status</span>
                          <button
                            type="button"
                            onClick={() => setActive(!active)}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${
                              active ? 'bg-orange-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                              active ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-orange-400"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingWebhook ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Webhooks;
