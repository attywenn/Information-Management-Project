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

  if (error || !data.session) {
    throw toBackendError(error, "Unable to sign in with provided credentials.");
  }

  const profile = await getMyProfileBundle();
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

export async function bookPatientAppointment({ scheduledDate, timeSlot, symptoms = [], otherSymptom = null }) {
  const { data, error } = await supabase.rpc("book_appointment", {
    p_scheduled_date: scheduledDate,
    p_time_slot: timeSlot,
    p_symptom_names: symptoms,
    p_other_symptom: otherSymptom,
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
