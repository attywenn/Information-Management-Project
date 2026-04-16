import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPatientDirectory,
  fetchPatientAccountDetail,
  fetchPatientAuditLogs,
  changePatientPasswordByAdmin,
  deletePatientAccountByAdmin,
} from "../services/supabaseBackendService";

export default function PatientAccountManagement() {
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [showAllConsultationsModal, setShowAllConsultationsModal] = useState(false);

  const getAccountUserId = (account) => account?.userId || account?.user_id || account?.id || "";

  const formatPatientName = (patient) => {
    const surname = patient?.surname || "";
    const firstname = patient?.firstname || "";
    const middlename = patient?.middlename || "";
    
    const parts = [surname, firstname];
    if (middlename) parts.push(middlename);
    
    return parts.filter(p => p).join(", ");
  };

  const getAvatarUrl = (item) => {
    // Support both avatar_url from profiles and direct avatarDataUrl
    return item?.avatar_url || item?.avatarDataUrl || "";
  };

  const renderAvatar = (url, name, size = "h-8 w-8") => {
    const avatarUrl = getAvatarUrl({ avatar_url: url });
    return (
      <div className={`${size} rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-gray-600">
            {(name || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  const selectedPatientUserId = getAccountUserId(selectedPatient);

  const {
    data: patients = [],
    isLoading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["patient-directory", 1, 50],
    queryFn: () => fetchPatientDirectory({ page: 1, pageSize: 50 }),
    staleTime: 60_000,
  });

  const {
    data: patientDetail,
    isLoading: patientDetailLoading,
    error: patientDetailError,
  } = useQuery({
    queryKey: ["patient-account-detail", selectedPatientUserId],
    queryFn: () => fetchPatientAccountDetail(selectedPatientUserId, { page: 1, pageSize: 25 }),
    enabled: Boolean(selectedPatientUserId),
    staleTime: 30_000,
  });

  const {
    data: auditLogs = [],
    isLoading: auditLogsLoading,
    error: auditLogsError,
  } = useQuery({
    queryKey: ["patient-audit-logs", selectedPatientUserId],
    queryFn: () => fetchPatientAuditLogs(selectedPatientUserId, { page: 1, pageSize: 50 }),
    enabled: Boolean(selectedPatientUserId),
    staleTime: 30_000,
  });

  const handleSelectPatient = async (patient) => {
    try {
      const patientUserId = getAccountUserId(patient);
      if (!patientUserId) {
        throw new Error("Selected patient is missing a user identifier.");
      }

      setError(null);
      setSelectedPatient(patient);
    } catch (err) {
      setError(err.message || "Failed to load patient details.");
    }
  };

  const handleChangePassword = async () => {
    const patientUserId = getAccountUserId(selectedPatient);

    if (!patientUserId) {
      setPasswordError("Selected patient is missing a user identifier.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError(null);

      await changePatientPasswordByAdmin({
        patientUserId,
        newPassword,
      });

      setPasswordError(null);
      setShowPasswordModal(false);
      setNewPassword("");
      alert("Patient password changed successfully.");
    } catch (err) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    const patientUserId = getAccountUserId(selectedPatient);

    if (!patientUserId) {
      setDeleteError("Selected patient is missing a user identifier.");
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      await deletePatientAccountByAdmin({
        patientUserId,
        reason: deleteReason,
      });

      setDeleteError(null);
      setShowDeleteModal(false);
      setDeleteReason("");
      setSelectedPatient(null);
      alert("Patient account deleted successfully.");
      queryClient.removeQueries({ queryKey: ["patient-account-detail"] });
      queryClient.removeQueries({ queryKey: ["patient-audit-logs"] });
      refetchPatients();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete patient.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const loading = patientsLoading || patientDetailLoading || auditLogsLoading;
  const effectiveError =
    error ||
    patientsError?.message ||
    patientDetailError?.message ||
    auditLogsError?.message ||
    null;

  // Filter patients based on search term
  const filteredPatients = patients.filter((patient) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (patient.firstname && patient.firstname.toLowerCase().includes(searchLower)) ||
      (patient.surname && patient.surname.toLowerCase().includes(searchLower)) ||
      (patient.phone && patient.phone.includes(searchLower))
    );
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Patient Account Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Directory */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Patient Directory</h2>

            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {effectiveError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">{effectiveError}</div>}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <p className="text-gray-500 text-sm">No patients found.</p>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      key={getAccountUserId(patient)}
                      onClick={() => handleSelectPatient(patient)}
                      className={`w-full text-left px-3 py-2 rounded transition flex items-center gap-3 ${
                        getAccountUserId(selectedPatient) === getAccountUserId(patient)
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {renderAvatar(patient.avatarDataUrl, formatPatientName(patient), "h-10 w-10")}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {formatPatientName(patient)}
                        </div>
                        <div className="text-xs opacity-75 truncate">{patient.email || patient.phone || "N/A"}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-2">
          {selectedPatient && patientDetail ? (
            <div className="space-y-6">
              {/* Account Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start gap-6 mb-6">
                  {renderAvatar(patientDetail?.profile?.avatar_url || patientDetail?.profile?.avatarDataUrl, formatPatientName(patientDetail?.profile), "h-24 w-24")}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Account Information</h3>
                    <p className="text-sm text-gray-600">
                      {patientDetail?.profile?.surname}, {patientDetail?.profile?.firstname}
                      {patientDetail?.profile?.middlename && ` ${patientDetail?.profile?.middlename}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-800">
                      {patientDetail.profile.surname}, {patientDetail.profile.firstname}
                      {patientDetail.profile.middlename && `, ${patientDetail.profile.middlename}`}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-800">{patientDetail.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Phone</label>
                    <p className="text-gray-800">{patientDetail.profile.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Date of Birth</label>
                    <p className="text-gray-800">{patientDetail.profile.dob || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Gender</label>
                    <p className="text-gray-800">{patientDetail.profile.gender || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <p className="text-green-600 font-medium">Active</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm font-medium"
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm font-medium"
                  >
                    Delete Account
                  </button>
                </div>
              </div>

              {/* Consultations */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Consultations ({patientDetail.consultations.length})
                </h3>

                {patientDetail.consultations.length === 0 ? (
                  <p className="text-gray-500 text-sm">No consultations found.</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {patientDetail.consultations.slice(0, 3).map((consultation, index) => (
                        <div key={index} className="border border-gray-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800">{consultation.diagnosis || "Consultation"}</p>
                              <p className="text-xs text-gray-600">
                                {new Date(consultation.completed_at).toLocaleDateString()} at {new Date(consultation.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              completed
                            </span>
                          </div>
                          {consultation.note && <p className="text-sm text-gray-600 mt-2">{consultation.note}</p>}
                        </div>
                      ))}
                    </div>
                    {patientDetail.consultations.length > 4 && (
                      <button
                        onClick={() => setShowAllConsultationsModal(true)}
                        className="mt-4 w-full px-4 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition text-sm font-medium"
                      >
                        See All Consultations
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Medicine/Assistive Devices History */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Medicine/Assistive Devices History</h3>

                {auditLogs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No medicine or assistive devices dispensed.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {auditLogs.map((log, index) => (
                      <div key={index} className="text-sm border-l-4 border-green-300 pl-3 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-700">
                              {log.inventory_items?.name || "Unknown Item"}
                              {log.inventory_items?.category && ` (${log.inventory_items.category.toUpperCase()})`}
                            </p>
                            <p className="text-xs text-gray-600">Quantity: {log.quantity} {log.inventory_items?.unit || "units"}</p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">Select a patient to view details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Patient Password</h3>

            {passwordError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                {passwordError}
              </div>
            )}

            <input
              type="password"
              placeholder="New Password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                  setPasswordError(null);
                }}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50"
              >
                {passwordLoading ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Delete Patient Account</h3>

            <p className="text-gray-700 mb-4 text-sm">
              Are you sure you want to delete the account for {selectedPatient?.surname}, {selectedPatient?.firstname}?
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                {deleteError}
              </div>
            )}

            <textarea
              placeholder="Reason for deletion (optional)"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              rows="3"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason("");
                  setDeleteError(null);
                }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePatient}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* See All Consultations Modal */}
      {showAllConsultationsModal && patientDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-96 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">All Consultations</h3>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {patientDetail.consultations.length === 0 ? (
                <p className="text-gray-500 text-sm">No consultations found.</p>
              ) : (
                patientDetail.consultations.map((consultation, index) => (
                  <div key={index} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{consultation.diagnosis || "Consultation"}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(consultation.completed_at).toLocaleDateString()} at {new Date(consultation.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        completed
                      </span>
                    </div>
                    {consultation.note && <p className="text-sm text-gray-600 mt-2">{consultation.note}</p>}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowAllConsultationsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
