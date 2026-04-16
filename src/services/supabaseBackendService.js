import { supabase } from "../utils/supabase.js";

const SECURITY_QUESTIONS = [
  "Name of your cat",
  "Favorite actor/actress",
  "Favorite food",
  "Name of your first school",
  "Your childhood nickname",
];

const toBackendError = (error, fallbackMessage) => {
  const message = error?.message || fallbackMessage;
  return new Error(message);
};

const toFunctionInvokeError = async (error, fallbackMessage) => {
  const context = error?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) {
        return new Error(payload.error);
      }
      if (payload?.message) {
        return new Error(payload.message);
      }
    } catch {
      try {
        const body = await context.text();
        if (body) {
          return new Error(body);
        }
      } catch {
        // Fall through to default handling.
      }
    }
  }

  return toBackendError(error, fallbackMessage);
};

const securityQuestionIdFromText = (questionText) => {
  const index = SECURITY_QUESTIONS.findIndex((question) => question === questionText);
  return index >= 0 ? index + 1 : 1;
};

const normalizeDobValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
};

export async function registerPatientAccount(payload) {
  const metadata = {
    app_role: "patient",
    username: payload.username.trim().toLowerCase(),
    display_name: `${payload.firstname} ${payload.surname}`.trim() || payload.username.trim(),
    surname: payload.surname.trim(),
    firstname: payload.firstname.trim(),
    middlename: payload.middlename?.trim() || "",
    dob: payload.dob || "",
    contact_number: payload.contactNumber?.trim() || "",
    region: "NCR",
    province: "METRO MANILA",
    city: "SAN JUAN CITY",
    barangay: "BARANGAY SAN PERFECTO",
    house_number: payload.houseNumber?.trim() || "",
    street: payload.street?.trim() || "",
    purok_subdivision: payload.purokSubdivision?.trim() || "",
    security_question_id: securityQuestionIdFromText(payload.securityQuestion),
    security_answer: payload.securityAnswer?.trim() || "",
  };

  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    throw toBackendError(error, "Unable to register patient account.");
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function lookupLoginIdentity({ identifier, role, dob }) {
  const normalized = identifier.trim();
  if (!normalized) {
    throw new Error("Identifier is required.");
  }

  const { data, error } = await supabase.rpc("lookup_login_identity", {
    p_identifier: normalized,
    p_role: role || null,
    p_dob: role === "patient" ? dob || null : null,
  });

  if (error) {
    throw toBackendError(error, "Unable to look up account.");
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No account found for the provided login details.");
  }

  return data[0];
}

export async function getMyProfileBundle() {
  const { data, error } = await supabase.rpc("get_my_profile_bundle");
  if (error) {
    throw toBackendError(error, "Unable to fetch authenticated profile.");
  }
  if (!data) {
    throw new Error("Authenticated profile not found.");
  }

  return {
    id: data.id,
    role: data.role,
    username: data.username,
    email: data.email,
    displayName: data.displayName,
    avatarDataUrl: data.avatarUrl || "",
    patientCode: data.patientCode || "",
    patientId: data.patientCode || "",
    workerId: data.workerId || "",
    systemLicenseNumber: data.workerId || "",
    adminId: data.adminId || "",
    addressId: data.addressId || null,
    surname: data.surname || "",
    firstname: data.firstname || "",
    middlename: data.middlename || "",
    dob: data.dob || "",
    contactNumber: data.contactNumber || "",
    pinCode: data.pinCode || "",
  };
}

export async function signInPortalAccount({ identifier, password, role, dob }) {
  const normalizedIdentifier = identifier.trim();
  const normalizedDob = normalizeDobValue(dob);

  if (!normalizedDob) {
    throw new Error("Birthdate is required.");
  }

  const hasEmailShape = normalizedIdentifier.includes("@");

  let emailToUse = normalizedIdentifier;
  if (!hasEmailShape) {
    const lookup = await lookupLoginIdentity({ identifier: normalizedIdentifier, role, dob });
    emailToUse = lookup.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error) {
    // Check if error is about email not being confirmed
    if (error.message && /email.*not.*confirmed|unconfirmed/i.test(error.message)) {
      // For patients, show a helpful message since auto-verification should work
      throw new Error("Please wait a moment and try again. Your account is being verified.");
    }
    throw toBackendError(error, "Unable to sign in with provided credentials.");
  }

  if (!data.session) {
    throw new Error("Unable to sign in with provided credentials.");
  }

  const profile = await getMyProfileBundle();
  const profileDob = normalizeDobValue(profile.dob);

  if (!profileDob || profileDob !== normalizedDob) {
    await supabase.auth.signOut();
    throw new Error("Birthdate does not match this account.");
  }

  if (role && profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error("Selected account type does not match this account.");
  }

  return {
    session: data.session,
    profile,
  };
}

export async function signOutPortalAccount() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw toBackendError(error, "Unable to sign out session.");
  }
}

