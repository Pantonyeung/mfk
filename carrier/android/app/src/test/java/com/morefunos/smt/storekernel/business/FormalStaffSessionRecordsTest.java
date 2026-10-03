package com.morefunos.smt.storekernel.business;

import static com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.DEFAULT_PIN_ITERATIONS;
import static com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.MAX_LIFETIME_MS;
import static com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.validate;
import static com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.validateVerifier;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Code;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Context;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.DeviceStatus;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Observation;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.OwnerAuthorizationStatus;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.ParentAuthorization;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Revision;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Role;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.Scope;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.SessionRecord;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.SessionState;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.StaffStatus;
import com.morefunos.smt.storekernel.business.FormalStaffSessionRecords.VerifierMetadata;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Pure value tests. Synthetic fixtures only; no authentication or runtime proof. */
public final class FormalStaffSessionRecordsTest {
    private static final long ISSUED = 1_000L;
    private static final Revision R1 = new Revision("synthetic-r1", null);
    private static final Revision OWNER_R1 = new Revision("synthetic-owner-r1", null);
    private static final ParentAuthorization OWNER = new ParentAuthorization("owner-auth-fixture", OWNER_R1);
    private static final Context CTX = new Context(
        "session-fixture",
        "device-fixture",
        "store-fixture",
        "staff-fixture",
        R1,
        OWNER
    );

