import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchHealthWorkerDirectory,
  fetchMedicinesDispensedByHealthWorker,
  fetchConsultationsByHealthWorker,
} from "../services/supabaseBackendService";

export default function HealthWorkerAccountManagement() {
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const getAccountUserId = (account) => account?.userId || account?.user_id || account?.id || "";

  const formatHealthWorkerName = (worker) => {
    const surname = worker?.surname || "";
    const firstname = worker?.firstname || "";
    const middlename = worker?.middlename || "";
    
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

  const selectedWorkerUserId = getAccountUserId(selectedWorker);

  const {
    data: healthWorkers = [],
    isLoading: workersLoading,
    error: workersError,
  } = useQuery({
    queryKey: ["health-worker-directory", 1, 50],
    queryFn: () => fetchHealthWorkerDirectory({ page: 1, pageSize: 50 }),
    staleTime: 60_000,
  });

  const {
    data: medicines = [],
    isLoading: medicinesLoading,
    error: medicinesError,
  } = useQuery({
    queryKey: ["health-worker-medicines", selectedWorkerUserId],
    queryFn: () => fetchMedicinesDispensedByHealthWorker(selectedWorkerUserId, { page: 1, pageSize: 50 }),
    enabled: Boolean(selectedWorkerUserId),
    staleTime: 30_000,
  });

  const {
    data: consultations = [],
    isLoading: consultationsLoading,
    error: consultationsError,
  } = useQuery({
    queryKey: ["health-worker-consultations", selectedWorkerUserId],
    queryFn: () => fetchConsultationsByHealthWorker(selectedWorkerUserId, { page: 1, pageSize: 50 }),
    enabled: Boolean(selectedWorkerUserId),
    staleTime: 30_000,
  });

  const handleSelectWorker = async (worker) => {
    try {
      const workerUserId = getAccountUserId(worker);
      if (!workerUserId) {
        throw new Error("Selected health worker is missing a user identifier.");
      }

      setError(null);
      setSelectedWorker(worker);
    } catch (err) {
      setError(err.message || "Failed to load health worker details.");
    }
  };

  const loading = workersLoading || medicinesLoading || consultationsLoading;
  const workerDetail = selectedWorker;
  const effectiveError =
    error ||
    workersError?.message ||
    medicinesError?.message ||
    consultationsError?.message ||
    null;

  // Filter health workers based on search term
  const filteredWorkers = healthWorkers.filter((worker) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (worker.firstname && worker.firstname.toLowerCase().includes(searchLower)) ||
      (worker.surname && worker.surname.toLowerCase().includes(searchLower)) ||
      (worker.phone && worker.phone.includes(searchLower))
    );
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Health Worker Account Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Worker Directory */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Health Workers</h2>

            <input
              type="text"
              placeholder="Search health workers..."
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
                {filteredWorkers.length === 0 ? (
                  <p className="text-gray-500 text-sm">No health workers found.</p>
                ) : (
                  filteredWorkers.map((worker) => (
                    <button
                      key={getAccountUserId(worker)}
                      onClick={() => handleSelectWorker(worker)}
                      className={`w-full text-left px-3 py-2 rounded transition flex items-center gap-3 ${
                        getAccountUserId(selectedWorker) === getAccountUserId(worker)
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {renderAvatar(worker.avatarDataUrl, formatHealthWorkerName(worker), "h-10 w-10")}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {formatHealthWorkerName(worker)}
                        </div>
                        <div className="text-xs opacity-75 truncate">
                          {worker.specialization || "General"} {worker.phone && `• ${worker.phone}`}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Health Worker Details */}
        <div className="lg:col-span-2">
          {selectedWorker && workerDetail ? (
            <div className="space-y-6">
              {/* Account Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start gap-6 mb-6">
                  {renderAvatar(workerDetail?.avatar_url || workerDetail?.avatarDataUrl, formatHealthWorkerName(workerDetail), "h-24 w-24")}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Account Information</h3>
                    <p className="text-sm text-gray-600">
                      {workerDetail?.surname}, {workerDetail?.firstname}
                      {workerDetail?.middlename && ` ${workerDetail?.middlename}`}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {workerDetail?.specialization || "General"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-800">
                      {workerDetail.surname}, {workerDetail.firstname}
                      {workerDetail.middlename && `, ${workerDetail.middlename}`}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Phone</label>
                    <p className="text-gray-800">{workerDetail.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Specialization</label>
                    <p className="text-gray-800">{workerDetail.specialization || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">License Number</label>
                    <p className="text-gray-800">{workerDetail.license_number || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Location</label>
                    <p className="text-gray-800">{workerDetail.location || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <p className="text-green-600 font-medium">Active</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Health worker accounts can only be viewed and managed through the Health Worker Management admin interface.
                  </p>
                </div>
              </div>

              {/* Activity Logs (Medicines + Consultations) */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Logs</h3>

                {medicines.length === 0 && consultations.length === 0 ? (
                  <p className="text-gray-500 text-sm">No activity found.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {/* Medicines dispensed */}
                    {medicines.map((medicine, index) => (
                      <div key={`medicine-${index}`} className="text-sm border-l-4 border-green-300 pl-3 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-700">
                              Medicine/Device: {medicine.inventory_items?.name}
                              {medicine.inventory_items?.category && ` (${medicine.inventory_items.category.toUpperCase()})`}
                            </p>
                            <p className="text-xs text-gray-600">
                              Quantity: {medicine.quantity} {medicine.inventory_items?.unit || "units"} dispensed
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(medicine.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Consultations */}
                    {consultations.map((consultation, index) => (
                      <div key={`consultation-${index}`} className="text-sm border-l-4 border-blue-300 pl-3 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-700">Consultation: {consultation.diagnosis || "General"}</p>
                            <p className="text-xs text-gray-600">Duration: {Math.round(consultation.duration_seconds / 60)} minutes</p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(consultation.completed_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Performance Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Stats</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">—</p>
                    <p className="text-xs text-gray-600 mt-1">Consultations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">—</p>
                    <p className="text-xs text-gray-600 mt-1">Avg Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">—</p>
                    <p className="text-xs text-gray-600 mt-1">Response Time</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">Select a health worker to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