export async function changePortalPassword({
  role,
  currentPassword,
  newPassword,
  confirmNewPassword,
  reason,
}) {
  const normalizedCurrentPassword = String(currentPassword || "");
  const normalizedNewPassword = String(newPassword || "");
  const normalizedConfirmPassword = String(confirmNewPassword || "");
  const normalizedReason = String(reason || "").trim();

  if (!normalizedCurrentPassword) {
    throw new Error("Current password is required.");
  }
  if (!normalizedNewPassword) {
    throw new Error("New password is required.");
  }
  if (normalizedNewPassword !== normalizedConfirmPassword) {
    throw new Error("New password and confirm password do not match.");
  }
  if (role !== "admin" && !normalizedReason) {
    throw new Error("Reason for password change is required.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) {
    throw new Error("Authenticated user session was not found.");
  }

  const signInVerification = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: normalizedCurrentPassword,
  });

  if (signInVerification.error || !signInVerification.data.session) {
    throw new Error("Current password is incorrect.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: normalizedNewPassword,
  });

  if (updateError) {
    throw toBackendError(updateError, "Unable to change password.");
  }

  const { error: notifyError } = await supabase.rpc("notify_admin_password_change", {
    p_reason: role === "admin" ? null : normalizedReason,
  });

  if (notifyError) {
    throw toBackendError(notifyError, "Password updated but admin notification failed.");
  }

  return true;
}

export async function fetchMyInboxMessages() {
  const { data, error } = await supabase.rpc("get_my_inbox_messages");
  if (error) {
    throw toBackendError(error, "Unable to load inbox messages.");
  }

  return data || [];
}

