import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = '/api';

const emptyEventForm = {
  Name: '',
  TotalSeats: '',
  EventDate: '',
};

function extractErrorMessage(payload) {
  if (!payload) return '';

  if (typeof payload === 'string') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(extractErrorMessage).find(Boolean) || '';
  }

  if (typeof payload === 'object') {
    for (const value of Object.values(payload)) {
      const message = extractErrorMessage(value);
      if (message) return message;
    }
  }

  return '';
}

function formatLocalTime(value) {
  if (!value) return '—';

  const date = new Date(`1970-01-01T${value}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function App() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortEvents, setSortEvents] = useState(true);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);

  // For inline register modal
  const [registerModal, setRegisterModal] = useState(null); // { eventId, eventName }
  const [registerUserName, setRegisterUserName] = useState('');

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const seatsLeft = events.reduce((sum, event) => sum + Number(event.AvailableSeats || 0), 0);
    const totalRegistrations = registrations.length;
    return { totalEvents, seatsLeft, totalRegistrations };
  }, [events, registrations]);

  useEffect(() => {
    void loadDashboard();
  }, [sortEvents, showUpcomingOnly]);

  // Auto-dismiss messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  async function loadDashboard() {
    setError('');
    try {
      const eventsParams = new URLSearchParams();

      if (sortEvents) {
        eventsParams.set('sort', 'true');
      }

      if (showUpcomingOnly) {
        eventsParams.set('upcoming', 'true');
      }

      const eventsQuery = eventsParams.toString();

      const [eventsResponse, registrationsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/${eventsQuery ? `?${eventsQuery}` : ''}`),
        fetch(`${API_BASE_URL}/registrations/`),
      ]);

      const eventsData = await eventsResponse.json().catch(() => []);
      const registrationsData = await registrationsResponse.json().catch(() => []);

      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setRegistrations(Array.isArray(registrationsData) ? registrationsData : []);
    } catch {
      setError('Backend unreachable. Make sure Django is running on port 8000.');
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    setIsBusy(true);
    setError('');

    try {
      const eventDate = new Date(eventForm.EventDate);

      const response = await fetch(`${API_BASE_URL}/create-event/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventForm,
          TotalSeats: Number(eventForm.TotalSeats),
          EventDate: Number.isNaN(eventDate.getTime()) ? eventForm.EventDate : eventDate.toISOString(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(extractErrorMessage(payload) || 'Event creation failed');
      }

      setEventForm(emptyEventForm);
      setShowCreateForm(false);
      setSuccess('Event created successfully!');
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Could not create the event.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!registerModal) return;
    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/register-event/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: registerUserName.trim(),
          RegisteredEvent: registerModal.eventId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(extractErrorMessage(payload) || 'Registration failed');
      }

      setRegisterModal(null);
      setRegisterUserName('');
      setSuccess('Registered successfully!');
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Could not register for the event.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancelRegistration(regId) {
    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/registrations/${regId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Cancellation failed');

      setSuccess('Registration cancelled.');
      await loadDashboard();
    } catch {
      setError('Could not cancel the registration.');
    } finally {
      setIsBusy(false);
    }
  }

  // Build a lookup: eventId -> list of registrations for that event
  const regsByEvent = useMemo(() => {
    const map = {};
    registrations.forEach((r) => {
      const eid = r.RegisteredEvent;
      if (!map[eid]) map[eid] = [];
      map[eid].push(r);
    });
    return map;
  }, [registrations]);

  return (
    <div className="app-shell">
      <div className="glow glow-left" />
      <div className="glow glow-right" />

      <main className="page">
        {/* ── Header Bar ── */}
        <header className="header-bar">
          <div className="header-left">
            <span className="logo">⚡</span>
            <h1>EventAPI</h1>
          </div>

          <div className="header-stats">
            <div className="stat-chip">
              <span>{stats.totalEvents}</span> events
            </div>
            <div className="stat-chip">
              <span>{stats.totalRegistrations}</span> registrations
            </div>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={loadDashboard}
              disabled={isBusy}
              title="Refresh"
            >
              ↻ Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? '✕ Close' : '+ New Event'}
            </button>
          </div>
        </header>

        {/* ── Toast Messages ── */}
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}

        {/* ── Create Event Slide-down ── */}
        {showCreateForm && (
          <form className="create-bar card" onSubmit={handleCreateEvent}>
            <input
              type="text"
              value={eventForm.Name}
              onChange={(e) => setEventForm({ ...eventForm, Name: e.target.value })}
              placeholder="Event name"
              required
            />
            <input
              type="number"
              min="1"
              value={eventForm.TotalSeats}
              onChange={(e) => setEventForm({ ...eventForm, TotalSeats: e.target.value })}
              placeholder="Seats"
              required
            />
            <input
              type="datetime-local"
              value={eventForm.EventDate}
              onChange={(e) => setEventForm({ ...eventForm, EventDate: e.target.value })}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={isBusy}>
              Create
            </button>
          </form>
        )}

        {/* ── Events Table ── */}
        <section className="card table-card">
          <div className="section-header">
            <h2>📅 Events</h2>
            <div className="section-filters">
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={sortEvents}
                  onChange={(e) => setSortEvents(e.target.checked)}
                />
                <span>Sort</span>
              </label>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={showUpcomingOnly}
                  onChange={(e) => setShowUpcomingOnly(e.target.checked)}
                />
                <span>Upcoming</span>
              </label>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Event Name</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Booked</th>
                  <th>Available</th>
                  <th>Registrations</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr>
                    <td colSpan="8" className="empty-row">No events found</td>
                  </tr>
                )}
                {events.map((event) => {
                  const eventRegs = regsByEvent[event.id] || [];
                  const isFull = Number(event.AvailableSeats) <= 0;
                  return (
                    <tr key={event.id}>
                      <td className="cell-id">{event.id}</td>
                      <td className="cell-name">{event.Name}</td>
                      <td className="cell-date">
                        {new Date(event.EventDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>{event.TotalSeats}</td>
                      <td>{event.TotalRegistrations}</td>
                      <td>
                        <span className={isFull ? 'badge badge-full' : 'badge badge-open'}>
                          {event.AvailableSeats}
                        </span>
                      </td>
                      <td className="cell-regs">
                        {eventRegs.length === 0
                          ? <span className="muted-text">—</span>
                          : eventRegs.map((r) => (
                              <span key={r.id} className="reg-chip">
                                {r.UserName || `U${r.RegisteredUser}`}
                              </span>
                            ))
                        }
                      </td>
                      <td className="cell-actions">
                        <button
                          className="btn btn-sm btn-accent"
                          disabled={isFull || isBusy}
                          onClick={() => {
                            setRegisterModal({ eventId: event.id, eventName: event.Name });
                            setRegisterUserName('');
                          }}
                        >
                          Register
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Active Registrations Section ── */}
        <section className="card table-card registrations-section">
          <div className="section-header">
            <h2>📋 Active Registrations</h2>
            <span className="section-count">{registrations.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reg ID</th>
                  <th>User Name</th>
                  <th>Event Name</th>
                  <th>Event Date</th>
                  <th>Registered At</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-row">No active registrations</td>
                  </tr>
                )}
                {registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td className="cell-id">{reg.id}</td>
                    <td className="cell-name">{reg.UserName || `User #${reg.RegisteredUser}`}</td>
                    <td>{reg.EventName || `Event #${reg.RegisteredEvent}`}</td>
                    <td className="cell-date">
                      {reg.EventDate
                        ? new Date(reg.EventDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'
                      }
                    </td>
                    <td className="cell-date">{formatLocalTime(reg.TimeStamp)}</td>
                    <td className="cell-actions">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancelRegistration(reg.id)}
                        disabled={isBusy}
                      >
                        ✕ Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ── Register Modal Overlay ── */}
      {registerModal && (
        <div className="modal-overlay" onClick={() => setRegisterModal(null)}>
          <form
            className="modal card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleRegister}
          >
            <h3>Register for "{registerModal.eventName}"</h3>
            <label>
              User Name
              <input
                type="text"
                value={registerUserName}
                onChange={(e) => setRegisterUserName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                required
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRegisterModal(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={isBusy}>
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;