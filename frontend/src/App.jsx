import React, { useState, useEffect, useCallback } from 'react';
import api, {
  getStoredToken,
  setStoredTokens,
  clearStoredTokens,
  loginRequest,
  fetchCurrentUser,
} from './api/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import {
  ArrowUpTrayIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  ExclamationTriangleIcon, ShieldCheckIcon, DocumentTextIcon,
  UserIcon, ArrowRightOnRectangleIcon, EyeIcon, ChatBubbleLeftRightIcon,
  AdjustmentsHorizontalIcon, ListBulletIcon, CheckIcon
} from '@heroicons/react/24/outline';

// Mock sample file contents for quick injection
const SAMPLE_SAP_CSV = `Buchungsdatum,Materialbezeichnung,Menge,Einheit,Kraftstofftyp,Buchungskreis,Kostenart,Werk
01.03.2026,Fleet Diesel Refuel,"1500,50",L,diesel,DE01,Procurement,W102
15.03.2026,Erdgas (Natural Gas) Heating,"4200,80",m3,natural gas,DE01,Utilities,W102
20.03.2026,Benzin procurement for generators,"450,20",ltr,petrol,DE02,Operations,W103
28.03.2026,Bulk Diesel storage delivery,"12500,00",litres,diesel,DE01,Procurement,W102
15.06.2026,Future-Dated Fuel Delivery Test,"3000,00",L,diesel,DE02,Procurement,W103`;

const SAMPLE_UTILITY_CSV = `Account Number,Site Name,Site Code,Meter ID,Billing Period Start,Billing Period End,Usage kWh,Tariff,Supplier Ref
UT-998213,Frankfurt Data Center,W102,MTR-8812,2026-01-01,2026-01-31,85230.50,Commercial Green,Vattenfall
UT-998213,Frankfurt Data Center,W102,MTR-8812,2026-02-01,2026-02-28,91200.75,Commercial Green,Vattenfall
UT-554109,Berlin Office HQ,W103,MTR-2041,2026-01-15,2026-02-14,4520.10,Standard Business,E.ON
UT-554109,Berlin Office HQ,W103,MTR-2041,2026-02-15,2026-03-14,-500.00,Standard Business,E.ON`;

const SAMPLE_TRAVEL_CSV = `Trip ID,Employee ID,Department,Departure Date,Return Date,Origin,Destination,Travel Class,Distance KM,Hotel Nights,Hotel City,Taxi KM
TRP-1002,EMP-0249,Sales,2026-02-10,2026-02-15,FRA,JFK,Economy,6200.0,5,New York,45.2
TRP-1003,EMP-1082,Engineering,2026-03-01,2026-03-08,BER,LHR,Economy,950.0,7,London,12.0
TRP-1004,EMP-0077,Management,2026-03-10,2026-03-15,FRA,HND,First,9300.0,5,Tokyo,80.5
TRP-1005,EMP-0077,Management,2026-03-10,2026-03-15,FRA,HND,First,0.0,0,,0.0`;