export async function createHealthWorkerAccountByAdmin(payload) {
  const invokeCreateHealthWorker = async (accessToken) => {
    return supabase.functions.invoke("create-health-worker-account", {
      body: payload,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Admin session is required to create a health worker account.");
  }

  let { data, error } = await invokeCreateHealthWorker(accessToken);
  if (error) {
    const invokeError = await toFunctionInvokeError(error, "Unable to create health worker account.");
    if (/invalid\s+jwt/i.test(invokeError.message)) {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshedData.session?.access_token;

      if (refreshError || !refreshedToken) {
        throw new Error("Session expired. Please sign in again as admin.");
      }

      ({ data, error } = await invokeCreateHealthWorker(refreshedToken));
      if (error) {
        throw await toFunctionInvokeError(error, "Unable to create health worker account.");
      }
    } else {
      throw invokeError;
    }
  }

  if (!data?.licenseNumber) {
    throw new Error("Unable to create health worker account.");
  }

  return data;
}

export async function deleteHealthWorkerAccountByAdmin(payload) {
  const invokeDeleteHealthWorker = async (accessToken) => {
    return supabase.functions.invoke("delete-health-worker-account", {
      body: payload,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Admin session is required to delete a health worker account.");
  }

  let { data, error } = await invokeDeleteHealthWorker(accessToken);
  if (error) {
    const invokeError = await toFunctionInvokeError(error, "Unable to delete health worker account.");
    if (/invalid\s+jwt/i.test(invokeError.message)) {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshedData.session?.access_token;

      if (refreshError || !refreshedToken) {
        throw new Error("Session expired. Please sign in again as admin.");
      }

      ({ data, error } = await invokeDeleteHealthWorker(refreshedToken));
      if (error) {
        throw await toFunctionInvokeError(error, "Unable to delete health worker account.");
      }
    } else {
      throw invokeError;
    }
  }

  return data || { success: true };
}

export async function recoverPasswordWithSecurityAnswer({
  identifier,
  role,
  dob,
  securityQuestion,
  securityAnswer,
}) {
  const lookup = await lookupLoginIdentity({ identifier, role, dob });

  const { data: isAnswerValid, error: verifyError } = await supabase.rpc("verify_security_answer", {
    p_identifier: identifier,
    p_role: role,
    p_question_id: securityQuestionIdFromText(securityQuestion),
    p_answer: securityAnswer,
    p_dob: role === "patient" ? dob || null : null,
  });

  if (verifyError) {
    throw toBackendError(verifyError, "Unable to verify security answer.");
  }

  if (!isAnswerValid) {
    throw new Error("Incorrect security answer or question.");
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(lookup.email, {
    redirectTo: `${window.location.origin}/account`,
  });

  if (resetError) {
    throw toBackendError(resetError, "Unable to send password reset email.");
  }

  return true;
}

export async function bookPatientAppointment({ scheduledDate, timeSlot, symptoms = [], otherSymptom = null, qrValue = null }) {
  const { data, error } = await supabase.rpc("book_appointment", {
    p_scheduled_date: scheduledDate,
    p_time_slot: timeSlot,
    p_symptom_names: symptoms,
    p_other_symptom: otherSymptom,
    p_qr_value: qrValue,
  });

  if (error) {
    throw toBackendError(error, "Unable to book appointment.");
  }

  return data;
}

export async function completeConsultationRecord(payload) {
  const { data, error } = await supabase.rpc("complete_consultation", {
    p_appointment_id: payload.appointmentId,
    p_diagnosis: payload.diagnosis,
    p_note: payload.note,
    p_started_at: payload.startedAt,
    p_completed_at: payload.completedAt,
    p_proof_image_url: payload.proofImageUrl,
    p_medicine_item_id: payload.medicineItemId,
    p_medicine_quantity: payload.medicineQuantity,
    p_medicine_intake_per_day: payload.medicineIntakePerDay,
    p_medicine_intake_instruction: payload.medicineIntakeInstruction,
  });

  if (error) {
    throw toBackendError(error, "Unable to complete consultation.");
  }

  return data;
}

export async function fetchHealthWorkerDirectory() {
  const { data, error } = await supabase
    .from("health_worker_profiles")
    .select("user_id, license_number, surname, firstname, middlename, dob, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw toBackendError(error, "Unable to load health worker accounts.");
  }

  const workerRows = data || [];
  if (workerRows.length === 0) {
    return [];
  }

  const workerIds = workerRows.map((row) => row.user_id);
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, email, created_at")
    .in("id", workerIds);

  if (profileError) {
    throw toBackendError(profileError, "Unable to load health worker accounts.");
  }

  const profilesById = new Map((profileRows || []).map((row) => [row.id, row]));

  return workerRows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      role: "health_worker",
      id: row.user_id,
      user_id: row.user_id,
      userId: row.user_id,
      username: profile?.username || "",
      email: profile?.email || "",
      surname: row.surname || "",
      firstname: row.firstname || "",
      middlename: row.middlename || "",
      dob: row.dob || "",
      workerId: row.license_number,
      systemLicenseNumber: row.license_number,
      createdAt: profile?.created_at || row.created_at || "",
    };
  });
}

export async function fetchDailyAttendanceAnalytics() {
  const { data, error } = await supabase
    .from("v_daily_consultation_attendance")
    .select("consultation_date, booked_count, attended_count, absence_count")
    .order("consultation_date", { ascending: true });

  if (error) {
    throw toBackendError(error, "Unable to load daily attendance analytics.");
  }

  return data || [];
}

export async function fetchTopDiagnosisByAgeGroup() {
  const { data, error } = await supabase
    .from("v_top_diagnosis_by_age_group")
    .select("age_group, diagnosis, case_count")
    .order("age_group", { ascending: true });

  if (error) {
    throw toBackendError(error, "Unable to load diagnosis analytics.");
  }

  return data || [];
}

export async function fetchPatientAndHealthWorkerStats() {
  const patientQuery = supabase
    .from("patient_profiles")
    .select("user_id", { count: "exact", head: true });

  const healthWorkerQuery = supabase
    .from("health_worker_profiles")
    .select("user_id", { count: "exact", head: true });

  const [patientResult, healthWorkerResult] = await Promise.all([patientQuery, healthWorkerQuery]);

  if (patientResult.error) {
    throw toBackendError(patientResult.error, "Unable to load patient count.");
  }

  if (healthWorkerResult.error) {
    throw toBackendError(healthWorkerResult.error, "Unable to load health worker count.");
  }

  return {
    patientCount: patientResult.count || 0,
    healthWorkerCount: healthWorkerResult.count || 0,
  };
}

export async function fetchInventoryItems() {
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, name, category, unit, is_active, created_at");

  if (itemsError) {
    throw toBackendError(itemsError, "Unable to load inventory items.");
  }

  const { data: balances, error: balancesError } = await supabase
    .from("inventory_balances")
    .select("item_id, quantity, updated_at");

  if (balancesError) {
    throw toBackendError(balancesError, "Unable to load inventory balances.");
  }

  const balanceMap = new Map((balances || []).map((b) => [b.item_id, b.quantity || 0]));

  return (items || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: balanceMap.get(item.id) || 0,
    isActive: item.is_active,
    createdAt: item.created_at,
  }));
}

