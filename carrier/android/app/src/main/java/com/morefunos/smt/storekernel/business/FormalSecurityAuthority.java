package com.morefunos.smt.storekernel.business;

import java.util.concurrent.CompletableFuture;

public interface FormalSecurityAuthority {
    /*
     * An authorized decision certifies all five admission facts: the device is authorized,
     * the staff session exists, is unexpired, is not revoked, and is frontline-eligible.
     * The implementation owns those checks; this router never verifies a PIN or invents sessions.
     */
    CompletableFuture<Decision> authorize(FormalBusinessCommandContract.CommandEnvelope command);

    CompletableFuture<Decision> authorizeReadback(FormalBusinessCommandContract.SubmissionReadRequest request);

    static FormalSecurityAuthority unbound() {
        return new FormalSecurityAuthority() {
            @Override
            public CompletableFuture<Decision> authorize(FormalBusinessCommandContract.CommandEnvelope command) {
                return CompletableFuture.completedFuture(Decision.rejected("MFP_SECURITY_PRODUCTION_BINDING_MISSING"));
            }

            @Override
            public CompletableFuture<Decision> authorizeReadback(FormalBusinessCommandContract.SubmissionReadRequest request) {
                return CompletableFuture.completedFuture(Decision.rejected("MFP_SECURITY_PRODUCTION_BINDING_MISSING"));
            }
        };
    }

    final class Decision {
        public final boolean authorized;
        public final String rejectionCode;

        private Decision(boolean authorized, String rejectionCode) {
            this.authorized = authorized;
            this.rejectionCode = rejectionCode;
        }

        public static Decision allowed() {
            return new Decision(true, null);
        }

        public static Decision rejected(String code) {
            if (code == null || !code.matches("^[A-Z0-9_:-]{1,160}$")) {
                throw new IllegalArgumentException("FORMAL_SECURITY_REJECTION_CODE_INVALID");
            }
            return new Decision(false, code);
        }
    }
}