export default function App() {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(() => !!getStoredToken());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Dashboard & Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState({
    total_records: 0,
    pending_count: 0,
    suspicious_count: 0,
    total_co2e_by_scope: { '1': 0, '2': 0, '3': 0 },
    recent_batches: [],
    co2e_by_month: []
  });
  
  // Uploads state
  const [uploads, setUploads] = useState([]);
  const [uploadSource, setUploadSource] = useState('SAP');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  
  // Review Queue state
  const [records, setRecords] = useState([]);
  const [recordFilter, setRecordFilter] = useState('ALL'); // ALL, PENDING, SUSPICIOUS
  const [scopeFilter, setScopeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  
  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  
  const handleLogout = useCallback(() => {
    setToken('');
    setUser(null);
    clearStoredTokens();
  }, []);

  useEffect(() => {
    const onForcedLogout = () => handleLogout();
    window.addEventListener('auth:logout', onForcedLogout);
    return () => window.removeEventListener('auth:logout', onForcedLogout);
  }, [handleLogout]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetchCurrentUser();
      setUser(res.data);
      return true;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
      } else {
        console.error('Failed to fetch user data:', err);
      }
      return false;
    }
  }, [handleLogout]);

  // Restore session when a token exists but user profile is not loaded yet
  useEffect(() => {
    if (!token) {
      setAuthChecking(false);
      return;
    }
    if (user) {
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setAuthChecking(true);
      await fetchUser();
      if (!cancelled) setAuthChecking(false);
    })();

    return () => { cancelled = true; };
  }, [token, user, fetchUser]);

  // Refetch data depending on active tab
  useEffect(() => {
    if (token && user) {
      if (activeTab === 'dashboard') fetchDashboard();
      if (activeTab === 'ingest') fetchUploads();
      if (activeTab === 'review') fetchRecords();
      if (activeTab === 'audit') fetchAuditLogs();
    }
  }, [activeTab, token, user]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard/');
      setDashboardData(res.data);
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  };

  const fetchUploads = async () => {
    try {
      const res = await api.get('/uploads/');
      setUploads(res.data.results || res.data);
    } catch (err) {
      console.error("Uploads load failed", err);
    }
  };

  const fetchRecords = async () => {
    try {
      let url = '/records/';
      const params = {};
      if (recordFilter === 'PENDING') params.review_status = 'PENDING';
      if (recordFilter === 'SUSPICIOUS') params.is_suspicious = 'true';
      if (scopeFilter) params.scope = scopeFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await api.get(url, { params });
      setRecords(res.data.results || res.data);
    } catch (err) {
      console.error("Records load failed", err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/audit-logs/');
      setAuditLogs(res.data.results || res.data);
    } catch (err) {
      console.error("Audit logs load failed", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await loginRequest(username, password);
      const { access, refresh, user: loggedInUser } = res.data;
      setStoredTokens(access, refresh);
      setToken(access);
      if (loggedInUser) setUser(loggedInUser);
      setActiveTab('dashboard');
    } catch (err) {
      if (!err.response) {
        setLoginError('Backend is starting up (this can take up to 60 seconds on free hosting). Please wait, then click Sign In again.');
      } else {
        const detail = err.response?.data?.detail;
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.non_field_errors?.[0] || 'Invalid username or password.';
        setLoginError(message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAutofill = (role) => {
    setUsername(role);
    setPassword('password123');
  };

  const formatApiError = (err, fallback) => {
    const data = err.response?.data;
    if (!data) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (data.error_message) return data.error_message;
    if (typeof data === 'object') {
      const first = Object.values(data).flat()[0];
      if (typeof first === 'string') return first;
    }
    return fallback;
  };

  const handleUploadResponse = (data, successText) => {
    if (data.status === 'FAILED') {
      setUploadMessage({
        type: 'error',
        text: data.error_message || 'Batch processing failed. Check the CSV format matches the selected source channel.',
      });
      return;
    }
    if (data.total_rows === 0) {
      setUploadMessage({
        type: 'error',
        text: 'No rows could be parsed. Use a CSV with headers matching the selected source (SAP, Utility, or Travel), or try an Instant Review Preset.',
      });
      return;
    }
    setUploadMessage({ type: 'success', text: successText });
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadMessage(null);
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('source_type', uploadSource);
    
    try {
      const res = await api.post('/uploads/', formData);
      handleUploadResponse(res.data, 'Batch uploaded and processed successfully!');
      setUploadFile(null);
      document.getElementById('file-upload-input').value = '';
      fetchUploads();
      fetchDashboard();
    } catch (err) {
      setUploadMessage({ type: 'error', text: formatApiError(err, 'Failed to upload batch.') });
    } finally {
      setUploadLoading(false);
    }
  };

  const injectSampleData = async (sourceType, csvText, filename) => {
    setUploadLoading(true);
    setUploadMessage(null);
    
    const blob = new Blob([csvText], { type: 'text/csv' });
    const file = new File([blob], filename, { type: 'text/csv' });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', sourceType);
    
    try {
      const res = await api.post('/uploads/', formData);
      handleUploadResponse(res.data, `Sample ${sourceType} data injected and parsed successfully!`);
      fetchUploads();
      fetchDashboard();
    } catch (err) {
      setUploadMessage({ type: 'error', text: formatApiError(err, 'Failed to inject sample.') });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleReviewAction = async (actionType) => {
    if (!selectedRecord) return;
    setReviewActionLoading(true);
    try {
      const res = await api.post(`/records/${selectedRecord.id}/review/`, {
        action: actionType,
        comment: reviewComment
      });
      
      // Update local state details panel
      setSelectedRecord(res.data.record);
      setReviewComment('');
      
      // Refresh active view list
      fetchRecords();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to execute review action.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  const selectAndFetchRecordDetail = async (record) => {
    try {
      const res = await api.get(`/records/${record.id}/`);
      setSelectedRecord(res.data);
    } catch (err) {
      console.error("Failed to load record details", err);
    }
  };

  // Convert kg CO2e to Tonnes CO2e with 3 decimal places
  const toTonnes = (kg) => (parseFloat(kg || 0) / 1000).toFixed(3);

  // Styling helper for badges
  const getReviewStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">Rejected</span>;
      case 'FLAGGED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">Flagged</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">Pending Review</span>;
    }
  };

  const getSourceTypeBadge = (source) => {
    switch (source) {
      case 'SAP':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-950 text-blue-400 border border-blue-900">SAP</span>;
      case 'UTILITY':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-950 text-yellow-400 border border-yellow-900">Utility</span>;
      case 'TRAVEL':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-950 text-indigo-400 border border-indigo-900">Travel</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-400">{source}</span>;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'HIGH': return 'text-rose-400 bg-rose-950 border-rose-900';
      case 'MEDIUM': return 'text-amber-400 bg-amber-950 border-amber-900';
      case 'LOW': return 'text-blue-400 bg-blue-950 border-blue-900';
      default: return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  if (token && !user && authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-emerald-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <p className="text-slate-400 text-sm mt-4">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-950/20 blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-950/20 blur-3xl"></div>
        
        <div className="w-full max-w-md glass rounded-2xl border border-slate-800 p-8 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <span className="text-5xl mb-3">🌱</span>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              BreatheESG Platform
            </h1>
            <p className="text-slate-400 text-sm mt-1">Multi-Tenant Ingestion & Auditing Engine</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="e.g. analyst"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {loginError && (
              <div className="p-3 bg-rose-950/50 border border-rose-900 text-rose-200 text-xs rounded-lg flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg shadow-emerald-900/35 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loginLoading ? (<>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Connecting to server...
              </>) : 'Sign In'}
            </button>
          </form>

          {/* Quick login autofills for review ease */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <span className="block text-xs font-semibold text-slate-400 text-center mb-3">Autofill Mock Credentials</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAutofill('admin')}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-medium rounded-lg text-emerald-400 transition-all text-center"
              >
                Admin
              </button>
              <button
                onClick={() => handleAutofill('analyst')}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-medium rounded-lg text-emerald-400 transition-all text-center"
              >
                Analyst
              </button>
              <button
                onClick={() => handleAutofill('viewer')}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-medium rounded-lg text-emerald-400 transition-all text-center"
              >
                Viewer
              </button>
            </div>
            <span className="block text-[10px] text-slate-500 text-center mt-3">All accounts use password: <code className="text-slate-400">password123</code></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="glass border-b border-slate-900 py-4 px-6 flex justify-between items-center sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌱</span>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              BreatheESG <span className="text-xs font-normal py-0.5 px-2 bg-slate-900 text-emerald-400 border border-slate-800 rounded-full">Enterprise</span>
            </h1>
            {user && (
              <p className="text-slate-400 text-xs">Tenant: <span className="font-semibold text-slate-300">{user.organisation_name || 'Breathe ESG Corp'}</span></p>
            )}
          </div>
        </div>

        {/* User Identity & Logout */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-850 rounded-lg">
              <UserIcon className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <p className="text-xs font-bold leading-none">{user.username}</p>
                <p className="text-[10px] text-slate-400 leading-none mt-1 uppercase font-semibold tracking-wider">Role: {user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/80 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      {/* Main body with navigation tabs */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-900 gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'dashboard'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard Insights
          </button>
          <button
            onClick={() => setActiveTab('ingest')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'ingest'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Ingestion Management
          </button>
          <button
            onClick={() => {
              setActiveTab('review');
              setSelectedRecord(null);
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'review'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Review & Audit Queue
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Trails
          </button>
        </div>

        {/* Tab 1: Dashboard Insights */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card glass-card-hover p-5 rounded-xl border border-slate-900">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Carbon Footprint</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-emerald-400">
                    {toTonnes(Object.values(dashboardData.total_co2e_by_scope).reduce((a, b) => a + b, 0))}
                  </span>
                  <span className="text-xs text-slate-400">t CO2e</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">All approved & pending records combined</p>
              </div>

              <div className="glass-card glass-card-hover p-5 rounded-xl border border-slate-900">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Scope 1 (Direct)</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-200">{toTonnes(dashboardData.total_co2e_by_scope['1'])}</span>
                  <span className="text-xs text-slate-400">t CO2e</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Fuel combustion & process emissions</p>
              </div>

              <div className="glass-card glass-card-hover p-5 rounded-xl border border-slate-900">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Scope 2 (Indirect)</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-200">{toTonnes(dashboardData.total_co2e_by_scope['2'])}</span>
                  <span className="text-xs text-slate-400">t CO2e</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Purchased electricity & energy consumption</p>
              </div>

              <div className="glass-card glass-card-hover p-5 rounded-xl border border-slate-900 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Review Workload</span>
                  <div className="flex gap-4 items-center mt-1">
                    <div>
                      <span className="text-2xl font-black text-amber-400">{dashboardData.pending_count}</span>
                      <span className="text-[10px] text-slate-400 block leading-none mt-0.5">Pending</span>
                    </div>
                    <div className="h-8 w-px bg-slate-800"></div>
                    <div>
                      <span className="text-2xl font-black text-rose-500">{dashboardData.suspicious_count}</span>
                      <span className="text-[10px] text-slate-400 block leading-none mt-0.5">Suspicious</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Line Area Chart: Emissions Over Time */}
              <div className="glass-card p-5 rounded-xl border border-slate-900 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Carbon Emission Trend (t CO2e)</h3>
                <div className="h-80">
                  {dashboardData.co2e_by_month?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dashboardData.co2e_by_month.map(item => ({
                          ...item,
                          s1: parseFloat(toTonnes(item.scope1)),
                          s2: parseFloat(toTonnes(item.scope2)),
                          s3: parseFloat(toTonnes(item.scope3))
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorS1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorS2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorS3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                        <Legend />
                        <Area type="monotone" dataKey="s1" name="Scope 1" stroke="#ef4444" fillOpacity={1} fill="url(#colorS1)" />
                        <Area type="monotone" dataKey="s2" name="Scope 2" stroke="#eab308" fillOpacity={1} fill="url(#colorS2)" />
                        <Area type="monotone" dataKey="s3" name="Scope 3" stroke="#6366f1" fillOpacity={1} fill="url(#colorS3)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">No emissions data loaded yet.</div>
                  )}
                </div>
              </div>

              {/* Pie/Donut Chart: Scope Breakdown */}
              <div className="glass-card p-5 rounded-xl border border-slate-900">
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Emissions by Scope</h3>
                <div className="h-80 flex flex-col justify-between">
                  <div className="flex-1 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Scope 1', value: dashboardData.total_co2e_by_scope['1'] || 0, color: '#ef4444' },
                            { name: 'Scope 2', value: dashboardData.total_co2e_by_scope['2'] || 0, color: '#eab308' },
                            { name: 'Scope 3', value: dashboardData.total_co2e_by_scope['3'] || 0, color: '#6366f1' }
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {
                            [
                              { name: 'Scope 1', value: dashboardData.total_co2e_by_scope['1'] || 0, color: '#ef4444' },
                              { name: 'Scope 2', value: dashboardData.total_co2e_by_scope['2'] || 0, color: '#eab308' },
                              { name: 'Scope 3', value: dashboardData.total_co2e_by_scope['3'] || 0, color: '#6366f1' }
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))
                          }
                        </Pie>
                        <Tooltip formatter={(value) => `${toTonnes(value)} t CO2e`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-red-950/20 border border-red-900/40">
                      <span className="block font-bold text-red-400">Scope 1</span>
                      <span>{toTonnes(dashboardData.total_co2e_by_scope['1'])} t</span>
                    </div>
                    <div className="p-2 rounded bg-yellow-950/20 border border-yellow-900/40">
                      <span className="block font-bold text-yellow-400">Scope 2</span>
                      <span>{toTonnes(dashboardData.total_co2e_by_scope['2'])} t</span>
                    </div>
                    <div className="p-2 rounded bg-indigo-950/20 border border-indigo-900/40">
                      <span className="block font-bold text-indigo-400">Scope 3</span>
                      <span>{toTonnes(dashboardData.total_co2e_by_scope['3'])} t</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Batches List */}
            <div className="glass-card p-5 rounded-xl border border-slate-900">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recent Ingestion Batches</h3>
                <button
                  onClick={fetchDashboard}
                  className="p-1 text-slate-400 hover:text-white transition-all"
                  title="Refresh Dashboard"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-2.5">Source Type</th>
                      <th className="py-2.5">File Name</th>
                      <th className="py-2.5">Upload Date</th>
                      <th className="py-2.5 text-center">Status</th>
                      <th className="py-2.5 text-right">Processed Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recent_batches?.length > 0 ? (
                      dashboardData.recent_batches.map(b => (
                        <tr key={b.id} className="border-b border-slate-900/40 hover:bg-slate-900/20">
                          <td className="py-3 font-medium">{getSourceTypeBadge(b.source_type)}</td>
                          <td className="py-3 font-semibold text-slate-200">{b.file_name}</td>
                          <td className="py-3 text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                          <td className="py-3 text-center">
                            {b.status === 'COMPLETED' ? (
                              <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-900">Success</span>
                            ) : b.status === 'FAILED' ? (
                              <span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-900">Failed</span>
                            ) : (
                              <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-900">{b.status}</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-bold text-slate-300">{b.processed_rows} / {b.total_rows}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-slate-500">No batches uploaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Ingestion Management */}
        {activeTab === 'ingest' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Upload file form */}
            <div className="glass-card p-5 rounded-xl border border-slate-900 lg:col-span-1 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Ingest New Data File</h3>
                <p className="text-slate-400 text-xs">Select data source model, attach file, and run standard validation rules.</p>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Source Channel</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={uploadSource}
                    onChange={(e) => setUploadSource(e.target.value)}
                  >
                    <option value="SAP">SAP Fuel & Procurement</option>
                    <option value="UTILITY">Utility Electricity Portal</option>
                    <option value="TRAVEL">Corporate Travel Flights/Hotels</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Select CSV File</label>
                  <input
                    type="file"
                    id="file-upload-input"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-slate-200 hover:file:bg-slate-850 file:cursor-pointer"
                    required
                  />
                </div>

                {uploadMessage && (
                  <div className={`p-3 border rounded-lg text-xs flex gap-2 items-center ${
                    uploadMessage.type === 'success' 
                      ? 'bg-emerald-950/50 border-emerald-900 text-emerald-200' 
                      : 'bg-rose-950/50 border-rose-900 text-rose-200'
                  }`}>
                    {uploadMessage.type === 'success' ? (
                      <CheckCircleIcon className="w-4 h-4 shrink-0" />
                    ) : (
                      <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                    )}
                    <span>{uploadMessage.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold rounded-lg text-white transition-all flex items-center justify-center gap-2"
                >
                  {uploadLoading ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" /> Ingesting & Normalising...
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="w-4 h-4" /> Start Ingestion
                    </>
                  )}
                </button>
              </form>

              {/* Quick Injection Presets */}
              <div className="pt-6 border-t border-slate-900 space-y-3">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Instant Review Presets</span>
                <p className="text-[10px] text-slate-400">Click below to immediately inject real-world formatted files containing validation exceptions:</p>
                <div className="space-y-2">
                  <button
                    onClick={() => injectSampleData('SAP', SAMPLE_SAP_CSV, 'sap_sap_raw_export.csv')}
                    disabled={uploadLoading}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg text-emerald-400 transition-all text-left flex items-center justify-between"
                  >
                    <span>SAP Fuel & Procurement</span>
                    <span className="text-[10px] text-slate-400">German headers, future date</span>
                  </button>
                  <button
                    onClick={() => injectSampleData('UTILITY', SAMPLE_UTILITY_CSV, 'utility_portal_scrape.csv')}
                    disabled={uploadLoading}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg text-emerald-400 transition-all text-left flex items-center justify-between"
                  >
                    <span>Utility Electricity Portal</span>
                    <span className="text-[10px] text-slate-400">Negative value flag</span>
                  </button>
                  <button
                    onClick={() => injectSampleData('TRAVEL', SAMPLE_TRAVEL_CSV, 'travel_concur_export.csv')}
                    disabled={uploadLoading}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg text-emerald-400 transition-all text-left flex items-center justify-between"
                  >
                    <span>Corporate Travel flights</span>
                    <span className="text-[10px] text-slate-400">First-class class, split records</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: List of uploads */}
            <div className="glass-card p-5 rounded-xl border border-slate-900 lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Ingestion Log & Batch Run Status</h3>
                <button
                  onClick={fetchUploads}
                  className="p-1 text-slate-400 hover:text-white transition-all"
                  title="Refresh Uploads list"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {uploads.length > 0 ? (
                  uploads.map((b) => (
                    <div key={b.id} className="p-4 bg-slate-900/40 rounded-xl border border-slate-900/60 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          {getSourceTypeBadge(b.source_type)}
                          <span className="font-semibold text-sm text-slate-200">{b.file_name}</span>
                        </div>
                        {b.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900">COMPLETED</span>
                        ) : b.status === 'FAILED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-900">FAILED</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-900">{b.status}</span>
                        )}
                      </div>
                      
                      {b.error_message && (
                        <div className="p-2 bg-rose-950/20 border border-rose-900/50 rounded text-xs text-rose-300">
                          {b.error_message}
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2 text-center bg-slate-950/40 py-2 rounded-lg text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total Rows</span>
                          <span className="font-bold text-slate-200">{b.total_rows}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block text-emerald-400">Processed</span>
                          <span className="font-bold text-emerald-400">{b.processed_rows}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block text-rose-400 font-semibold">Failed</span>
                          <span className="font-bold text-rose-400">{b.failed_rows}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Uploader</span>
                          <span className="font-bold text-slate-300 truncate max-w-[80px] block mx-auto">{b.uploaded_by_email || 'System'}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>ID: <code className="text-slate-400">{b.id}</code></span>
                        <span>{new Date(b.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">No batch runs recorded yet. Upload a CSV to kick off the pipeline.</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Review Queue */}
        {activeTab === 'review' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Middle: Filter and Records Table */}
            <div className="glass-card p-5 rounded-xl border border-slate-900 lg:col-span-2 space-y-4 flex flex-col h-[650px]">
              
              {/* Header and filters */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Auditing Review Queue</h3>
                
                {/* Status selector */}
                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
                  <button
                    onClick={() => setRecordFilter('ALL')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${recordFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setRecordFilter('PENDING')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${recordFilter === 'PENDING' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setRecordFilter('SUSPICIOUS')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${recordFilter === 'SUSPICIOUS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Suspicious
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Search description or source ref..."
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <select
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                >
                  <option value="">All Scopes</option>
                  <option value="1">Scope 1 (Direct)</option>
                  <option value="2">Scope 2 (Indirect)</option>
                  <option value="3">Scope 3 (Value Chain)</option>
                </select>

                <button
                  onClick={fetchRecords}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" /> Apply Filters
                </button>
              </div>

              {/* Records List Table */}
              <div className="flex-1 overflow-y-auto border border-slate-900 rounded-lg pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-400 bg-slate-900/30 sticky top-0 uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-center">Scope</th>
                      <th className="py-2.5 px-3 text-right">CO2e</th>
                      <th className="py-2.5 px-3 text-center">Flags</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length > 0 ? (
                      records.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => selectAndFetchRecordDetail(r)}
                          className={`border-b border-slate-900/40 hover:bg-slate-900/30 cursor-pointer transition-all ${
                            selectedRecord?.id === r.id ? 'bg-slate-900/80 border-l-2 border-l-emerald-500' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-200 line-clamp-1">{r.activity_description}</p>
                            <span className="text-[10px] text-slate-500 font-mono">{getSourceTypeBadge(r.source_type)} • {new Date(r.created_at).toLocaleDateString()}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 font-bold border border-slate-800">S{r.scope}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-300">
                            {r.normalised_qty_kg_co2e ? `${parseFloat(r.normalised_qty_kg_co2e).toLocaleString()} kg` : 'Error'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.is_suspicious ? (
                              <span className="px-1.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-900 rounded font-bold text-[9px] animate-pulse">Suspicious</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {getReviewStatusBadge(r.review_status)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">No records found matching filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Record detail & audit review tools */}
            <div className="glass-card p-5 rounded-xl border border-slate-900 lg:col-span-1 h-[650px] flex flex-col">
              {selectedRecord ? (
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                  
                  {/* Title & Status */}
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auditing Detail View</span>
                      {getReviewStatusBadge(selectedRecord.review_status)}
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-100 leading-snug">{selectedRecord.activity_description}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">Record ID: {selectedRecord.id}</p>
                  </div>

                  <div className="h-px bg-slate-900"></div>

                  {/* Calculations breakdown */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Pipeline Calculations</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Raw Value</span>
                        <span className="font-bold text-slate-200 text-xs">
                          {selectedRecord.quantity} <code className="text-slate-400">{selectedRecord.raw_unit}</code>
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Normalised</span>
                        <span className="font-black text-emerald-400 text-xs">
                          {selectedRecord.normalised_qty_kg_co2e ? `${selectedRecord.normalised_qty_kg_co2e} kg_CO2e` : 'Fail'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-slate-400">Emission Factor:</span> <span className="font-mono">{selectedRecord.emission_factor || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Source Channel:</span> <span className="font-bold text-slate-300">{selectedRecord.source_type}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Audit Lock:</span> <span className="font-semibold text-slate-300">{selectedRecord.is_locked ? '🔒 Locked (Immutable)' : '🔓 Unlocked (Reviewable)'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Activity Period:</span> <span className="text-slate-300">{selectedRecord.period_start} to {selectedRecord.period_end}</span></div>
                    </div>
                  </div>

                  {/* Classification details */}
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Classification Heuristic</span>
                    <div className="flex justify-between"><span className="text-slate-400">GHG Protocol Scope:</span> <span className="font-bold text-slate-200">Scope {selectedRecord.scope}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Fuel Override:</span> <span className="text-slate-300">{selectedRecord.fuel_type || 'None'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Travel Class:</span> <span className="text-slate-300">{selectedRecord.travel_class || 'None'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Plant Code / GL:</span> <span className="font-mono text-slate-300">{selectedRecord.plant_code || 'None'}</span></div>
                  </div>

                  {/* Validation Flags (Rule Exceptions) */}
                  {selectedRecord.is_suspicious && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Anomaly Flags ({selectedRecord.suspicious_reasons.length})</span>
                      <div className="space-y-2">
                        {selectedRecord.suspicious_reasons.map((rule, idx) => (
                          <div key={idx} className={`p-3 border rounded-lg text-xs space-y-1 ${getSeverityColor(rule.severity)}`}>
                            <div className="flex justify-between font-bold">
                              <span>{rule.rule_name}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded border">{rule.severity}</span>
                            </div>
                            <p className="text-[11px] leading-tight opacity-90">{rule.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Comments History */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Audit Trail & Comments</span>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {selectedRecord.review_actions?.length > 0 ? (
                        selectedRecord.review_actions.map((act) => (
                          <div key={act.id} className="p-2 bg-slate-900/50 border border-slate-900 rounded text-[11px]">
                            <div className="flex justify-between text-slate-400 font-semibold mb-1">
                              <span>{act.actor_email}</span>
                              <span className="text-[9px] uppercase px-1 bg-slate-850 rounded">{act.action}</span>
                            </div>
                            {act.comment && <p className="text-slate-200 italic">"{act.comment}"</p>}
                            <span className="text-[9px] text-slate-500">{new Date(act.created_at).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No review actions recorded yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Review inputs (restricted to analyst/admin) */}
                  <div className="pt-2 border-t border-slate-900 space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Record Review Panel</span>
                    
                    {selectedRecord.is_locked ? (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg text-center text-xs text-emerald-400 font-semibold">
                        🔒 This record has been APPROVED and locked for auditing. It cannot be edited or reviewed further.
                      </div>
                    ) : user && (user.role === 'admin' || user.role === 'analyst') ? (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Add auditor / review justification comment..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleReviewAction('APPROVE')}
                            disabled={reviewActionLoading}
                            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1"
                          >
                            <CheckIcon className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleReviewAction('REJECT')}
                            disabled={reviewActionLoading}
                            className="py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1"
                          >
                            <XCircleIcon className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button
                            onClick={() => handleReviewAction('FLAG')}
                            disabled={reviewActionLoading}
                            className="py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1"
                          >
                            <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Flag
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-center text-xs text-slate-400 italic">
                        👁️ Read-only: Review actions are restricted to Analysts and Admins.
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm text-center p-6">
                  <DocumentTextIcon className="w-12 h-12 text-slate-700 mb-2" />
                  <span>Select a record from the review list to inspect calculation parameters, validation flags, and perform auditor review.</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 4: Audit Trails */}
        {activeTab === 'audit' && (
          <div className="glass-card p-5 rounded-xl border border-slate-900 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Immutability Audit Log Console</h3>
              <button
                onClick={fetchAuditLogs}
                className="p-1 text-slate-400 hover:text-white transition-all"
                title="Refresh Audit logs"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5">Actor</th>
                    <th className="py-2.5">Entity</th>
                    <th className="py-2.5">Action Logged</th>
                    <th className="py-2.5">Changes Diff Summary</th>
                    <th className="py-2.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-900/40 hover:bg-slate-900/20 text-[11px]">
                        <td className="py-3 font-semibold text-slate-200">{log.actor_email || 'System Execution'}</td>
                        <td className="py-3 text-slate-300 font-mono">{log.entity_type} ({log.entity_id.split('-')[0]}...)</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 max-w-[320px]">
                          <div className="text-slate-400 leading-tight">
                            {Object.entries(log.diff || {}).map(([key, val]) => (
                              <div key={key}>
                                <span className="font-semibold text-slate-300">{key}</span>:{' '}
                                {typeof val === 'object' && val.old !== undefined ? (
                                  <span>{JSON.stringify(val.old)} → <strong className="text-slate-200">{JSON.stringify(val.new)}</strong></span>
                                ) : (
                                  <span>{JSON.stringify(val)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 text-right text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">No audit trail logs recorded yet. Perform upload/review actions to write immutable logs.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 BreatheESG Carbon Ingestion Platform prototype. Designed for intern technical assessment.</p>
      </footer>
    </div>
  );
}
