import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AccessRequest {
  _id: Id<"accessRequests">;
  userId: Id<"users">;
  email: string;
  name: string;
  reason?: string;
  organization?: string;
  status: RequestStatus;
  reviewedAt?: number;
  reviewNote?: string;
  createdAt: number;
}

interface User {
  _id: Id<"users">;
  name?: string;
  email?: string;
  isApproved?: boolean;
  isAdmin?: boolean;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"requests" | "users">("requests");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">("PENDING");
  const [reviewNote, setReviewNote] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Id<"accessRequests"> | null>(null);

  const currentUser = useQuery(api.users.currentUser);

  const accessRequests = useQuery(
    api.users.listAccessRequests,
    { status: statusFilter === "ALL" ? undefined : statusFilter }
  );

  const allUsers = useQuery(api.users.listUsers, {});

  const approveRequest = useMutation(api.users.approveAccessRequest);
  const rejectRequest = useMutation(api.users.rejectAccessRequest);
  const revokeAccess = useMutation(api.users.revokeAccess);
  const makeAdmin = useMutation(api.users.makeAdmin);

  if (!currentUser?.isAdmin) {
    return (
      <div className="admin-unauthorized">
        <h2>🔒 Admin Access Required</h2>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const handleApprove = async (requestId: Id<"accessRequests">) => {
    await approveRequest({
      requestId,
      reviewNote: reviewNote || undefined,
    });
    setReviewNote("");
    setSelectedRequest(null);
  };

  const handleReject = async (requestId: Id<"accessRequests">) => {
    await rejectRequest({
      requestId,
      reviewNote: reviewNote || undefined,
    });
    setReviewNote("");
    setSelectedRequest(null);
  };

  const handleRevokeAccess = async (userId: Id<"users">) => {
    if (confirm("Are you sure you want to revoke this user's access?")) {
      await revokeAccess({
        targetUserId: userId,
      });
    }
  };

  const handleMakeAdmin = async (userId: Id<"users">) => {
    if (confirm("Are you sure you want to make this user an admin?")) {
      await makeAdmin({
        targetUserId: userId,
      });
    }
  };

  const pendingCount = accessRequests?.filter((r: AccessRequest) => r.status === "PENDING").length ?? 0;

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>👑 Admin Dashboard</h1>
        <p>Manage access requests and users</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          Access Requests
          {pendingCount > 0 && (
            <span className="pending-count">{pendingCount}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          All Users ({allUsers?.length ?? 0})
        </button>
      </div>

      {activeTab === "requests" && (
        <div className="admin-section">
          <div className="filter-bar">
            <label>Filter by status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RequestStatus | "ALL")}
              className="form-select"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
          </div>

          {!accessRequests || accessRequests.length === 0 ? (
            <div className="empty-state">
              <p>No {statusFilter.toLowerCase()} access requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {accessRequests.map((request: AccessRequest) => (
                <div
                  key={request._id}
                  className={`request-card ${request.status.toLowerCase()}`}
                >
                  <div className="request-header">
                    <div className="request-info">
                      <h3>{request.name}</h3>
                      <p className="request-email">{request.email}</p>
                    </div>
                    <span className={`status-badge ${request.status.toLowerCase()}`}>
                      {request.status}
                    </span>
                  </div>

                  {request.organization && (
                    <p className="request-org">
                      <strong>Organization:</strong> {request.organization}
                    </p>
                  )}

                  {request.reason && (
                    <div className="request-reason">
                      <strong>Reason:</strong>
                      <p>{request.reason}</p>
                    </div>
                  )}

                  <p className="request-date">
                    Submitted: {new Date(request.createdAt).toLocaleString()}
                  </p>

                  {request.reviewNote && (
                    <div className="review-note-display">
                      <strong>Review Note:</strong>
                      <p>{request.reviewNote}</p>
                    </div>
                  )}

                  {request.status === "PENDING" && (
                    <div className="request-actions">
                      {selectedRequest === request._id ? (
                        <div className="review-form">
                          <textarea
                            className="form-textarea"
                            placeholder="Add a note (optional)..."
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            rows={2}
                          />
                          <div className="action-buttons">
                            <button
                              className="btn btn-success"
                              onClick={() => handleApprove(request._id)}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleReject(request._id)}
                            >
                              ✗ Reject
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedRequest(null);
                                setReviewNote("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => setSelectedRequest(request._id)}
                        >
                          Review Request
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div className="admin-section">
          {!allUsers || allUsers.length === 0 ? (
            <div className="empty-state">
              <p>No users found</p>
            </div>
          ) : (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user: User) => (
                    <tr key={user._id}>
                      <td>{user.name || "—"}</td>
                      <td>{user.email || "—"}</td>
                      <td>
                        <span
                          className={`status-badge ${user.isApproved ? "approved" : "pending"}`}
                        >
                          {user.isApproved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td>
                        {user.isAdmin ? (
                          <span className="role-badge admin">Admin</span>
                        ) : (
                          <span className="role-badge user">User</span>
                        )}
                      </td>
                      <td className="action-cell">
                        {user._id !== currentUser._id && (
                          <>
                            {user.isApproved && !user.isAdmin && (
                              <button
                                className="btn-small btn-danger"
                                onClick={() => handleRevokeAccess(user._id)}
                                title="Revoke Access"
                              >
                                Revoke
                              </button>
                            )}
                            {!user.isAdmin && user.isApproved && (
                              <button
                                className="btn-small btn-secondary"
                                onClick={() => handleMakeAdmin(user._id)}
                                title="Make Admin"
                              >
                                Make Admin
                              </button>
                            )}
                          </>
                        )}
                        {user._id === currentUser._id && (
                          <span className="you-badge">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
