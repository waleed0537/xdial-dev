import React, { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import api from "./api";
import DataExport from "./DataExport";
const getUserRole = () => {
  return localStorage.getItem("role") || sessionStorage.getItem("role");
};
const MedicareDashboard = () => {
  const [currentView, setCurrentView] = useState("dashboard");
  const [showSummaryGraph, setShowSummaryGraph] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [selectedOutcomes, setSelectedOutcomes] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [listId, setListId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeRange, setTimeRange] = useState("Last 5 Minutes");
  const [campaignId, setCampaignId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState("id"); // Default sort by ID
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' or 'desc'
  const [fetchTrigger, setFetchTrigger] = useState(0); // Trigger for manual data fetching

  // Modal states
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedCallRecord, setSelectedCallRecord] = useState(null);

  // KEY FIX: Get campaign ID and force reload on mount
  // Get campaign ID on mount - don't auto-load data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("campaign_id");
    if (id) {
      setCampaignId(id);
      setCurrentView("dashboard");
      // Set today's date as default
      setStartDate(new Date().toISOString().split("T")[0]);
    } else {
      window.location.href = "/client-landing";
    }
  }, []); // Only run once on mount
  useEffect(() => {
  if (currentView === "data-export" && getUserRole() === "client_member") {
    setCurrentView("dashboard"); // Redirect to dashboard if they try to access
  }
}, [currentView]);
  const parseTimestamp = (timestamp) => {
    try {
      if (!timestamp) return null;

      // Handle format: "12/15/2025, 18:08:24"
      if (timestamp.includes(",")) {
        const [datePart, timePart] = timestamp.split(", ");
        const [month, day, year] = datePart.split("/");
        const [hours, minutes, seconds] = timePart.split(":");

        // Create date object (EST is UTC-5, but we'll treat input as local EST time)
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds || 0)
        );

        return isNaN(date.getTime()) ? null : date;
      }

      // Fallback for other formats
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    } catch (e) {
      console.error("Error parsing timestamp:", timestamp, e);
      return null;
    }
  };
  // Add this helper function after parseTimestamp
  const parseUserInputDate = (dateStr, timeStr = "") => {
    try {
      if (!dateStr) return null;

      // dateStr format: "2025-12-15"
      // timeStr format: "14:30" or ""
      const [year, month, day] = dateStr.split("-");
      let hours = 0,
        minutes = 0,
        seconds = 0;

      if (timeStr) {
        [hours, minutes] = timeStr.split(":").map((n) => parseInt(n));
      }

      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        hours,
        minutes,
        seconds
      );

      return isNaN(date.getTime()) ? null : date;
    } catch (e) {
      return null;
    }
  };

  // Function to format date for comparison and display
  // Update formatDateForComparison function (around line 492)
  const formatDateForComparison = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Function to get minutes from start of day
  const getMinutesFromStartOfDay = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return hours * 60 + minutes;
  };

  // Fetch dashboard data from API
  // ClientDashboard.jsx - Update fetchData useEffect to fetch all pages
  // Fetch dashboard data from API
  // ClientDashboard.jsx - Update fetchData useEffect to fetch all pages
  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId || !startDate) return; // Don't fetch without campaign ID and start date

      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          throw new Error("No authentication token found. Please login again.");
        }

        // First, fetch the first page to get total pages info
        let apiUrl = `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${startDate}`;
        if (endDate && endDate !== startDate) {
          apiUrl += `&end_date=${endDate}`;
        }
        apiUrl += `&page=1&page_size=25`;

        const firstPageRes = await fetch(apiUrl, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (firstPageRes.status === 401) {
          throw new Error("Session expired. Please login again.");
        }

        if (!firstPageRes.ok) throw new Error("Failed to fetch dashboard data");

        const firstPageData = await firstPageRes.json();
        const totalPages = firstPageData.pagination?.total_pages || 1;

        // If there's only one page, use it directly
        if (totalPages === 1) {
          setDashboardData(firstPageData);
          setLoading(false);
          return;
        }

        // Fetch all remaining pages in parallel
        const pagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          let pageUrl = `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${startDate}`;
          if (endDate && endDate !== startDate) {
            pageUrl += `&end_date=${endDate}`;
          }
          pageUrl += `&page=${page}&page_size=25`;

          pagePromises.push(
            fetch(pageUrl, {
              headers: {
                accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
            }).then((res) => res.json())
          );
        }

        const additionalPages = await Promise.all(pagePromises);

        // Combine all calls from all pages
        const allCalls = [
          ...firstPageData.calls,
          ...additionalPages.flatMap((pageData) => pageData.calls || []),
        ];

        // Create combined data object
        const combinedData = {
          ...firstPageData,
          calls: allCalls,
          pagination: {
            ...firstPageData.pagination,
            total_records: allCalls.length,
            current_page: 1,
            total_pages: 1,
          },
        };

        setDashboardData(combinedData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);

        if (err.message.includes("login")) {
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
        }
      }
    };

    // Only fetch if fetchTrigger > 0 (meaning Apply Filters was clicked)
    if (fetchTrigger > 0) {
      fetchData();
    }
  }, [campaignId, fetchTrigger, endDate]);
  // Reset to page 1 when filters change

  const summaryChartRef = useRef(null);
  const mainChartRef = useRef(null);
  const summaryChartInstance = useRef(null);
  const mainChartInstance = useRef(null);

  const styles = {
    body: {
      margin: 0,
      padding: 0,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      backgroundColor: "#f5f5f5",
      color: "#333",
      zoom: "0.9",
    },
    header: {
      backgroundColor: "#fff",
      borderBottom: "1px solid #e5e5e5",
      padding: "12px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
    },
    welcomeText: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      color: "#1a73e8",
    },
    badge: {
      backgroundColor: "#1a73e8",
      color: "white",
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "13px",
      fontWeight: 500,
    },
    clientBadge: {
      backgroundColor: "#e8f5e9",
      color: "#2e7d32",
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "13px",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    headerRight: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
    },
    btn: {
      padding: "8px 16px",
      borderRadius: "4px",
      border: "1px solid #e5e5e5",
      backgroundColor: "white",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    btnPrimary: {
      backgroundColor: "#1a73e8",
      color: "white",
      border: "none",
    },
    container: {
      maxWidth: "1400px",
      margin: "0 auto",
      padding: "24px",
    },
    section: {
      backgroundColor: "white",
      borderRadius: "8px",
      padding: "24px",
      marginBottom: "24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    sectionTitle: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "16px",
      fontWeight: 600,
      marginBottom: "8px",
    },
    timezoneNote: {
      fontSize: "12px",
      color: "#666",
      marginBottom: "20px",
    },
    searchRow: {
      display: "flex",
      gap: "12px",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    searchInput: {
      flex: 1,
      minWidth: "200px",
      padding: "10px 12px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "14px",
    },
    datetimeRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "12px",
      marginBottom: "20px",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    inputLabel: {
      fontSize: "13px",
      fontWeight: 500,
      color: "#333",
    },
    input: {
      padding: "10px 12px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "14px",
    },
    outcomesGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "12px",
    },
    outcomeItem: {
      cursor: "pointer",
      transition: "all 0.2s ease",
      padding: "8px 10px",
      borderRadius: "6px",
      border: "2px solid #f0f0f0",
      backgroundColor: "#fff",
      height: "46px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    progressBar: {
      height: "4px",
      backgroundColor: "#e9ecef",
      borderRadius: "999px",
      overflow: "hidden",
      flex: 1,
    },
    callSummarySection: {
      backgroundColor: "white",
      borderRadius: "8px",
      padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    callLineChart: {
      marginTop: "10px",
      padding: "12px 14px 10px",
      borderRadius: "10px",
      background:
        "radial-gradient(circle at top left, #f5f8ff 0%, #ffffff 40%)",
      border: "1px solid #edf2ff",
      height: "280px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      overflowX: "auto",
      display: "block",
    },
  };

  // Category mapping and allowed categories
  const CATEGORY_MAP = {
    Unknown: "Unclear Response",
    Rebuttal: "Not Interested",
    Busy: "Not Interested",
    "Already Customer": "Not Interested",
    "Spanish Answer Machine": "Answering Machine",
    "Repeat Pitch": "Not Interested",
    DNQ: "Do Not Qualify",
    "Do not qualify": "Do Not Qualify",
    "Do Not Qualify": "Do Not Qualify",
  };

  const ALLOWED_CATEGORIES = [
    "Qualified",
    "Neutral",
    "Unclear Response",
    "Inaudible",
    "Answering Machine",
    "DAIR",
    "Honeypot",
    "DNC",
    "Do Not Qualify",
    "Not Interested",
    "User Silent",
    "User Hang Up",
  ];

  // Helper: get color for a category from all_categories
  const getCategoryColor = (category) => {
    const mapped = CATEGORY_MAP[category] || category;
    const cat = dashboardData?.all_categories?.find(
      (c) => c.name === mapped || c.original_name === mapped
    );
    return cat ? cat.color : "#818589";
  };

  // Use API data for call records, map categories, and filter allowed
  const callRecords = Array.isArray(dashboardData?.calls)
    ? dashboardData.calls.map((call) => {
        let mappedCategory = CATEGORY_MAP[call.category] || call.category;
        if (!ALLOWED_CATEGORIES.includes(mappedCategory)) {
          mappedCategory = "User Hang Up";
        }
        return {
          id: call.id,
          phone: call.number,
          listId: call.list_id,
          category: mappedCategory,
          categoryColor: getCategoryColor(mappedCategory),
          timestamp: call.timestamp,
          transcript: call.transcription,
        };
      })
    : [];

  const OUTCOME_ICON_MAP = {
    Qualified: "bi-star-fill",
    Neutral: "bi-circle-fill",
    "Unclear Response": "bi-question-circle-fill",
    Inaudible: "bi-volume-mute-fill",
    "Answering Machine": "bi-phone-fill",
    DAIR: "bi-info-circle-fill",
    Honeypot: "bi-shield-fill",
    DNC: "bi-telephone-x-fill",
    "Do Not Qualify": "bi-exclamation-circle-fill",
    "Not Interested": "bi-x-circle-fill",
    "User Silent": "bi-mic-mute-fill",
    "User Hang Up": "bi-telephone-minus-fill",
  };

  const VIBRANT_COLORS = {
    Qualified: "#66bb6a",
    Neutral: "#9e9e9e",
    "Unclear Response": "#f06292",
    Inaudible: "#ef5350",
    "Answering Machine": "#26c6da",
    DAIR: "#42a5f5",
    Honeypot: "#ffa726",
    DNC: "#ffca28",
    "Do Not Qualify": "#ffca28",
    "Not Interested": "#ef5350",
    "User Silent": "#ab47bc",
    "User Hang Up": "#ef5350",
  };

  // Filtered call records based on all filters
  const filteredCallRecords = callRecords
    .filter((record) => {
      // Filter by selected outcomes
      if (
        selectedOutcomes.length > 0 &&
        !selectedOutcomes.includes(record.category)
      ) {
        return false;
      }

      // Filter by search text (phone number or category)
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const phoneMatch = record.phone.toLowerCase().includes(searchLower);
        const categoryMatch = record.category
          .toLowerCase()
          .includes(searchLower);
        if (!phoneMatch && !categoryMatch) {
          return false;
        }
      }

      // Filter by list ID
      if (
        listId &&
        !record.listId.toString().toLowerCase().includes(listId.toLowerCase())
      ) {
        return false;
      }

      // Filter by date/time range
      if (record.timestamp) {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return false;

        // Start date/time filter
        if (startDate) {
          const startDateTime = parseUserInputDate(startDate, startTime);
          if (!startDateTime) return false;

          // If no end date is specified, filter for the same day as start date
          if (!endDate) {
            const endOfStartDay = parseUserInputDate(startDate, "23:59:59");
            if (recordDate < startDateTime || recordDate > endOfStartDay) {
              return false;
            }
          } else {
            // If end date is specified, use normal range
            if (recordDate < startDateTime) {
              return false;
            }
          }
        }

        // End date/time filter (only apply if explicitly set)
        if (endDate && startDate && endDate !== startDate) {
          const endDateTime = parseUserInputDate(
            endDate,
            endTime || "23:59:59"
          );
          if (!endDateTime) return false;
          if (recordDate > endDateTime) {
            return false;
          }
        }
      }

      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;

      // Get values based on sort column
      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "phone":
          aValue = a.phone.toLowerCase();
          bValue = b.phone.toLowerCase();
          break;
        case "listId":
          aValue = a.listId.toString().toLowerCase();
          bValue = b.listId.toString().toLowerCase();
          break;
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "timestamp":
          aValue = parseTimestamp(a.timestamp)?.getTime() || 0;
          bValue = parseTimestamp(b.timestamp)?.getTime() || 0;
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }

      // Compare values
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      // Apply sort direction
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Calculate outcomes based on TOTAL records (not filtered) - percentages stay constant
  const outcomes = ALLOWED_CATEGORIES.map((catName) => {
    const cat = dashboardData?.all_categories?.find(
      (c) => c.name === catName || c.original_name === catName
    );
    const countInTotal = callRecords.filter(
      (r) => r.category === catName
    ).length;
    const countInFiltered = filteredCallRecords.filter(
      (r) => r.category === catName
    ).length;
    return {
      id: catName.toLowerCase().replace(/\s/g, "-"),
      label: catName,
      icon: OUTCOME_ICON_MAP[catName] || "bi-circle-fill",
      count: countInTotal, // Show total count (not filtered)
      percentage: callRecords.length
        ? Math.round((countInTotal / callRecords.length) * 100)
        : 0, // Calculate percentage from total records
      color:
        cat &&
        cat.color &&
        cat.color !== "#818589" &&
        cat.color !== "#bbb" &&
        cat.color !== "#eceff4"
          ? cat.color
          : VIBRANT_COLORS[catName] || "#1a73e8",
      bgColor: "#fff",
    };
  });

  // Calculate outcomes filtered by time range (for Engaged/Drop-Off sections)
  const getTimeFilteredRecords = () => {
    if (!timeRange) return callRecords;

    const now = new Date();
    let minutesBack = 0;

    switch (timeRange) {
      case "Last 5 Minutes":
        minutesBack = 5;
        break;
      case "Last 15 Minutes":
        minutesBack = 15;
        break;
      case "Last 1 Hour":
        minutesBack = 60;
        break;
      case "Today":
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        return callRecords.filter((record) => {
          if (!record.timestamp) return false;
          const recordDate = parseTimestamp(record.timestamp);
          return recordDate && recordDate >= startOfToday;
        });
      default:
        return callRecords;
    }

    // For time-based filters (not "Today")
    if (minutesBack > 0) {
      // Find the most recent call timestamp
      const allTimestamps = callRecords
        .map((r) => parseTimestamp(r.timestamp))
        .filter((d) => d !== null)
        .sort((a, b) => b - a); // Sort descending (newest first)

      if (allTimestamps.length === 0) {
        return [];
      }

      const mostRecentCallTime = allTimestamps[0];
      const startTime = new Date(
        mostRecentCallTime.getTime() - minutesBack * 60000
      );

      // Filter records within the time range
      return callRecords.filter((record) => {
        if (!record.timestamp) return false;
        const recordDate = parseTimestamp(record.timestamp);
        return (
          recordDate &&
          recordDate >= startTime &&
          recordDate <= mostRecentCallTime
        );
      });
    }

    return callRecords;
  };

  const timeFilteredRecords = getTimeFilteredRecords();

  const timeFilteredOutcomes = ALLOWED_CATEGORIES.map((catName) => {
    const cat = dashboardData?.all_categories?.find(
      (c) => c.name === catName || c.original_name === catName
    );
    const countInTimeFiltered = timeFilteredRecords.filter(
      (r) => r.category === catName
    ).length;
    return {
      id: catName.toLowerCase().replace(/\s/g, "-"),
      label: catName,
      icon: OUTCOME_ICON_MAP[catName] || "bi-circle-fill",
      count: countInTimeFiltered,
      percentage: timeFilteredRecords.length
        ? Math.round((countInTimeFiltered / timeFilteredRecords.length) * 100)
        : 0,
      color:
        cat &&
        cat.color &&
        cat.color !== "#818589" &&
        cat.color !== "#bbb" &&
        cat.color !== "#eceff4"
          ? cat.color
          : VIBRANT_COLORS[catName] || "#1a73e8",
      bgColor: "#fff",
    };
  });

  // Calculate totals for statistics view
  const qualifiedCount = filteredCallRecords.filter(
    (r) => r.category === "Qualified"
  ).length;
  const totalCalls = filteredCallRecords.length;
  const qualifiedPercentage =
    totalCalls > 0 ? Math.round((qualifiedCount / totalCalls) * 100) : 0;

  // Calculate qualified percentage for time-filtered records (used in summary section)
  const timeFilteredQualifiedCount = timeFilteredRecords.filter(
    (r) => r.category === "Qualified"
  ).length;
  const timeFilteredQualifiedPercentage =
    timeFilteredRecords.length > 0
      ? Math.round(
          (timeFilteredQualifiedCount / timeFilteredRecords.length) * 100
        )
      : 0;

  // Handle outcome filter click (multi-select by default)
  const handleOutcomeClick = (catName) => {
    setSelectedOutcomes((prev) =>
      prev.includes(catName)
        ? prev.filter((c) => c !== catName)
        : [...prev, catName]
    );
  };
  // Add this after the filteredCallRecords logic (around line 620)
  // Client-side pagination
  const RECORDS_PER_PAGE = 25;
  const totalFilteredRecords = filteredCallRecords.length;
  const totalPages = Math.ceil(totalFilteredRecords / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const endIndex = startIndex + RECORDS_PER_PAGE;
  const paginatedRecords = filteredCallRecords.slice(startIndex, endIndex);
  console.log("Debug Info:", {
    totalCallRecords: callRecords.length,
    totalFiltered: filteredCallRecords.length,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedCount: paginatedRecords.length,
  });
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
      setFetchTrigger((prev) => prev + 1); // Trigger data fetch with reset dates
    }
  }, [totalFilteredRecords, totalPages]);

  // Select All functionality - does nothing
  const handleSelectAll = () => {
    // Do nothing
  };

  // Handle Apply Filters button
  const handleApplyFilters = () => {
    setCurrentPage(1);
    setFetchTrigger((prev) => prev + 1); // Increment to trigger useEffect
  };

  const handleReset = () => {
    setSearchText("");
    setListId("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSelectedOutcomes([]);
    setTimeRange("");
    setCurrentPage(1);
    setLoading(true);
    setFetchTrigger((prev) => prev + 1); // Trigger data fetch with reset values
  };

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Handle opening transcript modal
  const handleShowTranscript = (record) => {
    setSelectedCallRecord(record);
    setShowTranscriptModal(true);
  };

  // Handle closing transcript modal
  const handleCloseTranscriptModal = () => {
    setShowTranscriptModal(false);
    setSelectedCallRecord(null);
  };

  const allSelected = false;

  // Define outcome groups
  const ENGAGED_OUTCOMES = [
    "Qualified",
    "Neutral",
    "Unclear Response",
    "Inaudible",
  ];
  const DROPOFF_OUTCOMES = [
    "Answering Machine",
    "DAIR",
    "Honeypot",
    "DNC",
    "Do Not Qualify",
    "Not Interested",
    "User Silent",
    "User Hang Up",
  ];

  // Function to parse timestamp
  // Replace the parseTimestamp function (around line 483)

  // Function to process summary data for time-based graph
  const processSummaryData = () => {
    if (!callRecords || callRecords.length === 0) {
      return { labels: [], transferredData: [], hangupData: [] };
    }

    // Get the current time
    const now = new Date();

    // Filter records based on selected time range
    let filteredRecords = [];
    let startTime = null;
    let minutesBack = 0;

    switch (timeRange) {
      case "Last 5 Minutes":
        minutesBack = 5;
        break;
      case "Last 15 Minutes":
        minutesBack = 15;
        break;
      case "Last 1 Hour":
        minutesBack = 60;
        break;
      case "Today":
        // Get all records from today
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        filteredRecords = callRecords.filter((record) => {
          if (!record.timestamp) return false;
          const recordDate = parseTimestamp(record.timestamp);
          return recordDate && recordDate >= startOfToday;
        });
        break;
      default:
        return { labels: [], transferredData: [], hangupData: [] };
    }

    // For time-based filters (not "Today")
    if (minutesBack > 0) {
      // Find the most recent call timestamp
      const allTimestamps = callRecords
        .map((r) => parseTimestamp(r.timestamp))
        .filter((d) => d !== null)
        .sort((a, b) => b - a); // Sort descending (newest first)

      if (allTimestamps.length === 0) {
        return { labels: [], transferredData: [], hangupData: [] };
      }

      const mostRecentCallTime = allTimestamps[0];
      startTime = new Date(mostRecentCallTime.getTime() - minutesBack * 60000);

      // Filter records within the time range
      filteredRecords = callRecords.filter((record) => {
        if (!record.timestamp) return false;
        const recordDate = parseTimestamp(record.timestamp);
        return (
          recordDate &&
          recordDate >= startTime &&
          recordDate <= mostRecentCallTime
        );
      });
    }

    if (filteredRecords.length === 0) {
      return { labels: [], transferredData: [], hangupData: [] };
    }

    // Get the time range for the graph
    const timestamps = filteredRecords
      .map((r) => parseTimestamp(r.timestamp))
      .filter((d) => d !== null)
      .sort((a, b) => a - b);

    const earliestTime = timestamps[0];
    const latestTime = timestamps[timestamps.length - 1];

    // Create minute-by-minute labels and data
    const labels = [];
    const transferredData = [];
    const hangupData = [];

    // Round down to the nearest minute
    const startMinute = new Date(earliestTime);
    startMinute.setSeconds(0, 0);

    const endMinute = new Date(latestTime);
    endMinute.setSeconds(59, 999);

    // Generate data for each minute
    let currentMinute = new Date(startMinute);
    while (currentMinute <= endMinute) {
      const nextMinute = new Date(currentMinute.getTime() + 60000);

      // Format label as HH:MM
      const hours = currentMinute.getHours();
      const minutes = currentMinute.getMinutes();
      const displayHour = hours % 12 || 12;
      const ampm = hours < 12 ? "AM" : "PM";
      labels.push(
        `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`
      );

      // Count calls in this minute (cumulative)
      let transferredCount = 0;
      let hangupCount = 0;

      filteredRecords.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        // Count all calls up to and including this minute
        if (recordDate <= nextMinute) {
          if (ENGAGED_OUTCOMES.includes(record.category)) {
            transferredCount++;
          } else if (DROPOFF_OUTCOMES.includes(record.category)) {
            hangupCount++;
          }
        }
      });

      transferredData.push(transferredCount);
      hangupData.push(hangupCount);

      currentMinute = nextMinute;
    }

    return { labels, transferredData, hangupData };
  };
  // KEY FIX: Cleanup charts on unmount and view change
  useEffect(() => {
    return () => {
      if (summaryChartInstance.current) {
        summaryChartInstance.current.destroy();
        summaryChartInstance.current = null;
      }
      if (mainChartInstance.current) {
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
    };
  }, []);

  // KEY FIX: Destroy charts when switching views
  useEffect(() => {
    if (currentView !== "statistics" && mainChartInstance.current) {
      mainChartInstance.current.destroy();
      mainChartInstance.current = null;
    }
    if (!showSummaryGraph && summaryChartInstance.current) {
      summaryChartInstance.current.destroy();
      summaryChartInstance.current = null;
    }
  }, [currentView, showSummaryGraph]);
  // Initialize summary chart
  useEffect(() => {
    if (showSummaryGraph && summaryChartRef.current) {
      if (summaryChartInstance.current) {
        summaryChartInstance.current.destroy();
      }

      const ctx = summaryChartRef.current.getContext("2d");

      // Very light pastel colors for fill
      const gradientBlue = ctx.createLinearGradient(0, 0, 0, 400);
      gradientBlue.addColorStop(0, "rgba(255, 182, 193, 0.15)"); // Light pink
      gradientBlue.addColorStop(1, "rgba(255, 182, 193, 0.02)");

      const gradientPurple = ctx.createLinearGradient(0, 0, 0, 400);
      gradientPurple.addColorStop(0, "rgba(200, 162, 200, 0.15)"); // Light purple
      gradientPurple.addColorStop(1, "rgba(200, 162, 200, 0.02)");

      // Get dynamic data
      const summaryData = processSummaryData();

      summaryChartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: summaryData.labels,
          datasets: [
            {
              label: "Calls Transferred",
              data: summaryData.transferredData,
              borderColor: "rgba(255, 182, 193, 0.6)", // Light pink border
              backgroundColor: gradientBlue,
              fill: true,
              tension: 0.5,
              pointRadius: 0,
              borderWidth: 1,
            },
            {
              label: "Calls Hangup",
              data: summaryData.hangupData,
              borderColor: "rgba(200, 162, 200, 0.6)", // Light purple border
              backgroundColor: gradientPurple,
              fill: true,
              tension: 0.5,
              pointRadius: 0,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: "index",
              intersect: false,
              backgroundColor: "#fff",
              titleColor: "#333",
              bodyColor: "#333",
              borderColor: "#eee",
              borderWidth: 1,
              padding: 12,
              caretSize: 6,
              cornerRadius: 6,
              callbacks: {
                title: (context) => context[0].label + " min",
              },
            },
          },
          interaction: {
            mode: "nearest",
            axis: "x",
            intersect: false,
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#888", font: { size: 13 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#f0f0f0" },
              ticks: { color: "#bbb", font: { size: 13 } },
            },
          },
        },
      });
    }

    return () => {
      if (summaryChartInstance.current) {
        summaryChartInstance.current.destroy();
        summaryChartInstance.current = null;
      }
    };
  }, [showSummaryGraph, callRecords, timeRange]);

  const processStatisticsData = () => {
    if (!callRecords || callRecords.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Filter records based on date/time selection
    let filteredData = callRecords.filter((record) => {
      if (!record.timestamp) return false;

      const recordDate = parseTimestamp(record.timestamp);
      if (!recordDate) return false;

      // Apply start date/time filter
      if (startDate) {
        const startDateTime = parseUserInputDate(startDate, startTime);
        if (startDateTime && recordDate < startDateTime) {
          return false;
        }
      }

      // Apply end date/time filter
      if (endDate && endDate !== startDate) {
        const endDateTime = parseUserInputDate(endDate, endTime || "23:59:59");
        if (endDateTime && recordDate > endDateTime) {
          return false;
        }
      }

      return true;
    });

    // Filter by selected categories
    if (selectedOutcomes.length > 0) {
      filteredData = filteredData.filter((record) =>
        selectedOutcomes.includes(record.category)
      );
    }

    // Categories to show
    const categoriesToShow =
      selectedOutcomes.length === 0 ? ALLOWED_CATEGORIES : selectedOutcomes;

    // KEY CHANGE: Determine view mode based on start/end date selection
    const showDateView = startDate && endDate && startDate !== endDate;

    if (showDateView) {
      // DATE VIEW: Show all dates in range, with zeros for missing data
      const dateMap = new Map();

      // Create all dates in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const allDates = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateForComparison(d);
        allDates.push(dateStr);
        dateMap.set(dateStr, {}); // Initialize with empty object
      }

      // Fill in actual data
      filteredData.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        const dateStr = formatDateForComparison(recordDate);
        if (!dateStr || !dateMap.has(dateStr)) return;

        const dateData = dateMap.get(dateStr);
        if (!dateData[record.category]) {
          dateData[record.category] = 0;
        }
        dateData[record.category]++;
      });

      const labels = allDates.map((dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      });

      const datasets = categoriesToShow.map((category) => {
        const data = allDates.map((dateStr) => {
          const dateData = dateMap.get(dateStr);
          return dateData && dateData[category] ? dateData[category] : 0;
        });

        const outcome = outcomes.find((o) => o.label === category);
        const color = outcome ? outcome.color : "#1a73e8";

        const hexToRgba = (hex, alpha) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        return {
          label: category,
          data: data,
          borderColor: hexToRgba(color, 0.5),
          backgroundColor: hexToRgba(color, 0.08),
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 1,
        };
      });

      return { labels, datasets };
    } else {
      // HOURLY VIEW: Show all hours in range with zeros for missing data
      if (filteredData.length === 0) {
        return { labels: [], datasets: [] };
      }

      const hourMap = new Map();

      // Determine hour range
      let startHour = 0;
      let endHour = 23;

      if (startTime || endTime) {
        const startDateTime = parseUserInputDate(
          startDate,
          startTime || "00:00"
        );
        const endDateTime = parseUserInputDate(
          endDate || startDate,
          endTime || "23:59"
        );

        if (startDateTime) startHour = startDateTime.getHours();
        if (endDateTime) endHour = endDateTime.getHours();
      } else {
        // Use data range if no time filters
        const dataHours = filteredData
          .map((r) => parseTimestamp(r.timestamp))
          .filter((d) => d !== null)
          .map((d) => d.getHours());

        if (dataHours.length > 0) {
          startHour = Math.min(...dataHours);
          endHour = Math.max(...dataHours);
        }
      }

      // Initialize all hours in range with empty objects
      for (let hour = startHour; hour <= endHour; hour++) {
        hourMap.set(hour, {});
      }

      // Fill in actual data
      filteredData.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        const hour = recordDate.getHours();
        if (!hourMap.has(hour)) return;

        const hourData = hourMap.get(hour);
        if (!hourData[record.category]) {
          hourData[record.category] = 0;
        }
        hourData[record.category]++;
      });

      // Create labels for hour range
      const labels = [];
      for (let hour = startHour; hour <= endHour; hour++) {
        const displayHour = hour % 12 || 12;
        const ampm = hour < 12 ? "AM" : "PM";
        labels.push(`${displayHour} ${ampm}`);
      }

      // Create datasets with zeros for missing data
      const datasets = categoriesToShow.map((category) => {
        const data = [];
        for (let hour = startHour; hour <= endHour; hour++) {
          const hourData = hourMap.get(hour);
          data.push(hourData[category] || 0); // Use 0 if no data
        }

        const outcome = outcomes.find((o) => o.label === category);
        const color = outcome ? outcome.color : "#1a73e8";

        const hexToRgba = (hex, alpha) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        return {
          label: category,
          data: data,
          borderColor: hexToRgba(color, 0.5),
          backgroundColor: hexToRgba(color, 0.08),
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 1,
        };
      });

      return { labels, datasets };
    }
  };

  // Initialize main statistics chart
  // Initialize main statistics chart
  useEffect(() => {
    if (
      currentView === "statistics" &&
      mainChartRef.current &&
      !loading // Add this condition
    ) {
      if (!mainChartInstance.current) {
        const ctx = mainChartRef.current.getContext("2d");

        mainChartInstance.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: [],
            datasets: [],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: "index",
                intersect: false,
                backgroundColor: "#fff",
                titleColor: "#333",
                bodyColor: "#333",
                borderColor: "#eee",
                borderWidth: 1,
                padding: 12,
                caretSize: 6,
                cornerRadius: 6,
              },
            },
            interaction: {
              mode: "nearest",
              axis: "x",
              intersect: false,
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: "#888", font: { size: 13 } },
                title: {
                  display: true,
                  text: "Date",
                  color: "#666",
                  font: { size: 12 },
                },
              },
              y: {
                beginAtZero: true,
                grid: { color: "#f0f0f0" },
                ticks: {
                  color: "#bbb",
                  font: { size: 13 },
                  stepSize: 1,
                },
              },
            },
          },
        });
      }

      // Initial data load
      const chartData = processStatisticsData();

      // Check if we're viewing a single day
      const isSingleDay = !endDate || startDate === endDate;

      // Update x-axis title based on view mode
      mainChartInstance.current.options.scales.x.title.text = isSingleDay
        ? "Time (Hour)"
        : "Date";

      mainChartInstance.current.data.labels = chartData.labels;
      mainChartInstance.current.data.datasets = chartData.datasets;
      mainChartInstance.current.update();
    }
  }, [currentView, loading]); // Add loading as dependency

  useEffect(() => {
    if (currentView === "statistics" && mainChartInstance.current && !loading) {
      const chartData = processStatisticsData();

      // Determine view mode based on date selection
      const showDateView = startDate && endDate && startDate !== endDate;

      // Determine if single day from actual filtered data
      let isSingleDay = false;
      if (!showDateView) {
        const filteredTimestamps = callRecords
          .filter((r) => {
            if (!r.timestamp) return false;
            const recordDate = parseTimestamp(r.timestamp);
            if (!recordDate) return false;

            if (startDate) {
              const startDateTime = parseUserInputDate(startDate, startTime);
              if (startDateTime && recordDate < startDateTime) return false;
            }

            if (endDate) {
              const endDateTime = parseUserInputDate(
                endDate,
                endTime || "23:59:59"
              );
              if (endDateTime && recordDate > endDateTime) return false;
            }

            return true;
          })
          .map((r) => parseTimestamp(r.timestamp))
          .filter((d) => d !== null);

        if (filteredTimestamps.length > 0) {
          filteredTimestamps.sort((a, b) => a - b);
          const earliestDateStr = formatDateForComparison(
            filteredTimestamps[0]
          );
          const latestDateStr = formatDateForComparison(
            filteredTimestamps[filteredTimestamps.length - 1]
          );
          isSingleDay = earliestDateStr === latestDateStr;
        }
      }

      // Update x-axis title based on view mode
      mainChartInstance.current.options.scales.x.title.text =
        showDateView || !isSingleDay ? "Date" : "Time (Hour)";

      mainChartInstance.current.data.labels = chartData.labels;
      mainChartInstance.current.data.datasets = chartData.datasets;
      mainChartInstance.current.update();
    }
  }, [
    selectedOutcomes,
    currentView,
    callRecords,
    startDate,
    startTime,
    endDate,
    endTime,
    loading,
  ]); // Add loading dependency

  useEffect(() => {
    if (dashboardData) {
      if (!dashboardData.client_name)
        console.log("client_name missing from API");
      if (!dashboardData.campaign) console.log("campaign missing from API");
    }
  }, [dashboardData]);

  if (loading && fetchTrigger > 0)
    // Only show loading if data fetch was triggered
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading dashboard...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 40, color: "red", textAlign: "center" }}>
        Error: {error}
      </div>
    );

  return (
    <div style={styles.body}>
      {/* Note: Add this to your index.html: <meta name="viewport" content="width=device-width, initial-scale=1.0"> */}
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.welcomeText}>
            <i
              className="bi bi-telephone-fill"
              style={{ fontSize: "20px" }}
            ></i>
            <span>
              <strong>
                Welcome back, {dashboardData?.client_name || "Client"}!
              </strong>
            </span>
          </div>
          <span style={styles.badge}>
            Ext: {dashboardData?.campaign?.id || "N/A"}
          </span>
          <span style={styles.clientBadge}>
            <i className="bi bi-person-circle"></i> Client View
          </span>
        </div>
        <div style={styles.headerRight}>
          <button
            style={styles.btn}
            onClick={() => (window.location.href = "/client-landing")}
          >
            <i className="bi bi-house-fill"></i> Back to Campaigns
          </button>
          <button
            style={{
              ...styles.btn,
              ...(currentView === "statistics" ? styles.btnPrimary : {}),
            }}
            onClick={() => setCurrentView("statistics")}
          >
            <i className="bi bi-graph-up"></i> Statistics
          </button>
          <button
            style={{
              ...styles.btn,
              ...(currentView === "dashboard" ? styles.btnPrimary : {}),
            }}
            onClick={() => setCurrentView("dashboard")}
          >
            <i className="bi bi-bar-chart-fill"></i> Reports
          </button>
          <button
            style={styles.btn}
            onClick={() =>
              (window.location.href = `/recordings?campaign_id=${campaignId}`)
            }
          >
            <i className="bi bi-mic-fill"></i> Recordings
          </button>

          {getUserRole() !== "client_member" && (
            <button
              style={{
                ...styles.btn,
                ...(currentView === "data-export" ? styles.btnPrimary : {}),
              }}
              onClick={() => setCurrentView("data-export")}
            >
              <i className="bi bi-download"></i> Data Export
            </button>
          )}
          <button
            style={styles.btn}
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("user_id");
              localStorage.removeItem("username");
              localStorage.removeItem("role");

              window.location.href = "/";
            }}
          >
            <i className="bi bi-person-fill"></i> Logout
          </button>
        </div>
      </div>
      <div style={styles.container}>
        {/* Statistics View */}
        {/* Statistics View */}
        {currentView === "statistics" && (
          <>
            {/* Search & Filter Section */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <i className="bi bi-search"></i>
                Search & Filter Calls
              </h2>
              <p style={styles.timezoneNote}>
                All times are displayed in US Eastern Time (EST/EDT)
              </p>

              <div style={styles.searchRow}>
                <input
                  type="text"
                  style={styles.searchInput}
                  placeholder="Search by phone number, response category..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <input
                  type="text"
                  style={{ ...styles.searchInput, minWidth: "200px" }}
                  placeholder="Search by List ID..."
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                />
              </div>

              {/* KEY FIX: Add Date/Time filters for Statistics */}
              <div style={styles.datetimeRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>
                    Start Date (US EST/EDT)
                  </label>
                  <input
                    type="date"
                    style={styles.input}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      // If end date is before start date, update it
                      if (endDate && e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                    }}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>
                    Start Time (US EST/EDT)
                  </label>
                  <input
                    type="time"
                    style={styles.input}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>End Date (US EST/EDT)</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate} // Prevent selecting date before start
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>End Time (US EST/EDT)</label>
                  <input
                    type="time"
                    style={styles.input}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Statistics Content */}
            <div
              className="statistics-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "24px",
              }}
            >
              {/* Left: Graph */}
              <div style={styles.section}>
                <div style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#333",
                      marginBottom: "4px",
                    }}
                  >
                    Calls Over Time
                  </div>
                  <div style={{ fontSize: "13px", color: "#777" }}>
                    {(() => {
                      // Check if different dates are selected (and end date is actually set)
                      const showDateView =
                        startDate && endDate && startDate !== endDate;

                      if (showDateView) {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        const daysDiff =
                          Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                        return `Daily breakdown across ${daysDiff} days (${start.toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )} - ${end.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })})`;
                      }

                      // If only start date is selected (no end date or end date equals start date)
                      if (startDate && (!endDate || startDate === endDate)) {
                        const singleDate = new Date(startDate);
                        return `Hourly breakdown for ${singleDate.toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}`;
                      }
                      // Filter records by selected date/time
                      const filteredTimestamps = callRecords
                        .filter((r) => {
                          if (!r.timestamp) return false;
                          const recordDate = parseTimestamp(r.timestamp);
                          if (!recordDate) return false;

                          if (startDate) {
                            const startDateTime = parseUserInputDate(
                              startDate,
                              startTime
                            );
                            if (startDateTime && recordDate < startDateTime)
                              return false;
                          }

                          if (endDate) {
                            const endDateTime = parseUserInputDate(
                              endDate,
                              endTime || "23:59:59"
                            );
                            if (endDateTime && recordDate > endDateTime)
                              return false;
                          }

                          return true;
                        })
                        .map((r) => parseTimestamp(r.timestamp))
                        .filter((d) => d !== null);

                      if (filteredTimestamps.length === 0)
                        return "No data available for selected date range";

                      filteredTimestamps.sort((a, b) => a - b);
                      const earliestDate = filteredTimestamps[0];
                      const latestDate =
                        filteredTimestamps[filteredTimestamps.length - 1];

                      const earliestDateStr =
                        formatDateForComparison(earliestDate);
                      const latestDateStr = formatDateForComparison(latestDate);
                      const isSingleDay = earliestDateStr === latestDateStr;

                      if (isSingleDay) {
                        // Determine hour range
                        let startHour, endHour;

                        if (startTime || endTime) {
                          const startDateTime = parseUserInputDate(
                            startDate,
                            startTime || "00:00"
                          );
                          const endDateTime = parseUserInputDate(
                            endDate || startDate,
                            endTime || "23:59"
                          );
                          startHour = startDateTime
                            ? startDateTime.getHours()
                            : earliestDate.getHours();
                          endHour = endDateTime
                            ? endDateTime.getHours()
                            : latestDate.getHours();
                        } else {
                          startHour = earliestDate.getHours();
                          endHour = latestDate.getHours();
                        }

                        const formatHour = (h) => {
                          const display = h % 12 || 12;
                          const ampm = h < 12 ? "AM" : "PM";
                          return `${display} ${ampm}`;
                        };

                        return `Hourly breakdown from ${formatHour(
                          startHour
                        )} to ${formatHour(
                          endHour
                        )} on ${earliestDate.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}`;
                      } else {
                        const daysDiff =
                          Math.ceil(
                            (latestDate - earliestDate) / (1000 * 60 * 60 * 24)
                          ) + 1;
                        return `Daily breakdown across ${daysDiff} days (${earliestDate.toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )} - ${latestDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })})`;
                      }
                    })()}
                  </div>
                </div>

                {/* Legend */}
                <div
                  style={{ display: "flex", gap: "24px", marginBottom: "16px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "rgba(26, 115, 232, 1)",
                        borderRadius: "50%",
                      }}
                    ></div>
                    <span style={{ fontSize: "13px", color: "#666" }}>
                      Calls Transferred
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "rgba(220, 53, 69, 1)",
                        borderRadius: "50%",
                      }}
                    ></div>
                    <span style={{ fontSize: "13px", color: "#666" }}>
                      Calls Hangup
                    </span>
                  </div>
                </div>

                {/* Stats */}

                {/* Chart */}
                <div style={{ height: "400px", position: "relative" }}>
                  <canvas ref={mainChartRef}></canvas>
                </div>
              </div>

              {/* Right: Filters */}
              <div style={styles.section}>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    marginBottom: "16px",
                    color: "#333",
                  }}
                >
                  Filter by Call Outcomes
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {/* All Calls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      backgroundColor:
                        selectedOutcomes.length === 0 ? "#f0f0f0" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onClick={() => setSelectedOutcomes([])}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOutcomes.length === 0}
                        readOnly
                        style={{
                          cursor: "pointer",
                          width: "16px",
                          height: "16px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#333",
                        }}
                      >
                        All Calls
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#666",
                        }}
                      >
                        {callRecords.length.toLocaleString()}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#28a745",
                          fontWeight: 600,
                        }}
                      >
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Category Checkboxes */}
                  {outcomes.map((outcome) => {
                    const isSelected = selectedOutcomes.includes(outcome.label);
                    return (
                      <div
                        key={outcome.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #e5e5e5",
                          backgroundColor: isSelected
                            ? outcome.color + "11"
                            : "#fff",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onClick={() => handleOutcomeClick(outcome.label)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{
                              cursor: "pointer",
                              width: "16px",
                              height: "16px",
                            }}
                          />
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 400,
                              color: "#333",
                            }}
                          >
                            {outcome.label}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#666",
                            }}
                          >
                            {outcome.count.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: outcome.color,
                              fontWeight: 600,
                            }}
                          >
                            {outcome.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Dashboard View */}
        {currentView === "dashboard" && (
          <>
            {/* Search & Filter Section */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <i className="bi bi-search"></i>
                Search & Filter Calls
              </h2>
              <p style={styles.timezoneNote}>
                All times are displayed in US Eastern Time (EST/EDT)
              </p>

              <div style={styles.searchRow}>
                <input
                  type="text"
                  style={styles.searchInput}
                  placeholder="Search by phone number, response category..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <input
                  type="text"
                  style={{ ...styles.searchInput, minWidth: "200px" }}
                  placeholder="Search by List ID..."
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                />
              </div>

              <div style={styles.datetimeRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>
                    Start Date (US EST/EDT)
                  </label>
                  <input
                    type="date"
                    style={styles.input}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>
                    Start Time (US EST/EDT)
                  </label>
                  <input
                    type="time"
                    style={styles.input}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>End Date (US EST/EDT)</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>End Time (US EST/EDT)</label>
                  <input
                    type="time"
                    style={styles.input}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleApplyFilters}
                  style={{
                    ...styles.btn,
                    ...styles.btnPrimary,
                  }}
                >
                  <i className="bi bi-funnel-fill"></i>
                  Apply Filters
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#666",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px",
                  }}
                >
                  <i className="bi bi-arrow-clockwise"></i>
                  Reset
                </button>
              </div>

              {/* Filter by Call Outcomes */}
              <div style={{ marginTop: "24px" }}>
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    marginBottom: "16px",
                    color: "#333",
                  }}
                >
                  Filter by Call Outcomes
                </h3>
                <div style={styles.outcomesGrid}>
                  {/* All Calls */}
                  <div
                    style={{
                      ...styles.outcomeItem,
                      border:
                        selectedOutcomes.length === 0
                          ? "2px solid #6c757d"
                          : "2px solid #f0f0f0",
                      backgroundColor:
                        selectedOutcomes.length === 0 ? "#f0f0f0" : "#fff",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedOutcomes([])}
                    onMouseEnter={(e) => {
                      if (selectedOutcomes.length !== 0) {
                        e.currentTarget.style.border = "2px solid #6c757d88";
                        e.currentTarget.style.backgroundColor = "#f0f0f0";
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 3px 8px rgba(15, 23, 42, 0.08)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedOutcomes.length !== 0) {
                        e.currentTarget.style.border = "2px solid #f0f0f0";
                        e.currentTarget.style.backgroundColor = "#fff";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#444",
                        }}
                      >
                        <i
                          className="bi bi-check-circle-fill"
                          style={{ fontSize: "14px", color: "#6c757d" }}
                        ></i>
                        <span>All Calls</span>
                      </div>
                      {callRecords.length > 0 && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontWeight: 600,
                          }}
                        >
                          ({callRecords.length})
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "4px",
                      }}
                    >
                      <div
                        style={{
                          ...styles.progressBar,
                          backgroundColor: "#e9ecef",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: "100%",
                            background:
                              "linear-gradient(90deg, #6c757d, #495057)",
                            borderRadius: "10px",
                          }}
                        ></div>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#666",
                          minWidth: "35px",
                          textAlign: "right",
                        }}
                      >
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Category Filters */}
                  {outcomes.map((outcome) => {
                    const isSelected = selectedOutcomes.includes(outcome.label);
                    return (
                      <div
                        key={outcome.id}
                        style={{
                          ...styles.outcomeItem,
                          border: isSelected
                            ? `2px solid ${outcome.color}`
                            : "2px solid #f0f0f0",
                          backgroundColor: "#fff",
                        }}
                        onClick={() => handleOutcomeClick(outcome.label)}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.border = `2px solid ${outcome.color}44`;
                            e.currentTarget.style.backgroundColor =
                              outcome.color + "11";
                            e.currentTarget.style.transform =
                              "translateY(-1px)";
                            e.currentTarget.style.boxShadow =
                              "0 3px 8px rgba(15, 23, 42, 0.08)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.border = "2px solid #f0f0f0";
                            e.currentTarget.style.backgroundColor = "#fff";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              fontWeight: 500,
                              color: "#444",
                            }}
                          >
                            <i
                              className={outcome.icon}
                              style={{ fontSize: "14px", color: outcome.color }}
                            ></i>
                            <span>{outcome.label}</span>
                          </div>
                          {outcome.count > 0 && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                fontWeight: 600,
                              }}
                            >
                              ({outcome.count})
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "4px",
                          }}
                        >
                          <div
                            style={{
                              ...styles.progressBar,
                              backgroundColor: "#e9ecef",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${outcome.percentage}%`,
                                background: outcome.color,
                                borderRadius: "10px",
                                transition: "width 0.3s ease",
                              }}
                            ></div>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#666",
                              minWidth: "35px",
                              textAlign: "right",
                            }}
                          >
                            {outcome.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Outcomes Summary Box */}
            <div style={styles.section}>
              {!showSummaryGraph && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e5eaf2",
                        background: "#fff",
                        fontSize: "15px",
                        color: "#222",
                        fontWeight: 500,
                        outline: "none",
                      }}
                    >
                      <option value="">Select Time Range</option>
                      <option value="Last 5 Minutes">Last 5 Minutes</option>
                      <option value="Last 15 Minutes">Last 15 Minutes</option>
                      <option value="Last 1 Hour">Last 1 Hour</option>
                      <option value="Today">Today</option>
                    </select>
                    <button
                      onClick={() => setShowSummaryGraph(true)}
                      style={{
                        marginLeft: "10px",
                        padding: "7px 18px",
                        borderRadius: "8px",
                        border: "1px solid #1a73e8",
                        background: "#1a73e8",
                        color: "#fff",
                        fontSize: "15px",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      Show Summary Graph
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      color: "#222",
                      background: "#f7fafd",
                      borderRadius: "10px",
                      padding: "8px 22px",
                      minWidth: "90px",
                      textAlign: "center",
                      boxShadow: "0 1px 2px #e5eaf2",
                    }}
                  >
                    {timeRange
                      ? timeFilteredQualifiedPercentage
                      : qualifiedPercentage}
                    .0%
                  </div>
                </div>
              )}

              {/* Outcomes Row */}
              {!showSummaryGraph && dashboardData && (
                <div
                  className="outcomes-container"
                  style={{
                    display: "flex",
                    gap: "32px",
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                  {/* Engaged Outcomes */}
                  <div style={{ flex: "1 1 260px", minWidth: "220px" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#111",
                        marginBottom: "8px",
                      }}
                    >
                      Engaged Outcomes
                    </div>
                    <div
                      style={{
                        background: "#f9fbfd",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid #eceff4",
                      }}
                    >
                      {["Qualified", "Neutral", "Unclear Response"].map(
                        (catName, idx, arr) => {
                          const iconMap = {
                            Qualified: "bi-star-fill",
                            Neutral: "bi-circle",
                            "Unclear Response": "bi-info-circle",
                          };
                          const cat = timeFilteredOutcomes.find(
                            (o) => o.label === catName
                          );
                          return cat ? (
                            <div
                              key={catName}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "10px 18px",
                                borderBottom:
                                  idx < arr.length - 1
                                    ? "1px solid #e0e4ea"
                                    : "none",
                                fontSize: "16px",
                                color: "#111",
                                fontWeight: 400,
                                gap: "10px",
                                marginBottom: "3px",
                              }}
                            >
                              <i
                                className={iconMap[catName] || "bi-circle"}
                                style={{ color: cat.color, fontSize: "18px" }}
                              ></i>
                              {cat.label}
                              <span
                                style={{
                                  marginLeft: "auto",
                                  color: "#111",
                                  fontWeight: 400,
                                }}
                              >
                                {cat.percentage}%
                              </span>
                            </div>
                          ) : null;
                        }
                      )}
                    </div>
                  </div>

                  {/* Drop-Off Outcomes */}
                  <div style={{ flex: "1 1 260px", minWidth: "220px" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#111",
                        marginBottom: "8px",
                      }}
                    >
                      Drop-Off Outcomes
                    </div>
                    <div
                      style={{
                        background: "#f9fbfd",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1.5px solid #e0e4ea",
                      }}
                    >
                      {[
                        "Answering Machine",
                        "DAIR",
                        "Honeypot",
                        "DNC",
                        "Do Not Qualify",
                        "Not Interested",
                        "User Silent",
                        "User Hang Up",
                        "Inaudible",
                      ].map((catName, idx, arr) => {
                        const iconMap = {
                          "Answering Machine": "bi-telephone-fill",
                          DAIR: "bi-dash",
                          Honeypot: "bi-shield-fill",
                          DNC: "bi-telephone-x-fill",
                          "Do Not Qualify": "bi-exclamation-triangle-fill",
                          "Not Interested": "bi-x-circle-fill",
                          "User Silent": "bi-mic-mute",
                          "User Hang Up": "bi-telephone-minus-fill",
                          Inaudible: "bi-volume-mute",
                        };
                        const cat = timeFilteredOutcomes.find(
                          (o) => o.label === catName
                        );
                        return cat ? (
                          <div
                            key={catName}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "10px 18px",
                              borderBottom:
                                idx < arr.length - 1
                                  ? "1px solid #e0e4ea"
                                  : "none",
                              fontSize: "16px",
                              color: "#111",
                              fontWeight: 400,
                              gap: "10px",
                              marginBottom: "3px",
                            }}
                          >
                            <i
                              className={iconMap[catName] || "bi-circle"}
                              style={{ color: cat.color, fontSize: "18px" }}
                            ></i>
                            {cat.label}
                            <span
                              style={{
                                marginLeft: "auto",
                                color: "#111",
                                fontWeight: 400,
                              }}
                            >
                              {cat.percentage}%
                            </span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Graph */}
              {showSummaryGraph && (
                <div style={styles.callSummarySection}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#333",
                        }}
                      >
                        <i className="bi bi-bar-chart-line"></i>
                        Summary Calls Over Time
                      </div>
                      <div style={{ fontSize: "12px", color: "#777" }}>
                        {timeRange
                          ? `${timeRange} - Calls transferred vs hangups`
                          : "Calls transferred vs hangups by minute"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "40px",
                            fontWeight: 700,
                            color: "#1a73e8",
                          }}
                        >
                          {timeRange
                            ? timeFilteredQualifiedCount.toLocaleString()
                            : qualifiedCount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: "15px", color: "#888" }}>
                          Total Qualified
                        </div>
                        <div
                          style={{
                            fontSize: "15px",
                            color: "#28a745",
                            fontWeight: 600,
                          }}
                        >
                          <i className="bi bi-arrow-up"></i>{" "}
                          {timeRange
                            ? timeFilteredQualifiedPercentage
                            : qualifiedPercentage}
                          %
                        </div>
                      </div>
                      <button
                        onClick={() => setShowSummaryGraph(false)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "1px solid #dc3545",
                          background: "#dc3545",
                          color: "#fff",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor = "#c82333")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor = "#dc3545")
                        }
                      >
                        <i className="bi bi-x-lg"></i> Close
                      </button>
                    </div>
                  </div>
                  <div style={styles.callLineChart}>
                    <canvas ref={summaryChartRef}></canvas>
                  </div>
                </div>
              )}
            </div>

            {/* Call Records Table */}
            <div style={styles.section}>
              <div style={{ marginBottom: "20px" }}>
                <div style={styles.sectionTitle}>
                  <i className="bi bi-telephone-fill"></i>
                  <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
                    Call Records ({totalFilteredRecords} filtered
                    {totalFilteredRecords !== callRecords.length &&
                      ` of ${callRecords.length} total`}
                    )
                  </h2>
                </div>
                <p style={{ ...styles.timezoneNote, margin: 0 }}>
                  All times are displayed in US Eastern Time (EST/EDT)
                </p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "800px",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
                      <th
                        onClick={() => handleSort("id")}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                          cursor: "pointer",
                          userSelect: "none",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          #
                          {sortColumn === "id" && (
                            <i
                              className={`bi bi-chevron-${
                                sortDirection === "asc" ? "up" : "down"
                              }`}
                              style={{ fontSize: "12px" }}
                            ></i>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("phone")}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Phone No
                          {sortColumn === "phone" && (
                            <i
                              className={`bi bi-chevron-${
                                sortDirection === "asc" ? "up" : "down"
                              }`}
                              style={{ fontSize: "12px" }}
                            ></i>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("listId")}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          List ID
                          {sortColumn === "listId" && (
                            <i
                              className={`bi bi-chevron-${
                                sortDirection === "asc" ? "up" : "down"
                              }`}
                              style={{ fontSize: "12px" }}
                            ></i>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("category")}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Response Category
                          {sortColumn === "category" && (
                            <i
                              className={`bi bi-chevron-${
                                sortDirection === "asc" ? "up" : "down"
                              }`}
                              style={{ fontSize: "12px" }}
                            ></i>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("timestamp")}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Timestamp (US EST/EDT)
                          {sortColumn === "timestamp" && (
                            <i
                              className={`bi bi-chevron-${
                                sortDirection === "asc" ? "up" : "down"
                              }`}
                              style={{ fontSize: "12px" }}
                            ></i>
                          )}
                        </div>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          fontWeight: 500,
                          color: "#333",
                          fontSize: "13px",
                        }}
                      >
                        Transcript
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            color: "#888",
                            padding: 24,
                          }}
                        >
                          No call records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedRecords.map((record) => {
                        const outcome = outcomes.find(
                          (o) => o.label === record.category
                        );
                        const categoryColor = outcome
                          ? outcome.color
                          : record.categoryColor;
                        return (
                          <tr
                            key={record.id}
                            style={{
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background-color 0.2s",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#f9fafb")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <td
                              style={{
                                padding: "12px 16px",
                                fontSize: "14px",
                                color: "#333",
                              }}
                            >
                              {record.id}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontSize: "14px",
                                color: "#333",
                              }}
                            >
                              {record.phone}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontSize: "14px",
                                color: "#666",
                              }}
                            >
                              {record.listId}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  backgroundColor: categoryColor,
                                  color: "white",
                                }}
                              >
                                {record.category}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontSize: "14px",
                                color: "#666",
                              }}
                            >
                              {record.timestamp}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontSize: "13px",
                                color: "#333",
                              }}
                            >
                              {record.transcript ? (
                                <button
                                  onClick={() => handleShowTranscript(record)}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "4px",
                                    border: "1px solid #1a73e8",
                                    backgroundColor: "#fff",
                                    color: "#1a73e8",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#e8f0fe";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#fff";
                                  }}
                                >
                                  <i className="bi bi-file-text"></i>
                                  Show Transcript
                                </button>
                              ) : (
                                <span style={{ color: "#aaa" }}>
                                  No transcript
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#666" }}>
                  Showing {paginatedRecords.length > 0 ? startIndex + 1 : 0} to{" "}
                  {Math.min(endIndex, totalFilteredRecords)} of{" "}
                  {totalFilteredRecords} filtered records
                  {totalFilteredRecords !== callRecords.length && (
                    <span style={{ color: "#999" }}>
                      {" "}
                      (out of {callRecords.length} total)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: "white",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      opacity: currentPage === 1 ? 0.5 : 1,
                    }}
                    disabled={currentPage === 1}
                  >
                    <i className="bi bi-chevron-left"></i>
                    Previous
                  </button>

                  <div style={{ display: "flex", gap: "4px" }}>
                    {(() => {
                      const pages = [];
                      const maxPagesToShow = 5;

                      let startPage = Math.max(1, currentPage - 2);
                      let endPage = Math.min(
                        totalPages,
                        startPage + maxPagesToShow - 1
                      );

                      if (endPage - startPage < maxPagesToShow - 1) {
                        startPage = Math.max(1, endPage - maxPagesToShow + 1);
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }

                      return pages.map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={{
                            padding: "6px 12px",
                            border:
                              page === currentPage ? "none" : "1px solid #ddd",
                            borderRadius: "4px",
                            backgroundColor:
                              page === currentPage ? "#1a73e8" : "white",
                            color: page === currentPage ? "white" : "#333",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      backgroundColor: "white",
                      color: "#333",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor:
                        currentPage === totalPages ? "not-allowed" : "pointer",
                      opacity: currentPage === totalPages ? 0.5 : 1,
                    }}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        {/* Data Export View */}
        {currentView === "data-export" && <DataExport />}
      </div>{" "}
      {/* closing container div */}
      {/* Transcript Modal */}
      {showTranscriptModal && selectedCallRecord && (
        <div
          className="transcript-modal-container"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={handleCloseTranscriptModal}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e5e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                backgroundColor: "white",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px",
                zIndex: 1,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  Call Transcript
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#666",
                  }}
                >
                  Call ID: {selectedCallRecord.id}
                </p>
              </div>
              <button
                onClick={handleCloseTranscriptModal}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                  e.currentTarget.style.color = "#333";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#666";
                }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px" }}>
              {/* Call Information */}
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  Call Information
                </h4>
                <div
                  className="modal-info-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Phone Number
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#333",
                      }}
                    >
                      {selectedCallRecord.phone}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      List ID
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#333",
                      }}
                    >
                      {selectedCallRecord.listId}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Response Category
                    </div>
                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: selectedCallRecord.categoryColor,
                          color: "white",
                        }}
                      >
                        {selectedCallRecord.category}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                      }}
                    >
                      Timestamp (US EST/EDT)
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#333",
                      }}
                    >
                      {selectedCallRecord.timestamp}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div>
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#333",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <i className="bi bi-file-text"></i>
                  Transcript
                </h4>
                <div
                  style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    padding: "16px",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#333",
                    maxHeight: "400px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedCallRecord.transcript || "No transcript available"}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e5e5",
                display: "flex",
                justifyContent: "flex-end",
                position: "sticky",
                bottom: 0,
                backgroundColor: "white",
                borderBottomLeftRadius: "12px",
                borderBottomRightRadius: "12px",
              }}
            >
              <button
                onClick={handleCloseTranscriptModal}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  backgroundColor: "white",
                  color: "#333",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Responsive Styles */}
      <style>{`
        /* Base responsive settings */
        * {
          box-sizing: border-box;
        }
        
        /* Sortable table header hover effect */
        th[style*="cursor: pointer"]:hover {
          background-color: #f5f5f5;
          transition: background-color 0.2s;
        }
        
        /* Tablet and below (768px) */
        @media (max-width: 768px) {
          /* Make modal padding smaller on mobile */
          .transcript-modal-container {
            padding: 10px !important;
            align-items: flex-start !important;
          }
          
          /* Adjust modal info grid to single column on mobile */
          .modal-info-grid {
            grid-template-columns: 1fr !important;
          }
          
          /* Make statistics grid stack on mobile */
          .statistics-grid {
            grid-template-columns: 1fr !important;
          }
          
          /* Make outcome grids more compact on mobile */
          .outcomes-container {
            flex-direction: column !important;
            gap: 16px !important;
          }
          
          /* Adjust container padding on mobile */
          body > div > div:first-child {
            padding: 16px !important;
          }
          
          /* Make charts responsive height */
          canvas {
            max-height: 300px !important;
          }
          
          /* Stack header items on mobile */
          header > div {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          
          /* Make buttons smaller on mobile */
          button {
            font-size: 13px !important;
            padding: 6px 12px !important;
          }
          
          /* Table wrapper - allow horizontal scroll */
          table {
            font-size: 12px !important;
          }
          
          th, td {
            padding: 8px 10px !important;
            font-size: 12px !important;
          }
          
          /* Reduce modal padding on mobile */
          .transcript-modal-container > div > div {
            padding: 16px !important;
          }
          
          /* Make pagination stack */
          div[style*="pagination"] {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
        
        /* Mobile (480px and below) */
        @media (max-width: 480px) {
          /* Extra small screens */
          body {
            font-size: 14px !important;
          }
          
          /* Further reduce padding */
          section, div[style*="section"] {
            padding: 16px !important;
          }
          
          /* Make stat numbers smaller */
          div[style*="fontSize: '48px'"] {
            font-size: 32px !important;
          }
          
          div[style*="fontSize: '40px'"] {
            font-size: 28px !important;
          }
          
          /* Stack legend items vertically */
          div[style*="gap: '24px'"] {
            flex-direction: column !important;
            gap: 8px !important;
          }
          
          /* Full width modal on very small screens */
          .transcript-modal-container {
            padding: 0 !important;
          }
          
          .transcript-modal-container > div {
            max-height: 100vh !important;
            border-radius: 0 !important;
          }
          
          /* Make chips/badges wrap better */
          span[style*="borderRadius: '4px'"] {
            font-size: 11px !important;
            padding: 3px 8px !important;
          }
          
          /* Smaller headings on mobile */
          h2, h3 {
            font-size: 16px !important;
          }
          
          h4 {
            font-size: 14px !important;
          }
          
          /* Hide "Show Transcript" text on very small screens, keep icon */
          button i.bi-file-text + * {
            display: none;
          }
        }
      `}</style>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
      />
    </div>
  );
};

export default MedicareDashboard;