export async function upsertInventoryItem(payload) {
  const { data, error } = await supabase.rpc("upsert_inventory_item", {
    p_name: payload.name,
    p_category: payload.category,
    p_unit: payload.unit,
    p_quantity: payload.quantity,
  });

  if (error) {
    throw toBackendError(error, "Unable to save inventory item.");
  }

  return data;
}

export async function adjustInventoryQuantity(payload) {
  const { data, error } = await supabase.rpc("adjust_inventory_quantity", {
    p_item_id: payload.itemId,
    p_quantity: payload.quantity,
    p_movement_type: payload.movementType || "add",
    p_note: payload.note || null,
  });

  if (error) {
    throw toBackendError(error, "Unable to update inventory quantity.");
  }

  return data;
}

const buildPersonName = ({ display_name: displayName, firstname, surname, username } = {}) => {
  if (displayName) {
    return displayName;
  }

  const parts = [firstname, surname].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }

  return username || "";
};

export async function fetchPatientDirectory() {
  const [{ data: patientRows, error: patientError }, { data: profileRows, error: profileError }, { data: addressRows, error: addressError }] = await Promise.all([
    supabase
      .from("patient_profiles")
      .select("user_id, patient_code, surname, firstname, middlename, dob, contact_number, address_id, created_at, updated_at"),
    supabase
      .from("profiles")
      .select("id, username, email, display_name, avatar_url, created_at, updated_at"),
    supabase
      .from("addresses")
      .select("id, region, province, city, barangay, house_number, street, purok_subdivision"),
  ]);

  if (patientError) {
    throw toBackendError(patientError, "Unable to load patient directory.");
  }
  if (profileError) {
    throw toBackendError(profileError, "Unable to load patient directory.");
  }
  if (addressError) {
    throw toBackendError(addressError, "Unable to load patient directory.");
  }

  const profilesById = new Map((profileRows || []).map((row) => [row.id, row]));
  const addressesById = new Map((addressRows || []).map((row) => [row.id, row]));

  return (patientRows || []).map((row) => {
    const profile = profilesById.get(row.user_id) || {};
    const address = row.address_id ? addressesById.get(row.address_id) || null : null;

    return {
      role: "patient",
      id: row.user_id,
      user_id: row.user_id,
      userId: row.user_id,
      username: profile.username || "",
      email: profile.email || "",
      displayName: buildPersonName(profile) || `${row.firstname || ""} ${row.surname || ""}`.trim(),
      avatarDataUrl: profile.avatar_url || "",
      surname: row.surname || "",
      firstname: row.firstname || "",
      middlename: row.middlename || "",
      dob: row.dob || "",
      contactNumber: row.contact_number || "",
      patientCode: row.patient_code || "",
      patientId: row.patient_code || "",
      addressId: row.address_id || null,
      address: address
        ? {
              region: address.region || "",
              province: address.province || "",
              city: address.city || "",
              barangay: address.barangay || "",
              houseNumber: address.house_number || "",
              street: address.street || "",
              streetName: address.street || "",
              purokSubdivision: address.purok_subdivision || "",
          }
        : null,
      fullAddress: address
        ? `${address.house_number}, ${address.street}, ${address.purok_subdivision}, ${address.barangay}, ${address.city}, ${address.province}, ${address.region}`
        : "",
      createdAt: row.created_at || profile.created_at || "",
      updatedAt: row.updated_at || profile.updated_at || "",
    };
  });
}

