package com.morefunos.smt.storekernel.business;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Immutable staff-session value checks. This is not a Security Authority or a PIN verifier.
 * All inputs must originate from trusted native canonical reads, never browser claims.
 */
public final class FormalStaffSessionRecords {
    private FormalStaffSessionRecords() { }

    public static final long MAX_LIFETIME_MS = 12 * 60 * 60 * 1000L;
    public static final long DEFAULT_PIN_ITERATIONS = 120_000L;
    private static final long MAX_JS_SAFE_INTEGER = 9_007_199_254_740_991L;

    public enum SessionState { AUTHENTICATED, EXPIRED, REVOKED, UNAUTHORIZED, UNKNOWN }
    public enum DeviceStatus { AUTHORIZED, REVOKED, UNKNOWN }
    public enum OwnerAuthorizationStatus { AUTHORIZED, REVOKED, UNKNOWN }
    public enum StaffStatus { ACTIVE, INACTIVE }
    public enum Role { STAFF, MANAGER, OWNER, VIEWER }
    public enum Scope { STORE, MULTI_STORE, REPORT_ONLY }
    public enum Code {
        VALID_AT_OBSERVATION,
        CLOCK_INVALID,
        CONTEXT_INVALID,
        SESSION_MISSING,
        SESSION_INVALID,
        SESSION_LIFETIME_INVALID,
        SESSION_NOT_YET_VALID,
        SESSION_EXPIRED,
        SESSION_REVOKED,
        SESSION_UNAUTHORIZED,
        SESSION_REF_MISMATCH,
        DEVICE_MISSING,
        DEVICE_UNKNOWN,
        DEVICE_REVOKED,
        DEVICE_MISMATCH,
        STORE_MISMATCH,
        OWNER_AUTHORIZATION_MISSING,
        OWNER_AUTHORIZATION_UNKNOWN,
        OWNER_AUTHORIZATION_REVOKED,
        OWNER_AUTHORIZATION_REF_MISMATCH,
        OWNER_AUTHORIZATION_REVISION_MISMATCH,
        STAFF_MISSING,
        STAFF_INACTIVE,
        STAFF_MISMATCH,
        SESSION_REVISION_MISSING,
        SESSION_REVISION_MISMATCH,
        VERIFIER_METADATA_VALID,
        VERIFIER_METADATA_INVALID,
        VERIFIER_METADATA_MISSING
    }

    /** Exactly one revision member is present. String and numeric identities remain distinct. */
    public record Revision(String text, Long number) { }

    /** Opaque parent login authorization; this record does not choose device- versus store-scoping. */
    public record ParentAuthorization(String ownerAuthorizationRef, Revision revision) { }

    /** Expected identity and current canonical revision, independently established by a native read. */
    public record Context(
        String staffSessionRef,
        String deviceId,
        String storeId,
        String staffId,
        Revision sessionRevision,
        ParentAuthorization parentAuthorization
    ) { }

    /** No PIN, proof, or verifier field is permitted in a durable staff session. */
    public record SessionRecord(
        SessionState state,
        String staffSessionRef,
        String staffId,
        String displayName,
        Role role,
        Scope scope,
        List<String> permissions,
        long issuedAtEpochMs,
        long expiresAtEpochMs,
        String deviceId,
        String storeId,
        Revision sessionRevision,
        ParentAuthorization parentAuthorization
    ) {
        public SessionRecord {
            permissions = permissions == null
                ? null
                : Collections.unmodifiableList(new ArrayList<>(permissions));
        }

        @Override
        public String toString() {
            return "SessionRecord[redacted]";
        }
    }

    /** Native-only published verifier metadata. Never attach this value to browser/session readback. */
    public record VerifierMetadata(String algorithm, long iterations, String saltHex, String hashHex) {
        @Override
        public String toString() {
            return "VerifierMetadata[redacted]";
        }
    }

    /** Diagnostic observation only, never an authorization capability. */
    public record Observation(
        Code code,
        long observedAtEpochMs,
        Long expiresAtEpochMs,
        Revision sessionRevision
    ) { }

    /**
     * Device/staff status must correspond to the exact Context identities. Rejections expose no
     * deadline or revision that could accidentally be reused as admission evidence.
     */
    public static Observation validate(
        SessionRecord session,
        Context context,
        DeviceStatus device,
        OwnerAuthorizationStatus ownerAuthorization,
        StaffStatus staff,
        long nowEpochMs
    ) {
        final Code code = validationCode(session, context, device, ownerAuthorization, staff, nowEpochMs);
        return new Observation(
            code,
            nowEpochMs,
            code == Code.VALID_AT_OBSERVATION ? session.expiresAtEpochMs() : null,
            code == Code.VALID_AT_OBSERVATION ? session.sessionRevision() : null
        );
    }