    @Test
    public void validatesObservationBoundariesAndContext() {
        final SessionRecord good = good();
        final Observation accepted = observe(good, ISSUED);
        assertEquals(Code.VALID_AT_OBSERVATION, accepted.code());
        assertEquals(ISSUED, accepted.observedAtEpochMs());
        assertEquals(Long.valueOf(good.expiresAtEpochMs()), accepted.expiresAtEpochMs());
        assertEquals(R1, accepted.sessionRevision());
        code(Code.VALID_AT_OBSERVATION, good, good.expiresAtEpochMs() - 1);
        code(Code.SESSION_EXPIRED, good, good.expiresAtEpochMs());
        code(Code.SESSION_EXPIRED, good, good.expiresAtEpochMs() + 1);
        code(Code.SESSION_NOT_YET_VALID, good, ISSUED - 1);
        code(Code.SESSION_MISSING, null, ISSUED);

        for (SessionState state : SessionState.values()) {
            if (state == SessionState.AUTHENTICATED) continue;
            code(
                state == SessionState.REVOKED
                    ? Code.SESSION_REVOKED
                    : state == SessionState.EXPIRED ? Code.SESSION_EXPIRED : Code.SESSION_UNAUTHORIZED,
                session(state, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, List.of()),
                ISSUED
            );
        }
        for (long expires : new long[] {
            ISSUED,
            ISSUED - 1,
            ISSUED + MAX_LIFETIME_MS + 1,
            ISSUED + 16 * 60 * 60 * 1000L,
            Long.MAX_VALUE
        }) {
            code(
                Code.SESSION_LIFETIME_INVALID,
                session(SessionState.AUTHENTICATED, ISSUED, expires, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, List.of()),
                ISSUED
            );
        }
        code(
            Code.SESSION_INVALID,
            session(SessionState.AUTHENTICATED, -1, 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, List.of()),
            ISSUED
        );
        code(Code.CLOCK_INVALID, good, -1);
        assertEquals(Code.CONTEXT_INVALID, validate(good, null, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.DEVICE_MISSING, validate(good, CTX, null, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.DEVICE_UNKNOWN, validate(good, CTX, DeviceStatus.UNKNOWN, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.DEVICE_REVOKED, validate(good, CTX, DeviceStatus.REVOKED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.OWNER_AUTHORIZATION_MISSING, validate(good, CTX, DeviceStatus.AUTHORIZED, null, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.OWNER_AUTHORIZATION_UNKNOWN, validate(good, CTX, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.UNKNOWN, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.OWNER_AUTHORIZATION_REVOKED, validate(good, CTX, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.REVOKED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.STAFF_MISSING, validate(good, CTX, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, null, ISSUED).code());
        assertEquals(Code.STAFF_INACTIVE, validate(good, CTX, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.INACTIVE, ISSUED).code());
    }

    @Test
    public void rejectsMismatchedOrInvalidRevisionedSessions() {
        code(Code.SESSION_REF_MISMATCH, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, "other", CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, List.of()), ISSUED);
        code(Code.DEVICE_MISMATCH, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), "other", CTX.storeId(), CTX.staffId(), R1, List.of()), ISSUED);
        code(Code.STORE_MISMATCH, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), "other", CTX.staffId(), R1, List.of()), ISSUED);
        code(Code.STAFF_MISMATCH, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), "other", R1, List.of()), ISSUED);
        code(Code.SESSION_REVISION_MISSING, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), null, List.of()), ISSUED);
        code(Code.SESSION_REVISION_MISMATCH, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), new Revision("r2", null), List.of()), ISSUED);

        for (Revision invalid : Arrays.asList(
            new Revision(null, null),
            new Revision("", null),
            new Revision("both", 1L),
            new Revision(null, -1L),
            new Revision(null, 9_007_199_254_740_992L),
            new Revision("bad\nrevision", null)
        )) {
            code(Code.SESSION_INVALID, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), invalid, List.of()), ISSUED);
        }
        final Revision numeric = new Revision(null, 1L);
        final SessionRecord numbered = session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), numeric, List.of());
        assertEquals(
            Code.VALID_AT_OBSERVATION,
            validate(numbered, new Context(CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), numeric, OWNER), DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code()
        );
        assertEquals(Code.CONTEXT_INVALID, validate(good(), new Context(CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), null, OWNER), DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        assertEquals(Code.CONTEXT_INVALID, validate(good(), new Context(CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, null), DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());

        final SessionRecord otherOwnerRef = new SessionRecord(
            numbered.state(), numbered.staffSessionRef(), numbered.staffId(), numbered.displayName(), numbered.role(), numbered.scope(),
            numbered.permissions(), numbered.issuedAtEpochMs(), numbered.expiresAtEpochMs(), numbered.deviceId(), numbered.storeId(),
            numbered.sessionRevision(), new ParentAuthorization("other-owner-auth", OWNER_R1)
        );
        assertEquals(Code.OWNER_AUTHORIZATION_REF_MISMATCH, validate(otherOwnerRef, new Context(CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), numeric, OWNER), DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
        final SessionRecord otherOwnerRevision = new SessionRecord(
            numbered.state(), numbered.staffSessionRef(), numbered.staffId(), numbered.displayName(), numbered.role(), numbered.scope(),
            numbered.permissions(), numbered.issuedAtEpochMs(), numbered.expiresAtEpochMs(), numbered.deviceId(), numbered.storeId(),
            numbered.sessionRevision(), new ParentAuthorization(OWNER.ownerAuthorizationRef(), new Revision("owner-r2", null))
        );
        assertEquals(Code.OWNER_AUTHORIZATION_REVISION_MISMATCH, validate(otherOwnerRevision, new Context(CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), numeric, OWNER), DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, ISSUED).code());
    }

    @Test
    public void recordsAreImmutableRedactedAndDoNotInventRolePolicy() {
        final SessionRecord good = good();
        code(Code.SESSION_INVALID, session(null, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, List.of()), ISSUED);
        for (List<String> invalid : Arrays.<List<String>>asList(null, List.of(" "), Arrays.asList((String) null))) {
            code(Code.SESSION_INVALID, session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, invalid), ISSUED);
        }
        final ArrayList<String> mutable = new ArrayList<>();
        mutable.add("READ");
        final SessionRecord copied = session(SessionState.AUTHENTICATED, ISSUED, ISSUED + 1, CTX.staffSessionRef(), CTX.deviceId(), CTX.storeId(), CTX.staffId(), R1, mutable);
        mutable.clear();
        assertEquals(List.of("READ"), copied.permissions());
        assertThrows(UnsupportedOperationException.class, copied.permissions()::clear);
        assertEquals("SessionRecord[redacted]", copied.toString());

        final Observation expired = observe(good, good.expiresAtEpochMs());
        assertNull(expired.expiresAtEpochMs());
        assertNull(expired.sessionRevision());
        for (Role role : List.of(Role.STAFF, Role.MANAGER, Role.OWNER)) {
            for (Scope scope : List.of(Scope.STORE, Scope.MULTI_STORE)) {
                final SessionRecord roleRecord = new SessionRecord(
                    good.state(), good.staffSessionRef(), good.staffId(), good.displayName(), role, scope,
                    List.of(), good.issuedAtEpochMs(), good.expiresAtEpochMs(), good.deviceId(), good.storeId(), R1, OWNER
                );
                code(Code.VALID_AT_OBSERVATION, roleRecord, ISSUED);
            }
        }
        for (Role role : Role.values()) {
            final SessionRecord reportOnly = new SessionRecord(
                good.state(), good.staffSessionRef(), good.staffId(), good.displayName(), role, Scope.REPORT_ONLY,
                List.of(), good.issuedAtEpochMs(), good.expiresAtEpochMs(), good.deviceId(), good.storeId(), R1, OWNER
            );
            code(Code.SESSION_UNAUTHORIZED, reportOnly, ISSUED);
        }
        for (Scope scope : Scope.values()) {
            final SessionRecord viewer = new SessionRecord(
                good.state(), good.staffSessionRef(), good.staffId(), good.displayName(), Role.VIEWER, scope,
                List.of(), good.issuedAtEpochMs(), good.expiresAtEpochMs(), good.deviceId(), good.storeId(), R1, OWNER
            );
            code(Code.SESSION_UNAUTHORIZED, viewer, ISSUED);
        }
    }

    @Test
    public void verifierMetadataMatchesPublishedSchemaAndIsRedacted() {
        final String sha256Hex = "cd".repeat(32);
        assertEquals(120_000L, DEFAULT_PIN_ITERATIONS);
        for (long iterations : new long[] {100_000, 120_000, 200_000, 9_007_199_254_740_991L}) {
            assertEquals(Code.VERIFIER_METADATA_VALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA256", iterations, "aB00", sha256Hex)));
        }
        for (long iterations : new long[] {-1, 0, 99_999, 9_007_199_254_740_992L}) {
            assertEquals(Code.VERIFIER_METADATA_INVALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA256", iterations, "ab", sha256Hex)));
        }
        assertEquals(Code.VERIFIER_METADATA_MISSING, validateVerifier(null));
        assertEquals(Code.VERIFIER_METADATA_INVALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA1", 120_000, "ab", sha256Hex)));
        assertEquals(Code.VERIFIER_METADATA_INVALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA256", 120_000, "ab", "cd")));
        for (String malformed : Arrays.asList(null, "", "a", "zz", " ab", "ab ")) {
            assertEquals(Code.VERIFIER_METADATA_INVALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA256", 120_000, malformed, sha256Hex)));
            assertEquals(Code.VERIFIER_METADATA_INVALID, validateVerifier(new VerifierMetadata("PBKDF2-SHA256", 120_000, "ab", malformed)));
        }
        assertEquals("VerifierMetadata[redacted]", new VerifierMetadata("PBKDF2-SHA256", 120_000, "ab", sha256Hex).toString());
    }

    private static SessionRecord session(
        SessionState state,
        long issued,
        long expires,
        String reference,
        String device,
        String store,
        String staff,
        Revision revision,
        List<String> permissions
    ) {
        return new SessionRecord(
            state, reference, staff, "Synthetic staff", Role.STAFF, Scope.STORE, permissions,
            issued, expires, device, store, revision, OWNER
        );
    }

    private static SessionRecord good() {
        return session(
            SessionState.AUTHENTICATED,
            ISSUED,
            ISSUED + MAX_LIFETIME_MS,
            CTX.staffSessionRef(),
            CTX.deviceId(),
            CTX.storeId(),
            CTX.staffId(),
            R1,
            new ArrayList<>()
        );
    }

    private static Observation observe(SessionRecord session, long now) {
        return validate(session, CTX, DeviceStatus.AUTHORIZED, OwnerAuthorizationStatus.AUTHORIZED, StaffStatus.ACTIVE, now);
    }

    private static void code(Code expected, SessionRecord session, long now) {
        assertEquals(expected, observe(session, now).code());
    }
}