export async function fetchAppointmentFeed() {
  const [{ data: appointmentRows, error: appointmentError }, { data: patientRows, error: patientError }, { data: profileRows, error: profileError }, { data: symptomRows, error: symptomError }, { data: symptomMetaRows, error: symptomMetaError }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, patient_user_id, booked_by_user_id, scheduled_date, time_slot, status, qr_value, other_symptom_text, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_profiles")
      .select("user_id, patient_code, surname, firstname, middlename, dob, contact_number, address_id, created_at, updated_at"),
    supabase
      .from("profiles")
      .select("id, username, email, display_name, avatar_url, created_at, updated_at"),
    supabase
      .from("appointment_symptoms")
      .select("appointment_id, symptom_id"),
    supabase
      .from("symptoms")
      .select("id, name"),
  ]);

  if (appointmentError) throw toBackendError(appointmentError, "Unable to load appointments.");
  if (patientError) throw toBackendError(patientError, "Unable to load appointments.");
  if (profileError) throw toBackendError(profileError, "Unable to load appointments.");
  if (symptomError) throw toBackendError(symptomError, "Unable to load appointments.");
  if (symptomMetaError) throw toBackendError(symptomMetaError, "Unable to load appointments.");

  const patientById = new Map((patientRows || []).map((row) => [row.user_id, row]));
  const profileById = new Map((profileRows || []).map((row) => [row.id, row]));
  const symptomNameById = new Map((symptomMetaRows || []).map((row) => [row.id, row.name]));
  const symptomsByAppointment = (symptomRows || []).reduce((accumulator, row) => {
    const symptomName = symptomNameById.get(row.symptom_id);
    if (!symptomName) {
      return accumulator;
    }

    const current = accumulator.get(row.appointment_id) || [];
    current.push(symptomName);
    accumulator.set(row.appointment_id, current);
    return accumulator;
  }, new Map());

  return (appointmentRows || []).map((row) => {
    const patient = patientById.get(row.patient_user_id) || {};
    const profile = profileById.get(row.patient_user_id) || {};
    const nameParts = [patient.firstname, patient.surname].filter(Boolean);
    const patientName = buildPersonName(profile) || (nameParts.length ? nameParts.join(" ") : "Patient");

    return {
      id: row.id,
      patientUserId: row.patient_user_id,
      bookedByUserId: row.booked_by_user_id,
      patientName,
      patientCode: patient.patient_code || "",
      patientId: patient.patient_code || "",
      qrValue: row.qr_value || "",
      dateKey: row.scheduled_date || "",
      timeSlot: row.time_slot || "",
      symptoms: symptomsByAppointment.get(row.id) || [],
      otherSymptomText: row.other_symptom_text || "",
      status: row.status || "booked",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      consultedAt: row.status === "consulted" ? row.updated_at || row.created_at || "" : "",
    };
  });
}