    private static Code validationCode(
        SessionRecord session,
        Context context,
        DeviceStatus device,
        OwnerAuthorizationStatus ownerAuthorization,
        StaffStatus staff,
        long nowEpochMs
    ) {
        if (nowEpochMs < 0) return Code.CLOCK_INVALID;
        if (context == null
            || !text(context.staffSessionRef())
            || !text(context.deviceId())
            || !text(context.storeId())
            || !text(context.staffId())
            || !revision(context.sessionRevision())
            || !parentAuthorization(context.parentAuthorization())) return Code.CONTEXT_INVALID;
        if (device == null) return Code.DEVICE_MISSING;
        if (device == DeviceStatus.REVOKED) return Code.DEVICE_REVOKED;
        if (device != DeviceStatus.AUTHORIZED) return Code.DEVICE_UNKNOWN;
        if (ownerAuthorization == null) return Code.OWNER_AUTHORIZATION_MISSING;
        if (ownerAuthorization == OwnerAuthorizationStatus.REVOKED) return Code.OWNER_AUTHORIZATION_REVOKED;
        if (ownerAuthorization != OwnerAuthorizationStatus.AUTHORIZED) return Code.OWNER_AUTHORIZATION_UNKNOWN;
        if (staff == null) return Code.STAFF_MISSING;
        if (staff != StaffStatus.ACTIVE) return Code.STAFF_INACTIVE;
        if (session == null) return Code.SESSION_MISSING;
        if (session.state() == null
            || !text(session.staffSessionRef())
            || !text(session.staffId())
            || !text(session.displayName())
            || !text(session.deviceId())
            || !text(session.storeId())
            || session.role() == null
            || session.scope() == null
            || session.permissions() == null
            || session.issuedAtEpochMs() < 0
            || !parentAuthorization(session.parentAuthorization())) return Code.SESSION_INVALID;
        for (String permission : session.permissions()) {
            if (!text(permission)) return Code.SESSION_INVALID;
        }
        if (session.expiresAtEpochMs() <= session.issuedAtEpochMs()
            || session.expiresAtEpochMs() - session.issuedAtEpochMs() > MAX_LIFETIME_MS) {
            return Code.SESSION_LIFETIME_INVALID;
        }
        if (!context.staffSessionRef().equals(session.staffSessionRef())) return Code.SESSION_REF_MISMATCH;
        if (!context.deviceId().equals(session.deviceId())) return Code.DEVICE_MISMATCH;
        if (!context.storeId().equals(session.storeId())) return Code.STORE_MISMATCH;
        if (!context.staffId().equals(session.staffId())) return Code.STAFF_MISMATCH;
        if (!context.parentAuthorization().ownerAuthorizationRef()
            .equals(session.parentAuthorization().ownerAuthorizationRef())) {
            return Code.OWNER_AUTHORIZATION_REF_MISMATCH;
        }
        if (!context.parentAuthorization().revision().equals(session.parentAuthorization().revision())) {
            return Code.OWNER_AUTHORIZATION_REVISION_MISMATCH;
        }
        if (session.sessionRevision() == null) return Code.SESSION_REVISION_MISSING;
        if (!revision(session.sessionRevision())) return Code.SESSION_INVALID;
        if (!context.sessionRevision().equals(session.sessionRevision())) return Code.SESSION_REVISION_MISMATCH;
        if (session.state() == SessionState.REVOKED) return Code.SESSION_REVOKED;
        if (session.state() == SessionState.EXPIRED) return Code.SESSION_EXPIRED;
        if (session.state() != SessionState.AUTHENTICATED) return Code.SESSION_UNAUTHORIZED;
        if (session.role() == Role.VIEWER || session.scope() == Scope.REPORT_ONLY) {
            return Code.SESSION_UNAUTHORIZED;
        }
        if (nowEpochMs < session.issuedAtEpochMs()) return Code.SESSION_NOT_YET_VALID;
        if (nowEpochMs >= session.expiresAtEpochMs()) return Code.SESSION_EXPIRED;
        return Code.VALID_AT_OBSERVATION;
    }

    private static boolean text(String value) {
        if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > 240) return false;
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) return false;
        }
        return true;
    }

    private static boolean revision(Revision value) {
        if (value == null || (value.text() == null) == (value.number() == null)) return false;
        return value.text() != null
            ? text(value.text())
            : value.number() >= 0 && value.number() <= MAX_JS_SAFE_INTEGER;
    }

    private static boolean parentAuthorization(ParentAuthorization value) {
        return value != null && text(value.ownerAuthorizationRef()) && revision(value.revision());
    }

    public static Code validateVerifier(VerifierMetadata verifier) {
        if (verifier == null) return Code.VERIFIER_METADATA_MISSING;
        return "PBKDF2-SHA256".equals(verifier.algorithm())
            && verifier.iterations() >= 100_000L
            && verifier.iterations() <= MAX_JS_SAFE_INTEGER
            && hex(verifier.saltHex())
            && verifier.hashHex() != null
            && verifier.hashHex().length() == 64
            && hex(verifier.hashHex())
            ? Code.VERIFIER_METADATA_VALID
            : Code.VERIFIER_METADATA_INVALID;
    }

    private static boolean hex(String value) {
        return value != null && value.length() % 2 == 0 && value.matches("[0-9a-fA-F]+");
    }
}
