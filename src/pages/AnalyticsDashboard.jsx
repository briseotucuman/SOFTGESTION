import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion as Motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bell,
  Check,
  CreditCard,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  CONTACTS_EQUALIZER,
  DELIVERY_SERIES,
  INITIAL_CAMPAIGNS,
  INITIAL_CONTACTS,
  INITIAL_NOTIFICATIONS,
  MESSAGES_BY_MONTH,
  TEXTS_WAVE_SERIES,
} from '../data/analyticsData.js';
import {
  CampaignProgressViz,
  ContactsEqualizer,
  DeliverySparkline,
  MessagesBarChart,
  TextsSentWave,
} from '../components/AnalyticsCharts.jsx';
import {
  AllContactsModal,
  NewCampaignModal,
  TopUpCreditsModal,
} from '../components/AnalyticsModals.jsx';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

const CARD_SPRING = { type: 'spring', stiffness: 320, damping: 24 };

export default function AnalyticsDashboard() {
  const [activeNav, setActiveNav] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('Sep');
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [totalContactsCount, setTotalContactsCount] = useState(3211);
  const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
  const [campaignTotalCount, setCampaignTotalCount] = useState(25);
  const [credits, setCredits] = useState(2390);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [smartRouting, setSmartRouting] = useState(true);
  const [quietHours, setQuietHours] = useState(true);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  const filteredTopContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.handle.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q),
        )
      : contacts;
    return list.slice(0, 4);
  }, [contacts, searchQuery]);

  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return campaigns.filter((c) => {
      const matchesStatus = campaignFilter === 'All' || c.status === campaignFilter;
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.segment.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [campaigns, campaignFilter, searchQuery]);

  const handleAddContact = ({ name, handle, company }) => {
    const parts = name.split(' ').filter(Boolean);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    const newItem = {
      id: `ct-${Date.now()}`,
      name,
      handle,
      company,
      messages: 120,
      rate: 94.0,
      status: 'Subscribed',
      initials,
      tone: 'bg-blue-100 text-[#3B66F5]',
    };
    setContacts((prev) => [newItem, ...prev]);
    setTotalContactsCount((c) => c + 1);
  };

  const handleTopUpCredits = (amount) => {
    setCredits((prev) => prev + amount);
    setNotifications((prev) => [
      {
        id: `nt-${Date.now()}`,
        title: `Added $${amount.toLocaleString()} in credits`,
        detail: 'Balance updated immediately for outbound campaigns.',
        time: 'Just now',
        unread: true,
      },
      ...prev,
    ]);
  };

  const handleCreateCampaign = ({ name, segment, status }) => {
    const newCamp = {
      id: `cmp-${Date.now()}`,
      name,
      segment,
      status,
      sent: status === 'Active' ? 420 : 0,
      rate: status === 'Active' ? 92.4 : 0,
      updated: 'Just now',
    };
    setCampaigns((prev) => [newCamp, ...prev]);
    setCampaignTotalCount((c) => c + 1);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="saas-analytics-shell font-jakarta min-h-screen bg-[#F3F5FA] text-slate-900 relative overflow-x-hidden py-4 px-3 sm:py-7 sm:px-6 lg:px-8 flex items-center justify-center">
        {/* Subtle ambient atmospheric light */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-28 -left-24 w-[460px] h-[460px] rounded-full bg-[#A6BEFF]/25 blur-3xl" />
          <div className="absolute -bottom-32 right-0 w-[440px] h-[440px] rounded-full bg-[#3B66F5]/10 blur-3xl" />
        </div>

        {/* Main Glassmorphism Shell */}
        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[1320px] rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl p-3.5 sm:p-5 lg:p-6 flex flex-col md:flex-row gap-5 lg:gap-6"
        >
          {/* Floating Slim Dark Pill Sidebar (Desktop) */}
          <aside
            aria-label="Primary navigation"
            className="hidden md:flex flex-col items-center justify-between w-[72px] shrink-0 rounded-full bg-[#18191C] py-5 px-2 text-white shadow-[0_14px_34px_rgba(24,25,28,0.18)]"
          >
            {/* Brand Mark */}
            <button
              type="button"
              onClick={() => setActiveNav('overview')}
              title="PulseReach Analytics"
              className="w-11 h-11 rounded-full bg-[#3B66F5] flex items-center justify-center shadow-[0_6px_18px_rgba(59,102,245,0.45)] hover:scale-105 transition-transform"
            >
              <Send className="w-[18px] h-[18px] text-white -translate-x-[1px] translate-y-[1px]" strokeWidth={2} />
            </button>

            {/* Navigation Icons */}
            <nav className="flex flex-col items-center gap-2 my-6">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <Motion.span
                        layoutId="sidebarActivePill"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-full bg-white/14 border border-white/15"
                      />
                    )}
                    <Icon className="relative z-10 w-[19px] h-[19px]" strokeWidth={1.85} />
                  </button>
                );
              })}
            </nav>

            {/* Bottom Quick Top-Up / Status Dot */}
            <button
              type="button"
              onClick={() => setCreditsModalOpen(true)}
              title="Add credits"
              aria-label="Add credits"
              className="w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 flex flex-col gap-5 pb-16 md:pb-0">
            {/* Top Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 pt-1">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Good Afternoon, Marcus
                </h1>
                <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
                  {activeNav === 'overview'
                    ? 'Here is an overview of your messaging delivery and campaign reach.'
                    : `Viewing ${NAV_ITEMS.find((n) => n.id === activeNav)?.label} workspace`}
                </p>
              </div>

              {/* Right Utility Controls */}
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    aria-label="Search contacts or campaigns"
                    className="w-44 sm:w-56 rounded-full bg-white/90 border border-[#E5E7EB] pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-[0_4px_16px_rgb(0,0,0,0.03)] focus:outline-none focus:border-[#3B66F5] transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Notifications Button + Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen((v) => !v);
                      setProfileOpen(false);
                    }}
                    aria-label="Notifications"
                    className="relative w-10 h-10 rounded-full bg-white/90 border border-[#E5E7EB] text-slate-700 hover:text-slate-900 hover:bg-white flex items-center justify-center shadow-[0_4px_16px_rgb(0,0,0,0.03)] transition-colors"
                  >
                    <Bell className="w-[17px] h-[17px]" strokeWidth={1.85} />
                    {unreadCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#3B66F5] ring-2 ring-white" />
                    )}
                  </button>

                  <AnimatePresence>
                    {notifOpen && (
                      <Motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-[#E5E7EB] shadow-xl p-3.5 z-40"
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                          <span className="text-xs font-bold text-slate-900">
                            Notifications ({unreadCount})
                          </span>
                          <button
                            type="button"
                            onClick={markAllRead}
                            className="text-[11px] font-semibold text-[#3B66F5] hover:underline"
                          >
                            Mark all read
                          </button>
                        </div>
                        <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`rounded-xl p-2.5 text-left transition-colors ${
                                n.unread ? 'bg-[#F3F5FA]' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.detail}</p>
                            </div>
                          ))}
                        </div>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* User Avatar Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen((v) => !v);
                      setNotifOpen(false);
                    }}
                    className="flex items-center gap-2.5 rounded-full bg-white/90 border border-[#E5E7EB] pl-1.5 pr-3 py-1.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)] hover:bg-white transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#3B66F5] text-white text-[11px] font-bold flex items-center justify-center">
                      MC
                    </div>
                    <span className="hidden sm:inline text-xs font-semibold text-slate-800">
                      Marcus
                    </span>
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <Motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#E5E7EB] shadow-xl p-2 z-40"
                      >
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-bold text-slate-900">Marcus Chen</p>
                          <p className="text-[11px] text-slate-500">Growth Lead · Pro Plan</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNav('billing');
                            setProfileOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 mt-1 rounded-xl text-xs font-medium text-slate-700 hover:bg-[#F3F5FA]"
                        >
                          Credits & Billing (${credits.toLocaleString()})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNav('settings');
                            setProfileOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-[#F3F5FA]"
                        >
                          Workspace Preferences
                        </button>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </header>

            {/* Primary View Switcher */}
            {activeNav === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                {/* Left / Center Main Area (2 columns wide) */}
                <div className="lg:col-span-2 flex flex-col gap-5">
                  {/* Top Row: 2 KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Card 1: Delivery Rate */}
                    <Motion.section
                      whileHover={{ y: -4 }}
                      transition={CARD_SPRING}
                      className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-sm font-semibold text-slate-600">Delivery Rate</h2>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#3B66F5] tabular-nums">
                            <TrendingUp className="w-3 h-3" />
                            +2.4%
                          </span>
                        </div>
                        <div className="mt-2 text-3xl sm:text-[34px] font-bold text-slate-900 tracking-tight tabular-nums">
                          91.5%
                        </div>
                      </div>
                      <DeliverySparkline data={DELIVERY_SERIES} />
                    </Motion.section>

                    {/* Card 2: Campaigns */}
                    <Motion.section
                      whileHover={{ y: -4 }}
                      transition={CARD_SPRING}
                      className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-sm font-semibold text-slate-600">Campaigns</h2>
                          <button
                            type="button"
                            onClick={() => setCampaignModalOpen(true)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#F3F5FA] hover:bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            New
                          </button>
                        </div>
                        <div className="mt-2 text-3xl sm:text-[34px] font-bold text-slate-900 tracking-tight tabular-nums">
                          {campaignTotalCount}
                        </div>
                      </div>
                      <CampaignProgressViz campaigns={campaigns} />
                    </Motion.section>
                  </div>

                  {/* Middle Row: Top Contacts Wide Card */}
                  <Motion.section
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                          Top Contacts
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Highest engagement recipients across active sequences
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setContactsModalOpen(true)}
                        className="rounded-full bg-[#F3F5FA] hover:bg-[#E7ECF7] px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                      >
                        View all
                      </button>
                    </div>

                    {filteredTopContacts.length === 0 ? (
                      <div className="py-8 text-center rounded-xl bg-[#F3F5FA]/60">
                        <p className="text-xs font-medium text-slate-600">
                          No contacts match “{searchQuery}”
                        </p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="mt-1.5 text-xs font-semibold text-[#3B66F5] hover:underline"
                        >
                          Reset search
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {filteredTopContacts.map((contact) => {
                          const isSelected = selectedContactId === contact.id;
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() =>
                                setSelectedContactId(isSelected ? null : contact.id)
                              }
                              className={`w-full py-2.5 px-2.5 -mx-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
                                isSelected ? 'bg-[#F3F5FA]' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${contact.tone}`}
                                >
                                  {contact.initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">
                                    {contact.name}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {contact.handle}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="hidden sm:block text-right">
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    Delivery
                                  </span>
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                    {contact.rate.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="text-right min-w-[64px]">
                                  <span className="text-sm font-bold text-slate-900 tabular-nums block">
                                    {contact.messages.toLocaleString()}
                                  </span>
                                  <span className="text-[11px] text-slate-400">msgs</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Motion.section>

                  {/* Bottom Row: Messages by Month Wide Bar Chart Card */}
                  <Motion.section
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                  >
                    <MessagesBarChart
                      data={MESSAGES_BY_MONTH}
                      selectedMonth={selectedMonth}
                      onSelectMonth={setSelectedMonth}
                    />
                  </Motion.section>
                </div>

                {/* Right Column (1 column wide, stacked vertically) */}
                <div className="lg:col-span-1 flex flex-col gap-5">
                  {/* Top Card: Primary Accent Royal Blue "Contacts" */}
                  <Motion.section
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className="bg-[#3B66F5] text-white rounded-2xl p-6 shadow-[0_12px_32px_rgba(59,102,245,0.25)] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-white/85">Contacts</h2>
                        <span className="rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                          +18.2%
                        </span>
                      </div>
                      <div className="mt-2 text-3xl sm:text-[36px] font-bold tracking-tight text-white tabular-nums">
                        {totalContactsCount.toLocaleString()}
                      </div>
                    </div>
                    <ContactsEqualizer data={CONTACTS_EQUALIZER} />
                  </Motion.section>

                  {/* Middle Card: Minimal White "Credits" */}
                  <Motion.section
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between gap-4"
                  >
                    <div>
                      <h2 className="text-sm font-semibold text-slate-500">Credits</h2>
                      <div className="mt-1.5 text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
                        ${credits.toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                        ~{Math.round(credits * 33.3).toLocaleString()} messages left
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreditsModalOpen(true)}
                      aria-label="Top up credits"
                      title="Top up credits"
                      className="w-12 h-12 rounded-full bg-[#18191C] hover:bg-[#3B66F5] text-white flex items-center justify-center shrink-0 shadow-md transition-colors"
                    >
                      <ArrowUpRight className="w-5 h-5" strokeWidth={2} />
                    </button>
                  </Motion.section>

                  {/* Bottom Card: Dark Accent "Texts Sent" */}
                  <Motion.section
                    whileHover={{ y: -4 }}
                    transition={CARD_SPRING}
                    className="bg-[#18191C] text-white rounded-2xl p-6 shadow-[0_12px_32px_rgba(24,25,28,0.22)] flex-1 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-zinc-400">Texts Sent</h2>
                        <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#A6BEFF] tabular-nums">
                          +12.4% mo
                        </span>
                      </div>
                      <div className="mt-2 text-3xl sm:text-[36px] font-bold tracking-tight text-white tabular-nums">
                        91,226
                      </div>
                    </div>
                    <TextsSentWave data={TEXTS_WAVE_SERIES} />
                  </Motion.section>
                </div>
              </div>
            )}

            {/* Campaigns Secondary View */}
            {activeNav === 'campaigns' && (
              <Motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-1.5 rounded-xl bg-[#F3F5FA] p-1">
                    {['All', 'Active', 'Completed', 'Scheduled'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCampaignFilter(tab)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          campaignFilter === tab
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCampaignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#3B66F5] hover:bg-[#2F56D9] px-4 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Launch Campaign
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {filteredCampaigns.map((cmp) => (
                    <div
                      key={cmp.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-slate-900">{cmp.name}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              cmp.status === 'Active'
                                ? 'bg-blue-50 text-[#3B66F5]'
                                : cmp.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cmp.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Segment: {cmp.segment} · Updated {cmp.updated}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <div className="text-xs text-slate-400">Sent</div>
                          <div className="text-sm font-bold text-slate-900 tabular-nums">
                            {cmp.sent.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Delivery</div>
                          <div className="text-sm font-bold text-[#3B66F5] tabular-nums">
                            {cmp.rate ? `${cmp.rate.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Motion.div>
            )}

            {/* Contacts Secondary View */}
            {activeNav === 'contacts' && (
              <Motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Audience Directory</h2>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {totalContactsCount.toLocaleString()} total subscribed contacts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContactsModalOpen(true)}
                    className="rounded-full bg-[#18191C] hover:bg-[#3B66F5] px-4 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    Manage / Add Contacts
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${contact.tone}`}
                        >
                          {contact.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{contact.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {contact.handle} · {contact.company}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">
                          {contact.messages.toLocaleString()} msgs
                        </p>
                        <p className="text-[11px] font-medium text-[#3B66F5] tabular-nums">
                          {contact.rate.toFixed(1)}% delivery
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Motion.div>
            )}

            {/* Messages Secondary View */}
            {activeNav === 'messages' && (
              <Motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-5"
              >
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <MessagesBarChart
                    data={MESSAGES_BY_MONTH}
                    selectedMonth={selectedMonth}
                    onSelectMonth={setSelectedMonth}
                  />
                </div>
                <div className="bg-[#18191C] text-white rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400">Cumulative Outbound</h3>
                    <div className="mt-2 text-3xl font-bold tabular-nums">91,226</div>
                    <p className="text-xs text-zinc-400 mt-1">
                      91.5% average carrier confirmation across all 12 months.
                    </p>
                  </div>
                  <TextsSentWave data={TEXTS_WAVE_SERIES} />
                </div>
              </Motion.div>
            )}

            {/* Billing Secondary View */}
            {activeNav === 'billing' && (
              <Motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-5"
              >
                <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#3B66F5] uppercase tracking-wider">
                      Prepaid Wallet
                    </span>
                    <div className="mt-2 text-4xl font-bold text-slate-900 tabular-nums">
                      ${credits.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Estimated runway: ~{Math.round(credits * 33.3).toLocaleString()} outbound SMS segments at $0.030/msg.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreditsModalOpen(true)}
                    className="mt-6 w-fit rounded-full bg-[#18191C] hover:bg-[#3B66F5] px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Add Credits
                  </button>
                </div>
                <div className="bg-[#3B66F5] text-white rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/85">
                        Auto-Reload Protection
                      </span>
                    </div>
                    <p className="text-lg font-bold mt-2">Active above $500 threshold</p>
                    <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                      Campaigns will never pause mid-broadcast when carrier traffic spikes.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-xs font-semibold">
                    <Check className="w-4 h-4" />
                    <span>Zero-downtime billing enabled</span>
                  </div>
                </div>
              </Motion.div>
            )}

            {/* Settings Secondary View */}
            {activeNav === 'settings' && (
              <Motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5"
              >
                <div>
                  <h2 className="text-base font-bold text-slate-900">Messaging Preferences</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure delivery optimization and compliance guardrails
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Smart Carrier Routing</p>
                      <p className="text-xs text-slate-500">
                        Automatically shift traffic toward highest delivery rate pools
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartRouting((v) => !v)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors ${
                        smartRouting ? 'bg-[#3B66F5]' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          smartRouting ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Recipient Quiet Hours</p>
                      <p className="text-xs text-slate-500">
                        Hold non-urgent campaign messages between 9:00 PM and 8:00 AM local time
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuietHours((v) => !v)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors ${
                        quietHours ? 'bg-[#3B66F5]' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          quietHours ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </Motion.div>
            )}
          </div>
        </Motion.div>

        {/* Mobile Floating Bottom Pill Dock */}
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-[#18191C] px-3 py-2 flex items-center gap-1.5 shadow-xl border border-white/10"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                aria-label={item.label}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'bg-[#3B66F5] text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.85} />
              </button>
            );
          })}
        </nav>

        {/* Interactive Modals */}
        <AllContactsModal
          open={contactsModalOpen}
          onClose={() => setContactsModalOpen(false)}
          contacts={contacts}
          onAddContact={handleAddContact}
        />
        <TopUpCreditsModal
          open={creditsModalOpen}
          onClose={() => setCreditsModalOpen(false)}
          currentCredits={credits}
          onTopUp={handleTopUpCredits}
        />
        <NewCampaignModal
          open={campaignModalOpen}
          onClose={() => setCampaignModalOpen(false)}
          onCreate={handleCreateCampaign}
        />
      </div>
    </MotionConfig>
  );
}