export async function fetchConsultationFeed() {
  const [{ data: consultationRows, error: consultationError }, { data: appointmentRows, error: appointmentError }, { data: patientRows, error: patientError }, { data: profileRows, error: profileError }, { data: itemRows, error: itemError }, { data: inventoryRows, error: inventoryError }, { data: workerRows, error: workerError }] = await Promise.all([
    supabase
      .from("consultations")
      .select("id, appointment_id, patient_user_id, health_worker_user_id, diagnosis, note, started_at, completed_at, duration_seconds, proof_image_url, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, patient_user_id, scheduled_date, time_slot, qr_value, status, created_at, updated_at"),
    supabase
      .from("patient_profiles")
      .select("user_id, patient_code, surname, firstname, middlename, dob, contact_number, address_id"),
    supabase
      .from("profiles")
      .select("id, username, email, display_name, avatar_url"),
    supabase
      .from("consultation_items")
      .select("consultation_id, item_id, quantity, medicine_intake_per_day, medicine_intake_instruction, medicine_intake_frequency, medicine_intake_more_than_3x_note"),
    supabase
      .from("inventory_items")
      .select("id, name, category, unit"),
    supabase
      .from("health_worker_profiles")
      .select("user_id, license_number, surname, firstname, middlename"),
  ]);

  if (consultationError) throw toBackendError(consultationError, "Unable to load consultations.");
  if (appointmentError) throw toBackendError(appointmentError, "Unable to load consultations.");
  if (patientError) throw toBackendError(patientError, "Unable to load consultations.");
  if (profileError) throw toBackendError(profileError, "Unable to load consultations.");
  if (itemError) throw toBackendError(itemError, "Unable to load consultations.");
  if (inventoryError) throw toBackendError(inventoryError, "Unable to load consultations.");
  if (workerError) throw toBackendError(workerError, "Unable to load consultations.");

  const appointmentById = new Map((appointmentRows || []).map((row) => [row.id, row]));
  const patientById = new Map((patientRows || []).map((row) => [row.user_id, row]));
  const profileById = new Map((profileRows || []).map((row) => [row.id, row]));
  const itemNameById = new Map((inventoryRows || []).map((row) => [row.id, row]));
  const consultationItemsById = (itemRows || []).reduce((accumulator, row) => {
    const current = accumulator.get(row.consultation_id) || [];
    current.push(row);
    accumulator.set(row.consultation_id, current);
    return accumulator;
  }, new Map());
  const workerById = new Map((workerRows || []).map((row) => [row.user_id, row]));

  return (consultationRows || []).map((row) => {
    const appointment = appointmentById.get(row.appointment_id) || {};
    const patient = patientById.get(row.patient_user_id) || {};
    const profile = profileById.get(row.patient_user_id) || {};
    const worker = workerById.get(row.health_worker_user_id) || {};
    const consultationItems = consultationItemsById.get(row.id) || [];
    const primaryItem = consultationItems[0] || {};
    const itemName = primaryItem.item_id ? itemNameById.get(primaryItem.item_id)?.name || "" : "";
    const fallbackIntakePerDay = primaryItem.medicine_intake_frequency === "1x"
      ? 1
      : primaryItem.medicine_intake_frequency === "2x"
        ? 2
        : primaryItem.medicine_intake_frequency === "3x"
          ? 3
          : primaryItem.medicine_intake_frequency === "more_than_3x"
            ? 4
            : 1;

    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientUserId: row.patient_user_id,
      healthWorkerUserId: row.health_worker_user_id,
      patientName: buildPersonName(profile) || `${patient.firstname || ""} ${patient.surname || ""}`.trim() || "Patient",
      patientCode: patient.patient_code || "",
      dateKey: appointment.scheduled_date || "",
      timeSlot: appointment.time_slot || "",
      diagnosis: row.diagnosis || "",
      medicineId: primaryItem.item_id || "",
      medicineName: itemName || "",
      medicineQuantity: primaryItem.quantity || 0,
      medicineIntakePerDay: Number(primaryItem.medicine_intake_per_day || fallbackIntakePerDay || 1),
      medicineIntakeInstruction: primaryItem.medicine_intake_instruction || primaryItem.medicine_intake_more_than_3x_note || "",
      note: row.note || "",
      workerName: buildPersonName(worker) || "Health Worker",
      startedAt: row.started_at || "",
      completedAt: row.completed_at || "",
      durationSeconds: row.duration_seconds || 0,
      durationLabel: row.duration_seconds ? `${Math.floor(row.duration_seconds / 60)}m` : "",
      proofImageDataUrl: row.proof_image_url || "",
      proofImageName: "",
      createdAt: row.created_at || "",
    };
  });
}

