import React, { useState, useEffect } from "react";
import ClientHeader from "./ClientHeader";
export default function DataExport() {
  const [campaignId, setCampaignId] = useState(null); // You can make this dynamic
  const [exportOptions, setExportOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
const [clientName, setClientName] = useState("");
const [showClientHeader, setShowClientHeader] = useState(false);

  // Filter states
  const [exportType, setExportType] = useState("all");
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectedDispositions, setSelectedDispositions] = useState([]);
  const [startDate, setStartDate] = useState("2024-01-01");

  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endTime, setEndTime] = useState("17:00");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("campaign_id");

    if (id) {
      setCampaignId(id);
    } else {
      window.location.href = "/client-landing";
    }
  }, []);
  useEffect(() => {
  const fromRecordings = sessionStorage.getItem("from_recordings");

  if (fromRecordings === "true") {
    setShowClientHeader(true);
    sessionStorage.removeItem("from_recordings"); // prevent reuse
  }
}, []);


  // Fetch export options on mount
  useEffect(() => {
    if (campaignId) {
      fetchExportOptions();
    }
  }, [campaignId]);

  const fetchExportOptions = async () => {
    try {
      if (!campaignId) return;

      setLoading(true);

      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");

      if (!token) {
        throw new Error("No authentication token found");
      }
          const url = `https://api.xlitecore.xdialnetworks.com/api/v1/export/${campaignId}/options`;


      const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "text/csv",
  },
});

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok) {
        throw new Error("Failed to fetch export options");
      }

      const data = await response.json();
      setExportOptions(data);

      setSelectedLists(data.list_ids || []);
      setSelectedDispositions(data.all_categories?.map((c) => c.name) || []);
    } catch (err) {
      console.error("Error fetching export options:", err.message);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } finally {
      setLoading(false);
    }
  };
const fetchClientName = async () => {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  if (!token || !campaignId) return;

  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(
    `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${today}&page=1&page_size=1`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.ok) {
    const data = await res.json();
    setClientName(data.client_name || "Client");
  }
};

