import React from "react";

export default function ClientHeader({
  clientName,
  campaignId,
  activePage, // "reports" | "recordings" | "data-export"
}) {
  const navigate = (path) => {
    window.location.href = `${path}?campaign_id=${campaignId}`;
  };

  const btnClass = (page) =>
    `btn ${activePage === page ? "btn-primary" : "btn-outline"}`;

  return (
    <header
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid #e5e5e5",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      {/* LEFT */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            color: "#1a73e8",
          }}
        >
          <i className="bi bi-telephone-fill" style={{ fontSize: "20px" }}></i>
          <strong>Welcome back, {clientName || "Client"}!</strong>
        </div>

        <span
          style={{
            backgroundColor: "#1a73e8",
            color: "white",
            padding: "4px 12px",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          Ext: {campaignId || "N/A"}
        </span>

        <span
          style={{
            backgroundColor: "#e8f5e9",
            color: "#2e7d32",
            padding: "4px 12px",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i className="bi bi-person-circle"></i> Client View
        </span>
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          className={btnClass("reports")}
          onClick={() => navigate("/dashboard")}
        >
          <i className="bi bi-bar-chart-fill"></i> Reports
        </button>

        <button
          className={btnClass("recordings")}
          onClick={() => navigate("/recordings")}
        >
          <i className="bi bi-mic-fill"></i> Recordings
        </button>

        <button
          className={btnClass("data-export")}
          onClick={() => navigate("/data-export")}
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
  );
}
