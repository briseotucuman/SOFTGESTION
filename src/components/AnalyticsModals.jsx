import { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check, Plus, Search, Sparkles, UserPlus, X } from 'lucide-react';

export function AllContactsModal({ open, onClose, contacts, onAddContact }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('messages');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [company, setCompany] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.handle.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q),
        )
      : [...contacts];
    return list.sort((a, b) => (sortBy === 'messages' ? b.messages - a.messages : b.rate - a.rate));
  }, [contacts, query, sortBy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) return;
    onAddContact({
      name: name.trim(),
      handle: handle.trim(),
      company: company.trim() || 'Direct Client',
    });
    setName('');
    setHandle('');
    setCompany('');
    setAdding(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">All Top Contacts</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filtered.length} engaged profiles sorted by{' '}
                  {sortBy === 'messages' ? 'message volume' : 'delivery rate'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdding((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#3B66F5] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2F56D9] transition-colors whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{adding ? 'Cancel' : 'Add contact'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close contacts modal"
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {adding && (
              <form onSubmit={handleSubmit} className="px-6 py-4 bg-[#F3F5FA]/70 border-b border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                  <input
                    type="email"
                    placeholder="Email or @handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    required
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#18191C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by name, email, or company..."
                  className="w-full rounded-xl border border-gray-200 bg-[#F3F5FA]/60 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-[#F3F5FA] p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('messages')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    sortBy === 'messages' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Volume
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('rate')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    sortBy === 'rate' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Delivery %
                </button>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 px-6">
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">No contacts match “{query}”</p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-2 text-xs font-semibold text-[#3B66F5] hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                filtered.map((contact) => (
                  <div
                    key={contact.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${contact.tone}`}
                      >
                        {contact.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">{contact.name}</span>
                          <span className="text-[11px] font-medium text-slate-400 truncate hidden sm:inline">
                            · {contact.company}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{contact.handle}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {contact.messages.toLocaleString()}
                      </div>
                      <div className="text-[11px] font-medium text-[#3B66F5] tabular-nums">
                        {contact.rate.toFixed(1)}% deliv.
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

export function TopUpCreditsModal({ open, onClose, currentCredits, onTopUp }) {
  const [selected, setSelected] = useState(500);
  const [custom, setCustom] = useState('');
  const [done, setDone] = useState(false);

  const amount = custom ? Math.max(0, Number(custom) || 0) : selected;

  const handleConfirm = (e) => {
    e.preventDefault();
    if (amount <= 0) return;
    onTopUp(amount);
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setCustom('');
      onClose();
    }, 650);
  };

  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white border border-gray-200 shadow-2xl p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Messaging Credits</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current balance:{' '}
                  <span className="font-semibold text-slate-800 tabular-nums">
                    ${currentCredits.toLocaleString()}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close credits modal"
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirm} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                {[250, 500, 1000].map((preset) => {
                  const active = !custom && selected === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCustom('');
                        setSelected(preset);
                      }}
                      className={`rounded-2xl border px-3 py-3 text-center transition-all ${
                        active
                          ? 'border-[#3B66F5] bg-[#3B66F5]/5 text-[#3B66F5]'
                          : 'border-gray-200 bg-white text-slate-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-bold tabular-nums">+${preset}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        ~{Math.round(preset * 33.3).toLocaleString()} SMS
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Or enter custom amount (USD)
                </label>
                <input
                  type="number"
                  min="10"
                  max="25000"
                  placeholder="e.g. 750"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-[#F3F5FA]/60 px-3.5 py-2.5 text-sm font-medium text-slate-900 tabular-nums placeholder:text-slate-400"
                />
              </div>

              <div className="rounded-2xl bg-[#F3F5FA] px-4 py-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">New projected balance</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  ${(currentCredits + amount).toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={amount <= 0 || done}
                className="w-full rounded-2xl bg-[#18191C] hover:bg-slate-800 text-white py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {done ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Credits Added</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add ${amount.toLocaleString()} Credits</span>
                  </>
                )}
              </button>
            </form>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

export function NewCampaignModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('VIP Tiers');
  const [status, setStatus] = useState('Active');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), segment, status });
    setName('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white border border-gray-200 shadow-2xl p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#3B66F5]/10 text-[#3B66F5] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Launch Campaign</h3>
                  <p className="text-xs text-slate-500">Schedule or activate an outbound flow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close campaign modal"
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Campaign name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cyber Monday Flash Alert"
                  className="w-full rounded-xl border border-gray-200 bg-[#F3F5FA]/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Audience</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-[#F3F5FA]/60 px-3 py-2.5 text-sm text-slate-900"
                  >
                    <option>VIP Tiers</option>
                    <option>All Active</option>
                    <option>Enterprise</option>
                    <option>New Signups</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Initial status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-[#F3F5FA]/60 px-3 py-2.5 text-sm text-slate-900"
                  >
                    <option>Active</option>
                    <option>Scheduled</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#3B66F5] hover:bg-[#2F56D9] text-white py-3 text-sm font-semibold transition-colors"
              >
                Create Campaign
              </button>
            </form>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