export async function updateMyProfileSettings(payload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error("Authenticated user session was not found.");
  }

  const profileBundle = await getMyProfileBundle();
  const userId = userData.user.id;
  const now = new Date().toISOString();
  const displayName = `${payload.firstname || ""} ${payload.surname || ""}`.trim() || profileBundle.displayName || profileBundle.username;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      avatar_url: payload.avatarDataUrl || null,
      updated_at: now,
    })
    .eq("id", userId);

  if (profileError) {
    throw toBackendError(profileError, "Unable to save profile settings.");
  }

  if (profileBundle.role === "patient") {
    let addressId = profileBundle.addressId || null;

    if (
      payload.houseNumber ||
      payload.streetName ||
      payload.purokSubdivision ||
      payload.region ||
      payload.province ||
      payload.city ||
      payload.barangay
    ) {
      const addressPayload = {
        region: payload.region || "NCR",
        province: payload.province || "METRO MANILA",
        city: payload.city || "SAN JUAN CITY",
        barangay: payload.barangay || "BARANGAY SAN PERFECTO",
        house_number: payload.houseNumber || "",
        street: payload.streetName || "",
        purok_subdivision: payload.purokSubdivision || "",
      };

      const { data: addressRow, error: addressUpsertError } = await supabase
        .from("addresses")
        .upsert(addressPayload, {
          onConflict: "region,province,city,barangay,house_number,street,purok_subdivision",
        })
        .select("id")
        .single();

      if (addressUpsertError) {
        throw toBackendError(addressUpsertError, "Unable to save address settings.");
      }

      addressId = addressRow?.id || addressId;
    }

    const { error: patientError } = await supabase
      .from("patient_profiles")
      .update({
        surname: payload.surname || "",
        firstname: payload.firstname || "",
        middlename: payload.middlename || "",
        dob: payload.dob || null,
        contact_number: payload.contactNumber || null,
        address_id: addressId,
        updated_at: now,
      })
      .eq("user_id", userId);

    if (patientError) {
      throw toBackendError(patientError, "Unable to save patient profile settings.");
    }
  }

  if (profileBundle.role === "health_worker") {
    const { error: workerError } = await supabase
      .from("health_worker_profiles")
      .update({
        surname: payload.surname || "",
        firstname: payload.firstname || "",
        middlename: payload.middlename || "",
        dob: payload.dob || null,
        updated_at: now,
      })
      .eq("user_id", userId);

    if (workerError) {
      throw toBackendError(workerError, "Unable to save health worker profile settings.");
    }
  }

  if (profileBundle.role === "admin") {
    const { error: adminError } = await supabase
      .from("admin_profiles")
      .update({
        pin_code: payload.pinCode || null,
        updated_at: now,
      })
      .eq("user_id", userId);

    if (adminError) {
      throw toBackendError(adminError, "Unable to save admin profile settings.");
    }
  }

  return getMyProfileBundle();
}

// ========== ADMIN: PATIENT ACCOUNT MANAGEMENT ==========

