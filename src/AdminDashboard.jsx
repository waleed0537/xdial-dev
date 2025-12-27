import React, { useState, useEffect } from "react";

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState("dashboard");
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState("2025-12-22");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [campaignId, setCampaignId] = useState(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Dynamic stage filter states - will be populated based on API data
  const [stageFilters, setStageFilters] = useState({});
  const [availableStages, setAvailableStages] = useState([]);

  // Modal states - keeping for potential future use
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [selectedStage, setSelectedStage] = useState("");

  // Get campaign ID on mount - use campaign_id from URL or default to 1 for testing
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("campaign_id") || "1"; // Default to campaign 1 for testing
    setCampaignId(id);
    setCurrentView("dashboard");
    // Automatically trigger data fetch on mount
    setFetchTrigger(1);
  }, []);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId || !startDate) return;

      setLoading(true);
      setError(null);
      try {
        // Use token from localStorage, or fall back to test token
        let token = localStorage.getItem("access_token");
        
        // If no token in localStorage, use the test token
        if (!token) {
          token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJkb2MiLCJyb2xlcyI6WyJhZG1pbiJdLCJleHAiOjE3NjY5NDEwODIsImlhdCI6MTc2Njg1NDY4Mn0.ocnDhIrgCLrQj1Go0U36ECUSU6X59kI4RH06XG1svqQ";
          console.log("Using test token for API calls");
        }

        // First, fetch the first page to get total pages info
        // Try without /admin/ prefix first
        let apiUrl = `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${startDate}`;
        if (endDate && endDate !== startDate) {
          apiUrl += `&end_date=${endDate}`;
        }
        apiUrl += `&page=1&page_size=50`;

        console.log("Fetching:", apiUrl);

        const firstPageRes = await fetch(apiUrl, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("Response status:", firstPageRes.status);

        if (firstPageRes.status === 401 || firstPageRes.status === 403) {
          const errorText = await firstPageRes.text();
          console.error("Auth error response:", errorText);
          throw new Error(`Authentication failed (${firstPageRes.status}): ${errorText}`);
        }

        if (!firstPageRes.ok) {
          const errorText = await firstPageRes.text();
          console.error("Error response:", errorText);
          throw new Error(`Failed to fetch dashboard data: ${firstPageRes.status} ${firstPageRes.statusText} - ${errorText}`);
        }

        const firstPageData = await firstPageRes.json();
        console.log("First page data:", firstPageData);
        console.log("Calls data:", firstPageData.calls);
        console.log("Sample call:", firstPageData.calls?.[0]);
        
        const totalPages = firstPageData.pagination?.total_pages || 1;

        // If there's only one page, use it directly
        if (totalPages === 1) {
          setDashboardData(firstPageData);
          processAvailableStages(firstPageData.calls);
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
          pageUrl += `&page=${page}&page_size=50`;

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
        processAvailableStages(allCalls);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (fetchTrigger > 0) {
      fetchData();
    }
  }, [campaignId, fetchTrigger, endDate]);

  // Process available stages from API data and group by phone number
  const processAvailableStages = (calls) => {
    if (!calls || calls.length === 0) {
      console.log("No calls to process");
      return;
    }

    console.log("=== STARTING STAGE PROCESSING ===");
    console.log("Total calls from API:", calls.length);
    console.log("First 5 calls:", calls.slice(0, 5));

    // Group calls by phone number to create multi-stage records
    const groupedCalls = {};
    const stages = new Set();

    calls.forEach((call, index) => {
      const phoneKey = call.number;
      
      if (!groupedCalls[phoneKey]) {
        groupedCalls[phoneKey] = {
          id: call.id,
          number: call.number,
          list_id: call.list_id,
          first_timestamp: call.timestamp,
          stages: [],
          voice: call.voice || "-"
        };
      } else {
        // This phone number already exists - multi-stage call!
        console.log(`Multi-stage detected for ${phoneKey}:`, {
          existingStages: groupedCalls[phoneKey].stages.length,
          newStage: call.stage,
          category: call.category
        });
      }

      // Add this call as a stage
      groupedCalls[phoneKey].stages.push({
        stage: call.stage,
        category: call.category,
        category_color: call.category_color,
        voice: call.voice || "-",
        timestamp: call.timestamp,
        transcription: call.transcription
      });

      stages.add(call.stage);
    });

    // Sort stages for each grouped call
    Object.values(groupedCalls).forEach(call => {
      call.stages.sort((a, b) => a.stage - b.stage);
    });

    const multiStageCalls = Object.values(groupedCalls).filter(c => c.stages.length > 1);
    console.log("=== GROUPING RESULTS ===");
    console.log("Total unique phone numbers:", Object.keys(groupedCalls).length);
    console.log("Calls with multiple stages:", multiStageCalls.length);
    console.log("Multi-stage examples:", multiStageCalls.slice(0, 3));
    console.log("All stage numbers found:", Array.from(stages).sort((a, b) => a - b));

    const stagesArray = Array.from(stages).sort((a, b) => a - b);
    setAvailableStages(stagesArray);

    // Convert grouped calls to array
    const groupedCallsArray = Object.values(groupedCalls);
    
    console.log("=== FINAL DATA ===");
    console.log("Final grouped calls array length:", groupedCallsArray.length);
    console.log("Sample single-stage call:", groupedCallsArray.find(c => c.stages.length === 1));
    console.log("Sample multi-stage call:", groupedCallsArray.find(c => c.stages.length > 1));
    
    setDashboardData(prev => ({
      ...prev,
      calls: groupedCallsArray,
      originalCalls: calls
    }));

    // Initialize stage filters
    const initialFilters = {};
    stagesArray.forEach(stageNum => {
      initialFilters[`stage${stageNum}`] = [];
    });
    setStageFilters(initialFilters);
    
    console.log("=== PROCESSING COMPLETE ===");
  };

  // Get unique categories for each stage with counts
  const getStageCategories = (stageNumber) => {
    if (!dashboardData?.calls) return [];
    
    const categoryCounts = {};
    let totalForStage = 0;
    
    dashboardData.calls.forEach(call => {
      if (call.stages && Array.isArray(call.stages)) {
        // Find the stage with matching stage number
        const stageData = call.stages.find(s => s.stage === stageNumber);
        if (stageData && stageData.category) {
          categoryCounts[stageData.category] = (categoryCounts[stageData.category] || 0) + 1;
          totalForStage++;
        }
      }
    });
    
    return Object.keys(categoryCounts).sort().map(cat => ({
      name: cat,
      count: categoryCounts[cat],
      percentage: totalForStage > 0 ? Math.round((categoryCounts[cat] / totalForStage) * 100) : 0
    }));
  };

  // Calculate overall percentage of selected filters
  const calculateSelectedFiltersPercentage = () => {
    if (!dashboardData?.calls) return 0;
    
    const totalCalls = dashboardData.calls.length;
    if (totalCalls === 0) return 0;
    
    // Check if any filters are selected
    const hasFilters = availableStages.some(stageNum => {
      const filterKey = `stage${stageNum}`;
      return stageFilters[filterKey]?.length > 0;
    });
    
    if (!hasFilters) return 100; // No filters selected means 100%
    
    const matchingCalls = dashboardData.calls.filter(call => {
      // Check if call matches all selected stage filters
      for (let stageNum of availableStages) {
        const filterKey = `stage${stageNum}`;
        const selectedCategories = stageFilters[filterKey] || [];
        
        if (selectedCategories.length > 0) {
          const stageData = call.stages?.find(s => s.stage === stageNum);
          if (!stageData || !selectedCategories.includes(stageData.category)) {
            return false;
          }
        }
      }
      return true;
    });
    
    return Math.round((matchingCalls.length / totalCalls) * 100);
  };

  // Get category color from API
  const getCategoryColor = (category) => {
    if (!dashboardData?.all_categories) return "#6c757d";
    
    const cat = dashboardData.all_categories.find(
      (c) => c.name === category || c.original_name === category
    );
    return cat?.color || "#6c757d";
  };

  const styles = {
    body: {
      margin: 0,
      padding: 0,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
      color: "#dc3545",
    },
    badge: {
      backgroundColor: "#dc3545",
      color: "white",
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "13px",
      fontWeight: 500,
    },
    adminBadge: {
      backgroundColor: "#fff3cd",
      color: "#856404",
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
      backgroundColor: "#dc3545",
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
    filterSection: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "20px",
      marginTop: "24px",
      marginBottom: "20px",
    },
    filterBox: {
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      padding: "16px",
      backgroundColor: "#fafafa",
    },
    filterTitle: {
      fontSize: "14px",
      fontWeight: 600,
      marginBottom: "12px",
      color: "#333",
    },
    checkboxGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    checkboxItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      cursor: "pointer",
    },
  };

  // Filter and sort records
  const filteredCallRecords = (dashboardData?.calls || [])
    .filter((record) => {
      // Filter by search text
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const phoneMatch = record.number?.toLowerCase().includes(searchLower);
        const voiceMatch = record.voice_name?.toLowerCase().includes(searchLower);
        
        // Check if any stage category matches
        const stageMatches = record.stages?.some(stage => 
          stage.category?.toLowerCase().includes(searchLower)
        );
        
        if (!phoneMatch && !voiceMatch && !stageMatches) {
          return false;
        }
      }

      // Filter by stage categories
      for (let stageNum of availableStages) {
        const filterKey = `stage${stageNum}`;
        const selectedCategories = stageFilters[filterKey] || [];
        
        if (selectedCategories.length > 0) {
          const stageData = record.stages?.find(s => s.stage === stageNum);
          if (!stageData || !selectedCategories.includes(stageData.category)) {
            return false;
          }
        }
      }

      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "phone":
          aValue = a.number?.toLowerCase() || "";
          bValue = b.number?.toLowerCase() || "";
          break;
        case "voice":
          aValue = a.voice_name?.toLowerCase() || "";
          bValue = b.voice_name?.toLowerCase() || "";
          break;
        case "timestamp":
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        default:
          // Handle dynamic stage sorting
          if (sortColumn.startsWith("stage")) {
            const stageNum = parseInt(sortColumn.replace("stage", ""));
            const aStage = a.stages?.find(s => s.stage === stageNum);
            const bStage = b.stages?.find(s => s.stage === stageNum);
            aValue = aStage?.category?.toLowerCase() || "";
            bValue = bStage?.category?.toLowerCase() || "";
          } else {
            aValue = a.id;
            bValue = b.id;
          }
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Pagination
  const RECORDS_PER_PAGE = 25;
  const totalFilteredRecords = filteredCallRecords.length;
  const totalPages = Math.ceil(totalFilteredRecords / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const endIndex = startIndex + RECORDS_PER_PAGE;
  const paginatedRecords = filteredCallRecords.slice(startIndex, endIndex);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleShowTranscript = (transcript, stageName) => {
    setSelectedTranscript(transcript);
    setSelectedStage(stageName);
    setShowTranscriptModal(true);
  };

  const handleCloseTranscriptModal = () => {
    setShowTranscriptModal(false);
    setSelectedTranscript(null);
    setSelectedStage("");
  };

  const handleReset = () => {
    setSearchText("");
    setStartDate("2025-12-22");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    
    // Reset all stage filters
    const resetFilters = {};
    availableStages.forEach(stageNum => {
      resetFilters[`stage${stageNum}`] = [];
    });
    setStageFilters(resetFilters);
    setCurrentPage(1);
    setFetchTrigger((prev) => prev + 1);
  };

  const handleStageFilterToggle = (stageNum, category) => {
    const filterKey = `stage${stageNum}`;
    setStageFilters(prev => ({
      ...prev,
      [filterKey]: prev[filterKey]?.includes(category)
        ? prev[filterKey].filter(c => c !== category)
        : [...(prev[filterKey] || []), category]
    }));
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setFetchTrigger((prev) => prev + 1);
  };

  if (loading && fetchTrigger > 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "red", textAlign: "center" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.welcomeText}>
            <i className="bi bi-shield-check" style={{ fontSize: "20px" }}></i>
            <span><strong>Admin Dashboard</strong></span>
          </div>
          <span style={styles.adminBadge}>
            <i className="bi bi-gear-fill"></i> Administrator
          </span>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.btn} onClick={() => window.location.href = "/admin-landing"}>
            <i className="bi bi-house-fill"></i> Back to Home
          </button>
          <button
            style={{ ...styles.btn, ...(currentView === "dashboard" ? styles.btnPrimary : {}) }}
            onClick={() => setCurrentView("dashboard")}
          >
            <i className="bi bi-bar-chart-fill"></i> Dashboard
          </button>
          <button style={styles.btn} onClick={() => window.location.href = `/recordings?campaign_id=${campaignId}`}>
            <i className="bi bi-mic-fill"></i> Recordings
          </button>
          <button style={styles.btn} onClick={() => {
            localStorage.clear();
            window.location.href = "/";
          }}>
            <i className="bi bi-box-arrow-right"></i> Logout
          </button>
        </div>
      </div>

      <div style={styles.container}>
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
              placeholder="Search by phone number, voice, or category..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={styles.datetimeRow}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Start Date (US EST/EDT)</label>
              <input
                type="date"
                style={styles.input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Start Time (US EST/EDT)</label>
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

          {/* Dynamic Stage Filters */}
          {availableStages.length > 0 && (
            <>
              <div style={styles.filterSection}>
                {availableStages.map(stageNum => {
                  const categories = getStageCategories(stageNum);
                  const filterKey = `stage${stageNum}`;
                  
                  return (
                    <div key={stageNum} style={styles.filterBox}>
                      <div style={styles.filterTitle}>
                        <i className="bi bi-funnel-fill"></i> Stage {stageNum} Categories
                      </div>
                      <div style={styles.checkboxGroup}>
                        {categories.map(categoryData => (
                          <label key={categoryData.name} style={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              checked={stageFilters[filterKey]?.includes(categoryData.name) || false}
                              onChange={() => handleStageFilterToggle(stageNum, categoryData.name)}
                              style={{ cursor: "pointer" }}
                            />
                            <span style={{ color: getCategoryColor(categoryData.name), fontWeight: 500, flex: 1 }}>
                              {categoryData.name}
                            </span>
                            <span style={{ fontSize: "12px", color: "#666", fontWeight: 600, marginLeft: "8px" }}>
                              {categoryData.percentage}%
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Show overall percentage if filters are selected */}
              {availableStages.some(stageNum => stageFilters[`stage${stageNum}`]?.length > 0) && (
                <div style={{
                  backgroundColor: "#e8f4fd",
                  border: "1px solid #1a73e8",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <i className="bi bi-info-circle-fill" style={{ color: "#1a73e8", fontSize: "18px" }}></i>
                    <span style={{ fontWeight: 500, color: "#333" }}>
                      Selected Filters Match
                    </span>
                  </div>
                  <div style={{
                    backgroundColor: "#1a73e8",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "16px"
                  }}>
                    {calculateSelectedFiltersPercentage()}% of total calls
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
            <button onClick={handleApplyFilters} style={{ ...styles.btn, ...styles.btnPrimary }}>
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
        </div>

        {/* Call Records Table */}
        <div style={styles.section}>
          <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={styles.sectionTitle}>
                <i className="bi bi-telephone-fill"></i>
                <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
                  Call Records ({totalFilteredRecords} total)
                </h2>
              </div>
              <p style={{ ...styles.timezoneNote, margin: 0 }}>
                All times are displayed in US Eastern Time (EST/EDT)
              </p>
            </div>
            <div style={{ minWidth: "300px" }}>
              <input
                type="text"
                style={styles.searchInput}
                placeholder="Search calls..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
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
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      #
                      {sortColumn === "id" && (
                        <i className={`bi bi-chevron-${sortDirection === "asc" ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      Phone No
                      {sortColumn === "phone" && (
                        <i className={`bi bi-chevron-${sortDirection === "asc" ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("voice")}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      Voice
                      {sortColumn === "voice" && (
                        <i className={`bi bi-chevron-${sortDirection === "asc" ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
                      )}
                    </div>
                  </th>
                  
                  {/* Dynamic stage columns */}
                  {availableStages.map(stageNum => (
                    <React.Fragment key={stageNum}>
                      <th
                        onClick={() => handleSort(`stage${stageNum}`)}
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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          Stage {stageNum}
                          {sortColumn === `stage${stageNum}` && (
                            <i className={`bi bi-chevron-${sortDirection === "asc" ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
                          )}
                        </div>
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500, color: "#333", fontSize: "13px" }}>
                        Stage {stageNum} Transcript
                      </th>
                    </React.Fragment>
                  ))}
                  
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      Timestamp (US EST/EDT)
                      {sortColumn === "timestamp" && (
                        <i className={`bi bi-chevron-${sortDirection === "asc" ? "up" : "down"}`} style={{ fontSize: "12px" }}></i>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={3 + (availableStages.length * 2) + 1} style={{ textAlign: "center", color: "#888", padding: 24 }}>
                      No call records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => (
                    <tr
                      key={record.id}
                      style={{ borderBottom: "1px solid #f0f0f0", transition: "background-color 0.2s" }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#333" }}>
                        {record.id}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#333" }}>
                        {record.number || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#333" }}>
                        {record.voice || record.stages?.[0]?.voice || "-"}
                      </td>
                      
                      {/* Dynamic stage data */}
                      {availableStages.map(stageNum => {
                        const stageData = record.stages?.find(s => s.stage === stageNum);
                        
                        return (
                          <React.Fragment key={stageNum}>
                            <td style={{ padding: "12px 16px" }}>
                              {stageData ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    backgroundColor: stageData.category_color || getCategoryColor(stageData.category),
                                    color: "white",
                                  }}
                                >
                                  {stageData.category}
                                </span>
                              ) : (
                                <span style={{ color: "#999" }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: "13px", color: "#333", maxWidth: "300px" }}>
                              {stageData?.transcription ? (
                                <div
                                  style={{
                                    backgroundColor: "#f8f9fa",
                                    borderRadius: "6px",
                                    padding: "8px 12px",
                                    fontSize: "12px",
                                    lineHeight: "1.5",
                                    color: "#333",
                                    maxHeight: "120px",
                                    overflowY: "auto",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    border: "1px solid #e5e5e5"
                                  }}
                                >
                                  {stageData.transcription}
                                </div>
                              ) : (
                                <span style={{ color: "#999" }}>-</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#333" }}>
                        {record.first_timestamp || record.timestamp || "-"}
                      </td>
                    </tr>
                  ))
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
              {Math.min(endIndex, totalFilteredRecords)} of {totalFilteredRecords} records
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

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
                        border: page === currentPage ? "none" : "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: page === currentPage ? "#dc3545" : "white",
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
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
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
      </div>

      {/* Mobile Responsive Styles */}
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        th[style*="cursor: pointer"]:hover {
          background-color: #f5f5f5;
          transition: background-color 0.2s;
        }
        
        @media (max-width: 768px) {
          .transcript-modal-container {
            padding: 10px !important;
            align-items: flex-start !important;
          }
          
          body > div > div:first-child {
            padding: 16px !important;
          }
          
          header > div {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          
          button {
            font-size: 13px !important;
            padding: 6px 12px !important;
          }
          
          table {
            font-size: 11px !important;
          }
          
          th, td {
            padding: 8px 6px !important;
            font-size: 11px !important;
          }
          
          .transcript-modal-container > div > div {
            padding: 16px !important;
          }
          
          div[style*="pagination"] {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
        
        @media (max-width: 480px) {
          body {
            font-size: 14px !important;
          }
          
          section, div[style*="section"] {
            padding: 16px !important;
          }
          
          .transcript-modal-container {
            padding: 0 !important;
          }
          
          .transcript-modal-container > div {
            max-height: 100vh !important;
            border-radius: 0 !important;
          }
          
          span[style*="borderRadius: '4px'"] {
            font-size: 10px !important;
            padding: 3px 6px !important;
          }
          
          h2, h3 {
            font-size: 16px !important;
          }
          
          h4 {
            font-size: 14px !important;
          }
          
          button i.bi-file-text + span {
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

export default AdminDashboard;