useEffect(() => {
  if (campaignId) fetchClientName();
}, [campaignId]);

 const handleExport = async () => {
  try {
    setExporting(true);

    const token =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    const payload = {
      // ✅ IMPORTANT: Empty array means "ALL"
      list_ids:
        selectedLists.length === exportOptions.list_ids.length
          ? []
          : selectedLists.map(String),

      categories:
        selectedDispositions.length === exportOptions.all_categories.length
          ? []
          : selectedDispositions,

      start_date: `${startDate}T${startTime}:00`,
      end_date: `${endDate}T${endTime}:00`,
    };

    console.group("📤 EXPORT REQUEST");
    console.log("URL:", `https://api.xlitecore.xdialnetworks.com/api/v1/export/${campaignId}/download`);
    console.log("Payload:", payload);
    console.groupEnd();

    const response = await fetch(
      `https://api.xlitecore.xdialnetworks.com/api/v1/export/${campaignId}/download`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/csv",
        },
        body: JSON.stringify(payload),
      }
    );

    console.group("📥 EXPORT RESPONSE");
    console.log("Status:", response.status);
    console.log("Headers:", [...response.headers.entries()]);
    console.groupEnd();

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ BACKEND ERROR:", errText);
      throw new Error(`Export failed with status ${response.status}`);
    }

    const csvText = await response.text();

    console.group("📄 CSV DEBUG");
    console.log("Length:", csvText.length);
    console.log("Preview:", csvText.slice(0, 500));
    console.groupEnd();

    if (csvText.trim().split("\n").length <= 1) {
      console.warn("⚠️ CSV contains headers only (no matching records)");
    }

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${campaignId}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("❌ EXPORT ERROR:", err);
    alert("Export failed. Check console logs.");
  } finally {
    setExporting(false);
  }
};

  const toggleList = (listId) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  };

  const toggleDisposition = (disposition) => {
    setSelectedDispositions((prev) =>
      prev.includes(disposition)
        ? prev.filter((d) => d !== disposition)
        : [...prev, disposition]
    );
  };

  const selectAllLists = () => {
    if (exportOptions?.list_ids) {
      setSelectedLists(exportOptions.list_ids);
    }
  };

  const selectAllDispositions = () => {
    if (exportOptions?.all_categories) {
      setSelectedDispositions(exportOptions.all_categories.map((c) => c.name));
    }
  };

  const resetFilters = () => {
    setExportType("all");
    setSelectedLists(exportOptions?.list_ids?.slice(0, 3) || []);
    setSelectedDispositions(
      exportOptions?.all_categories?.slice(0, 3).map((c) => c.name) || []
    );
    setStartDate("2024-12-01");
    setStartTime("09:00");
    setEndDate("2024-12-06");
    setEndTime("17:00");
  };

  const getDispositionIcon = (name) => {
    const icons = {
      "Answering machine": {
        color: "text-blue-500",
        path: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
      },
      Qualified: {
        color: "text-green-500",
        path: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
      },
      "Not interested": { color: "text-red-500", path: "M6 18L18 6M6 6l12 12" },
      "Do not call": {
        color: "text-pink-500",
        path: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
      },
      "Do not qualify": {
        color: "text-yellow-500",
        path: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      },
      Unknown: {
        color: "text-gray-500",
        path: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      Honeypot: {
        color: "text-purple-500",
        path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      },
      Neutral: { color: "text-gray-400", element: "circle" },
    };

    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(icons)) {
      if (lowerName.includes(key.toLowerCase())) {
        return value;
      }
    }
    return { color: "text-gray-500", path: "M20 12H4" };
  };

  const calculateEstimatedSize = () => {
    const recordCount = selectedDispositions.reduce((sum, disp) => {
      const category = exportOptions?.all_categories?.find(
        (c) => c.name === disp
      );
      return sum + (category?.count || 0);
    }, 0);
    const sizeInKB = recordCount * 0.5; // Rough estimate
    return sizeInKB > 1024
      ? `${(sizeInKB / 1024).toFixed(1)} MB`
      : `${sizeInKB.toFixed(0)} KB`;
  };

  const getTotalRecords = () => {
    return selectedDispositions.reduce((sum, disp) => {
      const category = exportOptions?.all_categories?.find(
        (c) => c.name === disp
      );
      return sum + (category?.count || 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div
          className="spinner"
          style={{ width: "2rem", height: "2rem", borderWidth: "3px" }}
        ></div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#f9fafb",
        color: "#111827",
        lineHeight: "1.5",
        minHeight: "100vh",
      }}
    >
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body{zoom: 0.9;}
        .header { background-color: white; border-bottom: 1px solid #e5e7eb; padding: 1rem 1.5rem; }
        .header-content { display: flex; align-items: center; justify-content: space-between; max-width: 1280px; margin: 0 auto; }
        .header-left { display: flex; align-items: center; gap: 0.75rem; }
        .header-icon { width: 1.5rem; height: 1.5rem; color: #3b82f6; }
        .header-title-group { display: flex; align-items: center; gap: 0.75rem; }
        .welcome-text { font-size: 1.125rem; font-weight: 500; color: #3b82f6; margin-top: 0.25rem; }
        .header-badge { background-color: #3b82f6; color: white; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem; }
        .header-right { display: flex; align-items: center; gap: 0.75rem; }
        .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-primary { background-color: #3b82f6; color: white; }
        .btn-primary:hover { background-color: #2563eb; }
        .btn-outline { background-color: white; color: #374151; border: 1px solid #d1d5db; }
        .btn-outline:hover { background-color: #f9fafb; }
        .btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn svg { width: 1rem; height: 1rem; }
        .main-content { max-width: 1280px; margin: 0 auto; padding: 2rem 1rem; }
        .page-header { margin-bottom: 1.5rem; }
        .page-title { display: flex; align-items: center; gap: 0.75rem; font-size: 1.875rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
        .page-title svg { width: 2rem; height: 2rem; color: #3b82f6; }
        .page-subtitle { color: #6b7280; margin-top: 0.5rem; }
        .grid { display: grid; gap: 1.5rem; }
        .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
        .col-span-2 { grid-column: span 2; }
        .card { background-color: white; border-radius: 0.75rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden; }
        .card-header { padding: 1.5rem; border-bottom: 1px solid #f3f4f6; }
        .card-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1.125rem; font-weight: 600; color: #111827; }
        .card-title svg { width: 1.25rem; height: 1.25rem; }
        .card-content { padding: 1.5rem; }
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem; }
        .form-input, .form-select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; color: #111827; background-color: white; transition: all 0.2s; }
        .form-input:focus, .form-select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .checkbox-group { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; max-height: 15rem; overflow-y: auto; }
        .checkbox-group-3col { grid-template-columns: repeat(3, 1fr); }
        .checkbox-item { display: flex; align-items: center; gap: 0.5rem; }
        .checkbox { width: 1rem; height: 1rem; border: 1px solid #d1d5db; border-radius: 0.25rem; cursor: pointer; }
        .checkbox:checked { background-color: #3b82f6; border-color: #3b82f6; }
        .checkbox-label { font-size: 0.875rem; font-weight: 500; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; flex: 1; }
        .badge { display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; }
        .badge-outline { border: 1px solid #d1d5db; background-color: white; color: #374151; }
        .summary-row { display: flex; justify-content: space-between; padding: 0.5rem 0; }
        .summary-label { font-size: 0.875rem; color: #6b7280; }
        .summary-value { font-weight: 500; color: #111827; }
        .badge-group { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem; }
        .icon-sm { width: 1rem; height: 1rem; }
        .text-blue-500 { color: #3b82f6; }
        .text-green-500 { color: #10b981; }
        .text-red-500 { color: #ef4444; }
        .text-pink-500 { color: #ec4899; }
        .text-yellow-500 { color: #eab308; }
        .text-gray-500 { color: #6b7280; }
        .text-purple-500 { color: #a855f7; }
        .text-gray-400 { color: #9ca3af; }
        .spinner { width: 1rem; height: 1rem; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .info-card { background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; font-size: 0.875rem; color: #6b7280; }
        .info-card p { margin-bottom: 0.5rem; }
        .info-card p:last-child { margin-bottom: 0; }
        .grid-cols-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .flex-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        @media (max-width: 1024px) {
          .grid-cols-3 { grid-template-columns: 1fr; }
          .col-span-2 { grid-column: span 1; }
          .checkbox-group-3col { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .checkbox-group, .checkbox-group-3col { grid-template-columns: 1fr; }
          .header-content { flex-direction: column; gap: 1rem; align-items: flex-start; }
          .header-right { width: 100%; flex-direction: column; }
          .btn { width: 100%; justify-content: center; }
          .grid-cols-4 { grid-template-columns: 1fr; }
        }
      `}</style>
{showClientHeader && (
  <ClientHeader
    clientName={clientName}
    campaignId={campaignId}
    activePage="data-export"
  />
)}



      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Data Export
          </h1>
          <p className="page-subtitle">
            Export call data in CSV format with advanced filtering options
          </p>
        </div>

        <div className="grid grid-cols-3">
          {/* Filters Panel */}
          <div className="col-span-2 space-y-6">
            {/* Export Type Selection */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  Export Type
                </h2>
              </div>
              <div className="card-content">
                <select
                  className="form-select"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                >
                  <option value="all">Export All Data</option>
                  <option value="by-list">Filter by List ID</option>
                  <option value="by-date">Filter by Date Range</option>
                  <option value="by-disposition">Filter by Disposition</option>
                </select>
              </div>
            </div>

            {/* List ID Filter */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  List ID Selection
                </h2>
              </div>
              <div className="card-content">
                <div className="flex-between">
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Select List IDs to export:
                  </label>
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.875rem",
                    }}
                    onClick={selectAllLists}
                  >
                    Select All ({exportOptions?.list_ids?.length || 0})
                  </button>
                </div>

                <div className="checkbox-group">
                  {exportOptions?.list_ids?.map((listId) => (
                    <div key={listId} className="checkbox-item">
                      <input
                        type="checkbox"
                        className="checkbox"
                        id={`list-${listId}`}
                        checked={selectedLists.includes(listId)}
                        onChange={() => toggleList(listId)}
                      />
                      <label
                        htmlFor={`list-${listId}`}
                        className="checkbox-label"
                      >
                        LIST-{listId}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Date Range Selection
                </h2>
              </div>
              <div className="card-content">
                <div className="grid-cols-4">
                  <div className="form-group">
                    <label className="form-label" htmlFor="start-date">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      id="start-date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="start-time">
                      Start Time
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      id="start-time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="end-date">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      id="end-date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="end-time">
                      End Time
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      id="end-time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Disposition Filter */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Disposition Selection
                </h2>
              </div>
              <div className="card-content">
                <div className="flex-between">
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Select dispositions to export:
                  </label>
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.875rem",
                    }}
                    onClick={selectAllDispositions}
                  >
                    Select All ({exportOptions?.all_categories?.length || 0})
                  </button>
                </div>

                <div className="checkbox-group checkbox-group-3col">
                  {exportOptions?.all_categories?.map((category) => {
                    const icon = getDispositionIcon(category.name);
                    return (
                      <div key={category.name} className="checkbox-item">
                        <input
                          type="checkbox"
                          className="checkbox"
                          id={`disp-${category.name}`}
                          checked={selectedDispositions.includes(category.name)}
                          onChange={() => toggleDisposition(category.name)}
                        />
                        <label
                          htmlFor={`disp-${category.name}`}
                          className="checkbox-label"
                        >
                          <svg
                            className={`icon-sm ${icon.color}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            {icon.element === "circle" ? (
                              <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d={icon.path}
                              />
                            )}
                          </svg>
                          {category.combined_name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Export Summary Panel */}
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Export Summary
                </h2>
              </div>
              <div className="card-content space-y-4">
                <div>
                  <div className="summary-row">
                    <span className="summary-label">Total Records:</span>
                    <span className="summary-value">
                      {getTotalRecords().toLocaleString()}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Estimated Size:</span>
                    <span className="summary-value">
                      {calculateEstimatedSize()}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="summary-label">Selected List IDs:</span>
                  <div className="badge-group">
                    {selectedLists.slice(0, 3).map((listId) => (
                      <span key={listId} className="badge badge-outline">
                        LIST-{listId}
                      </span>
                    ))}
                    {selectedLists.length > 3 && (
                      <span className="badge badge-outline">
                        +{selectedLists.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="summary-label">Selected Dispositions:</span>
                  <div className="badge-group">
                    {selectedDispositions.slice(0, 2).map((disp) => {
                      const category = exportOptions?.all_categories?.find(
                        (c) => c.name === disp
                      );
                      return (
                        <span key={disp} className="badge badge-outline">
                          {category?.combined_name || disp}
                        </span>
                      );
                    })}
                    {selectedDispositions.length > 2 && (
                      <span className="badge badge-outline">
                        +{selectedDispositions.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="summary-label">Date Range:</span>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      marginTop: "0.25rem",
                      color: "#374151",
                    }}
                  >
                    {startDate} to {endDate}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Card */}
            <div className="card">
              <div
                className="card-content space-y-4"
                style={{ paddingTop: "1.5rem" }}
              >
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%" }}
                  onClick={handleExport}
                  disabled={exporting || selectedDispositions.length === 0}
                >
                  {exporting ? (
                    <>
                      <div className="spinner"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Export to CSV
                    </>
                  )}
                </button>

                <button
                  className="btn btn-outline"
                  style={{ width: "100%" }}
                  onClick={resetFilters}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Help Information Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ fontSize: "0.875rem" }}>
                  Export Information
                </h2>
              </div>
              <div className="card-content info-card">
                <p>
                  • CSV files include all call details: ID, phone number, List
                  ID, disposition, timestamp, and recording URL
                </p>
                <p>• Large exports may take a few moments to generate</p>
                <p>• Files are automatically named with the current date</p>
                <p>• Only your call data will be exported</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