export async function fetchPatientAccountDetail(patientUserId) {
  try {
    // Get patient profile
    const { data: patientProfile, error: patientError } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", patientUserId)
      .single();

    if (patientError) {
      throw toBackendError(patientError, "Failed to fetch patient profile.");
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, email, display_name, avatar_url, created_at")
      .eq("id", patientUserId)
      .single();

    if (profileError) {
      throw toBackendError(profileError, "Failed to fetch patient auth info.");
    }

    // Get consultations
    const { data: consultations, error: consultError } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_user_id", patientUserId)
      .order("completed_at", { ascending: false });

    if (consultError) {
      throw toBackendError(consultError, "Failed to fetch patient consultations.");
    }

    return {
      profile: patientProfile,
      email: profileRow?.email || "",
      consultations: consultations || [],
    };
  } catch (error) {
    throw toBackendError(error, "Unable to fetch patient account detail.");
  }
}

export async function fetchPatientAuditLogs(patientUserId) {
  try {
    // First fetch consultations for this specific patient
    const { data: consultations, error: consultError } = await supabase
      .from("consultations")
      .select("id")
      .eq("patient_user_id", patientUserId);

    if (consultError) {
      throw toBackendError(consultError, "Failed to fetch patient consultations.");
    }

    const consultationIds = consultations?.map((c) => c.id) || [];

    // If no consultations, return empty array
    if (consultationIds.length === 0) {
      return [];
    }

    // Fetch medicine/assistive devices history (dispense movements linked to patient consultations)
    const { data: medicines, error } = await supabase
      .from("inventory_movements")
      .select(
        `
        id,
        quantity,
        movement_type,
        created_at,
        inventory_items:item_id (id, name, category, unit),
        consultations:consultation_id (id, patient_user_id, completed_at)
      `
      )
      .eq("movement_type", "dispense")
      .in("consultation_id", consultationIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw toBackendError(error, "Failed to fetch medicine history.");
    }

    return medicines || [];
  } catch (error) {
    throw toBackendError(error, "Unable to fetch patient medicine history.");
  }
}

export async function fetchMedicinesDispensedByHealthWorker(healthWorkerUserId) {
  try {
    // Fetch consultations completed by the health worker
    const { data: consultations, error: consultError } = await supabase
      .from("consultations")
      .select("id")
      .eq("health_worker_user_id", healthWorkerUserId);

    if (consultError) {
      throw toBackendError(consultError, "Failed to fetch consultations.");
    }

    const consultationIds = consultations?.map((c) => c.id) || [];

    if (consultationIds.length === 0) {
      return [];
    }

    // Fetch all medicines dispensed in those consultations
    const { data: medicines, error } = await supabase
      .from("inventory_movements")
      .select(
        `
        id,
        quantity,
        movement_type,
        created_at,
        inventory_items:item_id (id, name, category, unit),
        consultations:consultation_id (id, patient_user_id, completed_at)
      `
      )
      .eq("movement_type", "dispense")
      .in("consultation_id", consultationIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw toBackendError(error, "Failed to fetch medicines dispensed.");
    }

    return medicines || [];
  } catch (error) {
    throw toBackendError(error, "Unable to fetch medicines dispensed by health worker.");
  }
}

export async function fetchConsultationsByHealthWorker(healthWorkerUserId) {
  try {
    const { data: consultations, error } = await supabase
      .from("consultations")
      .select(
        `
        id,
        patient_user_id,
        diagnosis,
        note,
        completed_at,
        duration_seconds
      `
      )
      .eq("health_worker_user_id", healthWorkerUserId)
      .order("completed_at", { ascending: false })
      .limit(100);

    if (error) {
      throw toBackendError(error, "Failed to fetch consultations.");
    }

    return consultations || [];
  } catch (error) {
    throw toBackendError(error, "Unable to fetch health worker consultations.");
  }
}

export async function changePatientPasswordByAdmin(payload) {
  const { patientUserId, newPassword } = payload;

  try {
    const { error } = await supabase.auth.admin.updateUserById(patientUserId, {
      password: newPassword,
    });

    if (error) {
      throw toBackendError(error, "Failed to update patient password.");
    }

    // Log the action
    const userId = (await supabase.auth.getUser()).data?.user?.id;
    await supabase.from("audit_logs").insert({
      admin_id: userId,
      patient_id: patientUserId,
      action: "password_changed",
      details: { changed_by: "admin" },
      created_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    const functionError = await toFunctionInvokeError(error, "Failed to change patient password.");
    throw functionError;
  }
}

export async function deletePatientAccountByAdmin(payload) {
  const { patientUserId, reason = "" } = payload;

  try {
    // Get current user's session for authorization header
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("No active session. Please log in again.");
    }

    // Call edge function to handle deletion
    const { data, error } = await supabase.functions.invoke("delete-patient-account", {
      body: {
        patientUserId,
        reason,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      throw await toFunctionInvokeError(error, "Failed to delete patient account.");
    }

    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to delete patient account.");
  }
}
