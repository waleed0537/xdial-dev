import React, { useState, useEffect, useRef } from "react";

const ClientRecordings = () => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaignId, setCampaignId] = useState(null);
  const [clientName, setClientName] = useState("");
  
  // Filter states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchText, setSearchText] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("time");
  const [sortDir, setSortDir] = useState("desc");
  
  // Pagination data
  const [pagination, setPagination] = useState(null);
  const [totalServersQueried, setTotalServersQueried] = useState(0);
  const [serversWithData, setServersWithData] = useState(0);
  
  // Audio player states
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentRecording, setCurrentRecording] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef(null);

  // Get campaign ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('campaign_id');
    if (id) {
      setCampaignId(id);
    } else {
      window.location.href = '/client-landing';
    }
  }, []);

  // Fetch client name
  const fetchClientName = async () => {
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!token || !campaignId) return;

      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `https://api.xlitecore.xdialnetworks.com/api/v1/campaigns/${campaignId}/dashboard?start_date=${today}&page=1&page_size=1`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClientName(data.client_name || "Client");
      }
    } catch (err) {
      console.error("Failed to fetch client name:", err);
    }
  };

  // Fetch client name when campaignId is available
  useEffect(() => {
    if (campaignId) {
      fetchClientName();
    }
  }, [campaignId]);

  // Fetch recordings
  useEffect(() => {
    if (campaignId) {
      fetchRecordings();
    }
  }, [campaignId, selectedDate, currentPage, pageSize, sortBy, sortDir]);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      const url = `https://api.xlitecore.xdialnetworks.com/api/v1/recordings/campaign/${campaignId}?date=${selectedDate}&page=${currentPage}&page_size=${pageSize}&sort_by=${sortBy}&sort_dir=${sortDir}`;
      
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok) {
        throw new Error("Failed to fetch recordings");
      }

      const data = await response.json();
      setRecordings(data.recordings || []);
      setPagination(data.pagination);
      setTotalServersQueried(data.total_servers_queried || 0);
      setServersWithData(data.servers_with_data || 0);
      setError(null);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("login")) {
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter recordings by search text
  const filteredRecordings = recordings.filter(recording => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      recording.phone_number?.toLowerCase().includes(searchLower) ||
      recording.extension?.toString().includes(searchLower) ||
      recording.server_name?.toLowerCase().includes(searchLower)
    );
  });

  // Audio player functions
  const playRecording = (recording, index) => {
    setCurrentRecording(recording);
    setCurrentRowIndex(index);
    setShowPlayer(true);
    
    if (audioRef.current) {
      audioRef.current.src = recording.file_url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (currentRowIndex < filteredRecordings.length - 1) {
      playRecording(filteredRecordings[currentRowIndex + 1], currentRowIndex + 1);
    }
  };

  const playPrevious = () => {
    if (currentRowIndex > 0) {
      playRecording(filteredRecordings[currentRowIndex - 1], currentRowIndex - 1);
    }
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setShowPlayer(false);
    setIsPlaying(false);
    setCurrentRecording(null);
    setCurrentRowIndex(-1);
  };

  const seekAudio = (e) => {
    if (audioRef.current) {
      const progressBar = e.currentTarget;
      const clickX = e.nativeEvent.offsetX;
      const width = progressBar.offsetWidth;
      const percentage = clickX / width;
      audioRef.current.currentTime = audioRef.current.duration * percentage;
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadRecording = (recording) => {
    // Open the recording URL - browser will download or open in new tab
    window.open(recording.file_url, '_blank');
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const getCategoryBadgeClass = (category) => {
    const categoryUpper = category?.toUpperCase();
    if (categoryUpper?.includes("ANSWERED") || categoryUpper?.includes("HUMAN")) {
      return "badge-green";
    } else if (categoryUpper?.includes("VOICEMAIL") || categoryUpper?.includes("MACHINE")) {
      return "badge-blue";
    } else if (categoryUpper?.includes("NO_ANSWER") || categoryUpper?.includes("BUSY")) {
      return "badge-yellow";
    } else if (categoryUpper?.includes("EXTERNAL")) {
      return "badge-purple";
    } else if (categoryUpper?.includes("ERROR") || categoryUpper?.includes("FAILED")) {
      return "badge-red";
    }
    return "badge-gray";
  };

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      
      if (autoplayEnabled && currentRowIndex < filteredRecordings.length - 1) {
        setTimeout(() => {
          playNext();
        }, 500);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [autoplayEnabled, currentRowIndex, filteredRecordings]);

  return (
    <>
      <style>{styles}</style>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", backgroundColor: "#f5f5f5", paddingBottom: "80px", minHeight: "100vh" }}>
        {/* Header */}
        <header style={{ backgroundColor: "#fff", borderBottom: "1px solid #e5e5e5", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#1a73e8" }}>
              <i className="bi bi-telephone-fill" style={{ fontSize: "20px" }}></i>
              <span>
                <strong>Welcome back, {clientName || "Client"}!</strong>
              </span>
            </div>
            <span style={{ backgroundColor: "#1a73e8", color: "white", padding: "4px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: 500 }}>
              Ext: {campaignId || "N/A"}
            </span>
            <span style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", padding: "4px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
              <i className="bi bi-person-circle"></i> Client View
            </span>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button 
              className="btn btn-outline"
              onClick={() => window.location.href = `/dashboard?campaign_id=${campaignId}`}
            >
              <i className="bi bi-bar-chart-fill"></i> Reports
            </button>
            
            <button className="btn btn-primary">
              <i className="bi bi-mic-fill"></i> Recordings
            </button>

            <button
  className="btn btn-outline"
  onClick={() => {
    sessionStorage.setItem("from_recordings", "true");
    window.location.href = `/data-export?campaign_id=${campaignId}`;
  }}
>
  <i className="bi bi-download"></i> Data Export
</button>

            
            <button     
              className="btn btn-outline"
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
        </header>

        {/* Main Content */}
        <main style={{ padding: "24px" }}>
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            {/* Page Header */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <i className="bi bi-file-earmark-music" style={{ color: "#3b82f6" }}></i>
                Call Recordings
                <span style={{ fontSize: "1.125rem", fontWeight: 400, color: "#6b7280" }}>- Extension {campaignId || "N/A"}</span>
              </h1>
              <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>
                Listen to and download your call recordings
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert" style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }}>
                <i className="bi bi-exclamation-circle"></i>
                <div>{error}</div>
              </div>
            )}

            {/* Filters Card */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  {/* Date Picker */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <i className="bi bi-calendar"></i>
                      Date
                    </label>
                    <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="input"
                    />
                  </div>

                  {/* Search */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <i className="bi bi-search"></i>
                      Search
                    </label>
                    <input 
                      type="text" 
                      placeholder="Search phone number, server..." 
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="input"
                    />
                  </div>

                  {/* Page Size */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
                      Records per page
                    </label>
                    <select 
                      className="select"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value="25">25 per page</option>
                      <option value="50">50 per page</option>
                      <option value="100">100 per page</option>
                      <option value="200">200 per page</option>
                    </select>
                  </div>

                  {/* Refresh Button */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
                      Actions
                    </label>
                    <button 
                      className="btn btn-outline" 
                      style={{ width: "100%" }}
                      onClick={fetchRecordings}
                      disabled={loading}
                    >
                      <i className="bi bi-arrow-clockwise" style={{ marginRight: "0.5rem" }}></i>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            {!loading && (
              <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                    Found {pagination?.total_records || 0} recordings for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                
                <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  Page {pagination?.page || 1} of {pagination?.total_pages || 1}
                </p>
              </div>
            )}

            {/* Recordings Table */}
            {!loading && (
              <div className="card">
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort("time")} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            Time
                            <i className={`fas fa-chevron-${sortBy === "time" ? (sortDir === "desc" ? "down" : "up") : "down"} sort-icon`} style={{ opacity: sortBy === "time" ? 1 : 0 }}></i>
                          </div>
                        </th>
                        <th onClick={() => handleSort("phone_number")} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            Phone Number
                            <i className={`fas fa-chevron-${sortBy === "phone_number" ? (sortDir === "desc" ? "down" : "up") : "up"} sort-icon`} style={{ opacity: sortBy === "phone_number" ? 1 : 0 }}></i>
                          </div>
                        </th>
                        <th onClick={() => handleSort("duration")} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            Duration
                            <i className={`fas fa-chevron-${sortBy === "duration" ? (sortDir === "desc" ? "down" : "up") : "up"} sort-icon`} style={{ opacity: sortBy === "duration" ? 1 : 0 }}></i>
                          </div>
                        </th>
                        <th onClick={() => handleSort("size")} style={{ cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            Size
                            <i className={`fas fa-chevron-${sortBy === "size" ? (sortDir === "desc" ? "down" : "up") : "up"} sort-icon`} style={{ opacity: sortBy === "size" ? 1 : 0 }}></i>
                          </div>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecordings.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
                            No recordings found for the selected date.
                          </td>
                        </tr>
                      ) : (
                        filteredRecordings.map((recording, index) => (
                          <tr 
                            key={index}
                            className={currentRowIndex === index && showPlayer ? "playing" : ""}
                          >
                            <td>{recording.time}</td>
                            <td style={{ fontWeight: 500 }}>{recording.phone_number}</td>
                            <td>{recording.duration}</td>
                            <td style={{ color: "#6b7280" }}>{recording.size}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                <button 
                                  className="btn btn-outline btn-sm"
                                  onClick={() => playRecording(recording, index)}
                                >
                                  <i className="bi bi-play-fill" style={{ marginRight: "0.25rem" }}></i>
                                  Play
                                </button>
                                <button 
                                  className="btn btn-outline btn-sm"
                                  onClick={() => downloadRecording(recording)}
                                >
                                  <i className="bi bi-download" style={{ marginRight: "0.25rem" }}></i>
                                  Download
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination && pagination.total_pages > 1 && (
                  <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.875rem", color: "#374151" }}>
                          Showing {((pagination.page - 1) * pagination.page_size) + 1} to {Math.min(pagination.page * pagination.page_size, pagination.total_records)} of {pagination.total_records} recordings
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={!pagination.has_prev}
                          style={{ opacity: !pagination.has_prev ? 0.5 : 1, cursor: !pagination.has_prev ? "not-allowed" : "pointer" }}
                        >
                          <i className="bi bi-chevron-double-left"></i>
                        </button>
                        
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={!pagination.has_prev}
                          style={{ opacity: !pagination.has_prev ? 0.5 : 1, cursor: !pagination.has_prev ? "not-allowed" : "pointer" }}
                        >
                          <i className="bi bi-chevron-left" style={{ marginRight: "0.25rem" }}></i>
                          Previous
                        </button>
                        
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {(() => {
                            const pages = [];
                            const maxPagesToShow = 3;
                            let startPage = Math.max(1, currentPage - 1);
                            let endPage = Math.min(pagination.total_pages, startPage + maxPagesToShow - 1);
                            
                            if (endPage - startPage < maxPagesToShow - 1) {
                              startPage = Math.max(1, endPage - maxPagesToShow + 1);
                            }
                            
                            for (let i = startPage; i <= endPage; i++) {
                              pages.push(i);
                            }
                            
                            return pages.map((page) => (
                              <button
                                key={page}
                                className={`btn btn-sm pagination-btn ${page === currentPage ? "btn-primary" : "btn-outline"}`}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </button>
                            ));
                          })()}
                        </div>
                        
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!pagination.has_next}
                          style={{ opacity: !pagination.has_next ? 0.5 : 1, cursor: !pagination.has_next ? "not-allowed" : "pointer" }}
                        >
                          Next
                          <i className="bi bi-chevron-right" style={{ marginLeft: "0.25rem" }}></i>
                        </button>
                        
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => setCurrentPage(pagination.total_pages)}
                          disabled={!pagination.has_next}
                          style={{ opacity: !pagination.has_next ? 0.5 : 1, cursor: !pagination.has_next ? "not-allowed" : "pointer" }}
                        >
                          <i className="bi bi-chevron-double-right"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Minimalistic Audio Player */}
        <div className={`audio-player ${showPlayer ? "active" : ""}`}>
          <audio ref={audioRef}></audio>
          <div className="player-container">
            {/* Left: Recording Info */}
            <div className="player-left">
              <div className="player-info">
                <div className="player-phone">{currentRecording?.phone_number || "N/A"}</div>
                <div className="player-meta">
                  {currentRecording?.server_name || "N/A"} • {currentRecording?.time?.split(', ')[1] || "N/A"}
                </div>
              </div>
            </div>

            {/* Center: Player Controls */}
            <div className="player-center">
              <button 
                className="control-btn" 
                onClick={playPrevious} 
                disabled={currentRowIndex <= 0}
                title="Previous"
              >
                <i className="bi bi-skip-backward-fill"></i>
              </button>
              
              <button className="play-btn" onClick={togglePlayPause}>
                <i className={`fas fa-${isPlaying ? "pause" : "play"}`}></i>
              </button>
              
              <button 
                className="control-btn" 
                onClick={playNext} 
                disabled={currentRowIndex >= filteredRecordings.length - 1}
                title="Next"
              >
                <i className="bi bi-skip-forward-fill"></i>
              </button>
              
              <div className="progress-wrapper">
                <span className="time">{formatTime(currentTime)}</span>
                <div className="progress-bar" onClick={seekAudio}>
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="time">{currentRecording?.duration || "0:00"}</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="player-right">
              <button 
                className={`icon-btn ${autoplayEnabled ? "active" : ""}`}
                onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                title={`Auto-play: ${autoplayEnabled ? "ON" : "OFF"}`}
              >
                <i className="bi bi-arrow-repeat"></i>
              </button>
              <button className="icon-btn" onClick={closePlayer} title="Close">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      </div>
    </>
  );
};

// Styles
const styles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .btn {
    padding: 8px 16px;
    borderRadius: 4px;
    border: 1px solid #e5e5e5;
    backgroundColor: white;
    cursor: pointer;
    fontSize: 13px;
    fontWeight: 500;
    display: flex;
    alignItems: center;
    gap: 6px;
  }

  .btn-primary {
    background-color: #1a73e8;
    color: white;
    border: none;
  }

  .btn-primary:hover {
    background-color: #1765cc;
  }

  .btn-outline {
    background-color: white;
    color: #333;
    border: 1px solid #e5e5e5;
  }

  .btn-outline:hover {
    background-color: #f5f5f5;
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.813rem;
  }

  .input {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    transition: all 0.15s;
  }

  .input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0.375rem;
  }

  .badge-green {
    background-color: #dcfce7;
    color: #166534;
  }

  .badge-blue {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-yellow {
    background-color: #fef3c7;
    color: #92400e;
  }

  .badge-red {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .badge-purple {
    background-color: #f3e8ff;
    color: #6b21a8;
  }

  .badge-gray {
    background-color: #f3f4f6;
    color: #374151;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    gap: 0.75rem;
  }

  .alert-yellow {
    background-color: #fef3c7;
    border: 1px solid #fde68a;
    color: #92400e;
  }

  .select {
    display: block;
    width: 100%;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: white;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    appearance: none;
  }

  .select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  th {
    padding: 0.75rem 1.5rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    user-select: none;
  }

  th:hover {
    background-color: #f3f4f6;
  }

  td {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    color: #111827;
    border-bottom: 1px solid #f3f4f6;
  }

  tr:hover {
    background-color: #f9fafb;
  }

  tr.playing {
    background-color: #eff6ff;
  }

  .sort-icon {
    display: inline-block;
    margin-left: 0.25rem;
    width: 1rem;
    height: 1rem;
  }

  .pagination-btn {
    min-width: 2.5rem;
  }

  .status-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
  }

  /* Minimalistic Audio Player */
  .audio-player {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05);
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 50;
    height: 64px;
  }

  .audio-player.active {
    transform: translateY(0);
  }

  .player-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    height: 100%;
    max-width: 1280px;
    margin: 0 auto;
  }

  .player-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 200px;
  }

  .player-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .player-phone {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  .player-meta {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .player-center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 600px;
    margin: 0 2rem;
  }

  .control-btn {
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    transition: all 0.2s;
    font-size: 0.875rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover {
    color: #111827;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .play-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    font-size: 0.875rem;
  }

  .play-btn:hover {
    background: #2563eb;
    transform: scale(1.05);
  }

  .progress-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .time {
    font-size: 0.75rem;
    color: #6b7280;
    min-width: 2.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 2px;
    transition: width 0.1s linear;
    position: relative;
  }

  .progress-fill::after {
    content: '';
    position: absolute;
    right: -4px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .progress-bar:hover .progress-fill::after {
    opacity: 1;
  }

  .player-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    transition: color 0.2s;
    font-size: 0.875rem;
  }

  .icon-btn:hover {
    color: #111827;
  }

  .icon-btn.active {
    color: #3b82f6;
  }

  @media (max-width: 768px) {
    .player-container {
      padding: 0 1rem;
    }

    .player-center {
      margin: 0 1rem;
    }

    .player-meta {
      display: none;
    }
  }
`;

export default ClientRecordings;