import React, { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import DataExport from "./DataExport";
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
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [campaignId, setCampaignId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState("id"); // Default sort by ID
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' or 'desc'

  // Modal states
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedCallRecord, setSelectedCallRecord] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("campaign_id");
    if (id) {
      setCampaignId(id);
    } else {
      window.location.href = "/client-landing";
    }
  }, []);
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
      if (!campaignId) return;

      setLoading(true);
      setError(null);
      try {
        const token =
          localStorage.getItem("access_token") ||
          sessionStorage.getItem("access_token");

        if (!token) {
          throw new Error("No authentication token found. Please login again.");
        }

        // First, fetch the first page to get total pages info
        const firstPageRes = await fetch(
          `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${startDate}&page=1&page_size=25`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

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
          pagePromises.push(
            fetch(
              `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${startDate}&page=${page}&page_size=25`,
              {
                headers: {
                  accept: "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            ).then((res) => res.json())
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
            total_pages: 1, // We now have all data in one "page"
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
    fetchData();
  }, [campaignId, startDate]); // Only refetch when campaign or start date changes

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

      // Filter by time range dropdown (Last 5 Minutes, etc.)
      if (timeRange && record.timestamp) {
        const recordDate = new Date(record.timestamp);
        const now = new Date();
        let minutesAgo = 0;

        switch (timeRange) {
          case "Last 5 Minutes":
            minutesAgo = 5;
            break;
          case "Last 15 Minutes":
            minutesAgo = 15;
            break;
          case "Last 1 Hour":
            minutesAgo = 60;
            break;
          case "Today":
            const startOfToday = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            );
            if (recordDate < startOfToday) {
              return false;
            }
            break;
          default:
            break;
        }

        if (minutesAgo > 0) {
          const cutoffTime = new Date(now.getTime() - minutesAgo * 60000);
          if (recordDate < cutoffTime) {
            return false;
          }
        }
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

  // Calculate totals for statistics view
  const qualifiedCount = filteredCallRecords.filter(
    (r) => r.category === "Qualified"
  ).length;
  const totalCalls = filteredCallRecords.length;
  const qualifiedPercentage =
    totalCalls > 0 ? Math.round((qualifiedCount / totalCalls) * 100) : 0;

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
    }
  }, [totalFilteredRecords, totalPages]);

  // Select All functionality - does nothing
  const handleSelectAll = () => {
    // Do nothing
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

    // Get today's date
    const today = new Date();
    const todayStr = formatDateForComparison(today);

    // Filter records for today only
    const todayRecords = callRecords.filter((record) => {
      if (!record.timestamp) return false;
      const recordDate = parseTimestamp(record.timestamp);
      if (!recordDate) return false;
      const recordDateStr = formatDateForComparison(recordDate);
      return recordDateStr === todayStr;
    });

    if (todayRecords.length === 0) {
      return { labels: [], transferredData: [], hangupData: [] };
    }

    // Find the earliest call time today
    let earliestMinutes = Infinity;
    todayRecords.forEach((record) => {
      const recordDate = parseTimestamp(record.timestamp);
      if (recordDate) {
        const minutes = getMinutesFromStartOfDay(recordDate);
        if (minutes < earliestMinutes) {
          earliestMinutes = minutes;
        }
      }
    });

    // If no valid records, return empty
    if (earliestMinutes === Infinity) {
      return { labels: [], transferredData: [], hangupData: [] };
    }

    // Round down to nearest 5-minute interval
    const startInterval = Math.floor(earliestMinutes / 5) * 5;

    // Determine the end interval (current time or last call time, whichever is later)
    const currentMinutes = getMinutesFromStartOfDay(new Date());
    let latestMinutes = 0;
    todayRecords.forEach((record) => {
      const recordDate = parseTimestamp(record.timestamp);
      if (recordDate) {
        const minutes = getMinutesFromStartOfDay(recordDate);
        if (minutes > latestMinutes) {
          latestMinutes = minutes;
        }
      }
    });
    const endInterval = Math.max(currentMinutes, latestMinutes);

    // Create 5-minute interval labels and data
    const labels = [];
    const transferredData = [];
    const hangupData = [];

    for (let interval = startInterval; interval <= endInterval; interval += 5) {
      labels.push(interval.toString());

      // Count calls up to this interval (cumulative)
      let transferredCount = 0;
      let hangupCount = 0;

      todayRecords.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        const recordMinutes = getMinutesFromStartOfDay(recordDate);

        // Only count calls that happened before or at this interval
        if (recordMinutes <= interval) {
          if (ENGAGED_OUTCOMES.includes(record.category)) {
            transferredCount++;
          } else if (DROPOFF_OUTCOMES.includes(record.category)) {
            hangupCount++;
          }
        }
      });

      transferredData.push(transferredCount);
      hangupData.push(hangupCount);
    }

    return { labels, transferredData, hangupData };
  };

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
  }, [showSummaryGraph, callRecords]);

  // Function to process statistics data based on filters
  // Function to process statistics data based on filters
  const processStatisticsData = () => {
    if (!callRecords || callRecords.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Get all valid timestamps
    const allTimestamps = callRecords
      .map((r) => parseTimestamp(r.timestamp))
      .filter((d) => d !== null);

    if (allTimestamps.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Sort timestamps to find earliest and latest
    allTimestamps.sort((a, b) => a - b);
    const earliestDate = allTimestamps[0];
    const latestDate = allTimestamps[allTimestamps.length - 1];

    // Check if all data is within a single day
    const earliestDateStr = formatDateForComparison(earliestDate);
    const latestDateStr = formatDateForComparison(latestDate);
    const isSingleDay = earliestDateStr === latestDateStr;

    // If no specific categories selected (All Calls), show all categories
    const categoriesToShow =
      selectedOutcomes.length === 0 ? ALLOWED_CATEGORIES : selectedOutcomes;

    // Filter records based on selected categories only (not date, use all data)
    const filtered = callRecords.filter((record) => {
      // Check if category is selected (if All Calls, include all)
      if (
        selectedOutcomes.length > 0 &&
        !selectedOutcomes.includes(record.category)
      ) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      return { labels: [], datasets: [] };
    }

    // If single day, group by hour; otherwise group by date
    if (isSingleDay) {
      // Group by hour (0-23)
      const hourMap = new Map();

      // Get the start and end hours from actual data
      const dataTimestamps = filtered
        .map((r) => parseTimestamp(r.timestamp))
        .filter((d) => d !== null);

      const startHour = Math.min(...dataTimestamps.map((d) => d.getHours()));
      const endHour = Math.max(...dataTimestamps.map((d) => d.getHours()));

      // Initialize only the hours that have data or are in between
      for (let hour = startHour; hour <= endHour; hour++) {
        hourMap.set(hour, {});
      }

      filtered.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        const hour = recordDate.getHours();
        if (!hourMap.has(hour)) return; // Skip if outside our range

        const hourData = hourMap.get(hour);
        if (!hourData[record.category]) {
          hourData[record.category] = 0;
        }
        hourData[record.category]++;
      });

      // Create labels for the actual hour range
      const labels = [];
      for (let hour = startHour; hour <= endHour; hour++) {
        const displayHour = hour % 12 || 12;
        const ampm = hour < 12 ? "AM" : "PM";
        labels.push(`${displayHour} ${ampm}`);
      }

      // Create datasets for each category to show
      const datasets = categoriesToShow.map((category) => {
        const data = [];
        for (let hour = startHour; hour <= endHour; hour++) {
          const hourData = hourMap.get(hour);
          data.push(hourData[category] || 0);
        }

        // Find the outcome to get its color
        const outcome = outcomes.find((o) => o.label === category);
        const color = outcome ? outcome.color : "#1a73e8";

        // Convert hex to rgba for background and border
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
      // Group records by date and category
      const dateMap = new Map();

      // Get all unique dates from the data
      const allDates = new Set();
      filtered.forEach((record) => {
        const recordDate = parseTimestamp(record.timestamp);
        if (!recordDate) return;

        const dateStr = formatDateForComparison(recordDate);
        if (!dateStr) return;

        allDates.add(dateStr);

        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, {});
        }

        const dateData = dateMap.get(dateStr);
        if (!dateData[record.category]) {
          dateData[record.category] = 0;
        }
        dateData[record.category]++;
      });

      // Sort dates
      const sortedDates = Array.from(allDates).sort();

      // Create labels from sorted dates
      const labels = sortedDates.map((dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      });

      // Create datasets for each category to show
      const datasets = categoriesToShow.map((category) => {
        const data = sortedDates.map((dateStr) => {
          const dateData = dateMap.get(dateStr);
          return dateData && dateData[category] ? dateData[category] : 0;
        });

        // Find the outcome to get its color
        const outcome = outcomes.find((o) => o.label === category);
        const color = outcome ? outcome.color : "#1a73e8";

        // Convert hex to rgba for background and border
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
  useEffect(() => {
    if (
      currentView === "statistics" &&
      mainChartRef.current &&
      !mainChartInstance.current
    ) {
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

    return () => {
      if (mainChartInstance.current) {
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
    };
  }, [currentView]);

  // Update chart when filters change
  // Update chart when filters change
useEffect(() => {
  if (currentView === "statistics" && mainChartInstance.current) {
    const chartData = processStatisticsData();

    // Determine if single day based on actual data
    const allTimestamps = callRecords
      .map((r) => parseTimestamp(r.timestamp))
      .filter((d) => d !== null);
    
    let isSingleDay = false;
    if (allTimestamps.length > 0) {
      allTimestamps.sort((a, b) => a - b);
      const earliestDateStr = formatDateForComparison(allTimestamps[0]);
      const latestDateStr = formatDateForComparison(allTimestamps[allTimestamps.length - 1]);
      isSingleDay = earliestDateStr === latestDateStr;
    }

    // Update x-axis title based on view mode
    mainChartInstance.current.options.scales.x.title.text = isSingleDay
      ? "Time (Hour)"
      : "Date";

    mainChartInstance.current.data.labels = chartData.labels;
    mainChartInstance.current.data.datasets = chartData.datasets;
    mainChartInstance.current.update();
  }
}, [selectedOutcomes, currentView, callRecords]);

  useEffect(() => {
    if (dashboardData) {
      if (!dashboardData.client_name)
        console.log("client_name missing from API");
      if (!dashboardData.campaign) console.log("campaign missing from API");
    }
  }, [dashboardData]);

  if (loading)
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
          <button
            style={{
              ...styles.btn,
              ...(currentView === "data-export" ? styles.btnPrimary : {}),
            }}
            onClick={() => setCurrentView("data-export")}
          >
            <i className="bi bi-download"></i> Data Export
          </button>
          <button
            style={styles.btn}
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("user_id");
              localStorage.removeItem("username");
              localStorage.removeItem("role");
              sessionStorage.clear();
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

              {/* Auto-detected date range display */}
            

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
                Reset Filters
              </button>
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
                      const timestamps = callRecords
                        .map((r) => parseTimestamp(r.timestamp))
                        .filter((d) => d !== null);
                      if (timestamps.length === 0) return "No data available";

                      const dates = timestamps.map((d) =>
                        formatDateForComparison(d)
                      );
                      const uniqueDates = [...new Set(dates)];

                      if (uniqueDates.length === 1) {
                        return "Hourly breakdown for the selected day";
                      } else {
                        return `Daily breakdown across ${uniqueDates.length} days`;
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
                    {qualifiedPercentage}.0%
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
                          const cat = outcomes.find((o) => o.label === catName);
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
                        const cat = outcomes.find((o) => o.label === catName);
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
                        Calls transferred vs hangups by minute
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
                          {qualifiedCount.toLocaleString()}
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
                          {qualifiedPercentage}%
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
