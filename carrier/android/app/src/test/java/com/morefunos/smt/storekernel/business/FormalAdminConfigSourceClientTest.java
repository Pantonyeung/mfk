package com.morefunos.smt.storekernel.business;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicInteger;

public final class FormalAdminConfigSourceClientTest {
    @Test
    public void fetchesCanonicalActiveOnceAndAppliesWithNativeObservedAt() {
        final List<URI> requests = new ArrayList<>();
        final List<String> applied = new ArrayList<>();
        final FormalAdminConfigSourceClient client = client(
            "https://admin.morefunos.com",
            uri -> {
                requests.add(uri);
                return CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(200, "{\"envelope\":true}"));
            },
            (body, observedAt) -> {
                applied.add(body + "\n" + observedAt);
                return CompletableFuture.completedFuture(new FormalAdminConfigProducer.ApplyResult(7, "fnv1a32:abcd", 3, 4, false));
            }
        );

        final FormalAdminConfigSourceClient.FetchResult result = client.fetchActive().join();

        assertEquals(List.of(URI.create("https://admin.morefunos.com/api/admin-sync/active?storeId=MF01")), requests);
        assertEquals(List.of("{\"envelope\":true}\n2026-10-03T01:02:03Z"), applied);
        assertTrue(result.activePresent);
        assertEquals(7, result.sourceRevision);
        assertEquals("fnv1a32:abcd", result.sourceFingerprint);
        assertEquals(3, result.aggregateRevision);
        assertEquals(4, result.tenderPolicyAggregateRevision);
        assertFalse(result.replayed);
    }

    @Test
    public void missingActivePreservesLastKnownGoodAndDoesNotApply() {
        final AtomicInteger applies = new AtomicInteger();
        final FormalAdminConfigSourceClient client = client(
            "https://admin.morefunos.com/",
            ignored -> CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(404, "ignored")),
            (body, observedAt) -> {
                applies.incrementAndGet();
                return CompletableFuture.failedFuture(new AssertionError("must not apply"));
            }
        );

        final FormalAdminConfigSourceClient.FetchResult result = client.fetchActive().join();

        assertFalse(result.activePresent);
        assertEquals(0, applies.get());
    }

    @Test
    public void rejectsInsecureOrNonOriginEndpointConfiguration() {
        expectCode(() -> client("http://admin.morefunos.com", okTransport(), okSink()), "ADMIN_CONFIG_SOURCE_HTTPS_REQUIRED");
        expectCode(() -> client("https://user:secret@admin.morefunos.com", okTransport(), okSink()), "ADMIN_CONFIG_SOURCE_ORIGIN_INVALID");
        expectCode(() -> client("https://admin.morefunos.com/base", okTransport(), okSink()), "ADMIN_CONFIG_SOURCE_ORIGIN_INVALID");
        expectCode(() -> client("https://admin.morefunos.com?secret=1", okTransport(), okSink()), "ADMIN_CONFIG_SOURCE_ORIGIN_INVALID");
    }

    @Test
    public void rejectsRedirectAndServerFailureWithoutApplying() {
        for (int status : new int[] {301, 302, 307, 308, 401, 500}) {
            final AtomicInteger applies = new AtomicInteger();
            final FormalAdminConfigSourceClient client = client(
                "https://admin.morefunos.com",
                ignored -> CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(status, "{}")),
                (body, observedAt) -> {
                    applies.incrementAndGet();
                    return CompletableFuture.failedFuture(new AssertionError("must not apply"));
                }
            );

            expectFutureCode(client.fetchActive(), "ADMIN_CONFIG_SOURCE_HTTP_" + status);
            assertEquals(0, applies.get());
        }
    }

    @Test
    public void enforcesUtf8PayloadLimitBeforeProducer() {
        final String oversized = "x".repeat(FormalAdminConfigSourceClient.MAX_ENVELOPE_BYTES + 1);
        final AtomicInteger applies = new AtomicInteger();
        final FormalAdminConfigSourceClient client = client(
            "https://admin.morefunos.com",
            ignored -> CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(200, oversized)),
            (body, observedAt) -> {
                applies.incrementAndGet();
                return CompletableFuture.failedFuture(new AssertionError("must not apply"));
            }
        );

        expectFutureCode(client.fetchActive(), "ADMIN_CONFIG_SOURCE_BODY_TOO_LARGE");
        assertEquals(0, applies.get());
    }

    @Test
    public void propagatesTransportAndProducerFailureWithoutRetrying() {
        final AtomicInteger requests = new AtomicInteger();
        final FormalAdminConfigSourceClient transportFailure = client(
            "https://admin.morefunos.com",
            ignored -> {
                requests.incrementAndGet();
                return CompletableFuture.failedFuture(new IllegalStateException("NETWORK_DOWN"));
            },
            okSink()
        );
        expectFutureCode(transportFailure.fetchActive(), "NETWORK_DOWN");
        assertEquals(1, requests.get());

        final AtomicInteger applies = new AtomicInteger();
        final FormalAdminConfigSourceClient producerFailure = client(
            "https://admin.morefunos.com",
            okTransport(),
            (body, observedAt) -> {
                applies.incrementAndGet();
                return CompletableFuture.failedFuture(new IllegalStateException("ADMIN_CONFIG_FINGERPRINT_MISMATCH"));
            }
        );
        expectFutureCode(producerFailure.fetchActive(), "ADMIN_CONFIG_FINGERPRINT_MISMATCH");
        assertEquals(1, applies.get());
    }

    @Test
    public void urlConnectionReaderBoundsBytesNotCharacters() throws Exception {
        final byte[] exact = "é".repeat(FormalAdminConfigSourceClient.MAX_ENVELOPE_BYTES / 2)
            .getBytes(StandardCharsets.UTF_8);
        assertEquals(
            exact.length / 2,
            FormalAdminConfigSourceClient.UrlConnectionTransport.readUtf8Bounded(
                new ByteArrayInputStream(exact)
            ).length()
        );

        final byte[] oversized = new byte[FormalAdminConfigSourceClient.MAX_ENVELOPE_BYTES + 1];
        final IOException error = assertThrows(
            IOException.class,
            () -> FormalAdminConfigSourceClient.UrlConnectionTransport.readUtf8Bounded(
                new ByteArrayInputStream(oversized)
            )
        );
        assertEquals("ADMIN_CONFIG_SOURCE_BODY_TOO_LARGE", error.getMessage());
    }

    private static FormalAdminConfigSourceClient client(
        String origin,
        FormalAdminConfigSourceClient.Transport transport,
        FormalAdminConfigSourceClient.EnvelopeSink sink
    ) {
        return new FormalAdminConfigSourceClient(
            URI.create(origin),
            "MF01",
            transport,
            sink,
            () -> Instant.parse("2026-10-03T01:02:03Z")
        );
    }

    private static FormalAdminConfigSourceClient.Transport okTransport() {
        return ignored -> CompletableFuture.completedFuture(new FormalAdminConfigSourceClient.HttpResponse(200, "{}"));
    }

    private static FormalAdminConfigSourceClient.EnvelopeSink okSink() {
        return (body, observedAt) -> CompletableFuture.completedFuture(
            new FormalAdminConfigProducer.ApplyResult(1, "fnv1a32:abcd", 1, false)
        );
    }

    private static void expectFutureCode(CompletableFuture<?> future, String code) {
        final CompletionException error = assertThrows(CompletionException.class, future::join);
        assertEquals(code, root(error).getMessage());
    }

    private static void expectCode(Runnable action, String code) {
        final IllegalArgumentException error = assertThrows(IllegalArgumentException.class, action::run);
        assertEquals(code, error.getMessage());
    }

    private static Throwable root(Throwable error) {
        Throwable current = error;
        while ((current instanceof CompletionException) && current.getCause() != null) current = current.getCause();
        return current;
    }
}
